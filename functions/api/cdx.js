import { parseCycloneDXComponents } from "@/finding";
import { AuthResult, hex, isCDX, OSV, saveArtifact } from "@/utils";


export async function onRequestGet(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    const take = parseInt(data.searchParams.get('take'), 10) || 50
    const skip = parseInt(data.searchParams.get('skip'), 10) || 0
    let cdx = await data.prisma.CycloneDXInfo.findMany({
        where: {
            orgId: data.session.orgId,
        },
        include: {
            repo: true,
            artifact: {
                include: {
                    downloadLinks: true
                }
            },
        },
        take,
        skip,
        orderBy: {
            createdAt: 'desc',
        },
    })
    cdx = cdx.map(item => {
        let updatedItem = { ...item }
        if (item.artifact && item.artifact.downloadLinks && item.artifact.downloadLinks.length) {
            updatedItem.downloadLink = item.artifact.downloadLinks.filter(l => l.contentType === 'application/vnd.cyclonedx+json')?.pop()?.url
        }
        delete updatedItem.artifact

        return updatedItem
    })
    return Response.json({ ok: true, cdx })
}

export async function onRequestPost(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context

    const files = []
    let errors = new Set()
    try {
        for (const cdx of data.json) {
            if (!isCDX(cdx)) {
                return Response.json({ ok: false, error: { message: 'CDX is missing necessary fields.' } })
            }
            const componentsJSON = JSON.stringify(cdx.components.map(c => c?.["bom-ref"]).filter(v => !!v).sort())
            const cdxId = await hex(cdx.metadata.component["bom-ref"] + componentsJSON)

            const originalCdx = await data.prisma.CycloneDXInfo.findFirst({
                where: {
                    cdxId,
                    orgId: data.session.orgId,
                }
            })
            const artifactUuid = originalCdx?.artifactUuid || (cdx?.serialNumber?.startsWith('urn:uuid:') ? cdx.serialNumber.substring(9) : crypto.randomUUID())
            if (!cdx?.serialNumber) {
                cdx.serialNumber = `urn:uuid:${artifactUuid}`
            }
            const dependencies = []
            for (const dep of await parseCycloneDXComponents(cdx, cdxId)) {
                const lookup = await data.prisma.Dependency.findUnique({
                    where: {
                        cdx_dep: {
                            cdxId,
                            name: dep.name,
                            version: dep.version,
                        }
                    }
                })
                const newData = { ...dep, cdxId }
                if (lookup?.key) {
                    const infoUpd = await data.prisma.Dependency.update({
                        where: {
                            key: lookup.key
                        },
                        data: {
                            license: dep.license,
                            childOfKey: dep.childOfKey
                        }
                    })
                    data.logger.debug(`Update CycloneDX ${cdxId} Dep ${dep.name}`, infoUpd)
                    dependencies.push(newData)
                } else {
                    const infoAdd = await data.prisma.Dependency.create({ data: newData })
                    data.logger.debug(`Create CycloneDX ${cdxId} Dep ${dep.name}`, infoAdd)
                    dependencies.push(newData)
                }
            }
            const cdxStr = JSON.stringify(cdx)
            const artifact = await saveArtifact(data.prisma, env.r2artifacts, cdxStr, artifactUuid, `cyclonedx`)
            const cdxData = {
                cdxId,
                source: 'upload',
                cdxVersion: cdx.specVersion,
                serialNumber: cdx.serialNumber,
                name: cdx.metadata?.component?.name,
                version: cdx.metadata?.component?.version,
                createdAt: cdx.metadata?.timestamp ? new Date(cdx.metadata.timestamp).getTime() : new Date().getTime(),
                toolName: cdx.metadata.tools.map(t => `${t?.vendor} ${t?.name} ${t?.version}`.trim()).join(', '),
            }

            const lookup = await data.prisma.CycloneDXInfo.findUnique({
                where: {
                    cdxId,
                    orgId: data.session.orgId,
                }
            })
            if (lookup?.cdxId) {
                const infoUpd = await data.prisma.CycloneDXInfo.update({
                    where: {
                        cdxId: lookup.cdxId
                    },
                    data: {
                        createdAt: cdxData.createdAt,
                        serialNumber: cdxData.serialNumber,
                    }
                })
                data.logger.info(`Update CycloneDX ${cdxId}`, infoUpd)
            } else {
                const infoAdd = await data.prisma.CycloneDXInfo.create({
                    data: {
                        ...cdxData,
                        org: { connect: { uuid: data.session.orgId } },
                        artifact: { connect: { uuid: artifactUuid } },
                    }
                })
                data.logger.info(`Create CycloneDX ${cdxId}`, infoAdd)
            }
            cdxData.orgId = data.session.orgId
            cdxData.dependencies = dependencies
            artifact.downloadLink = artifact.downloadLinks.sort((a, b) => b.id - a.id)?.pop()
            delete artifact.downloadLinks
            artifact.cdx = cdxData
            files.push(artifact)

            const osvQueries = cdx.components.flatMap(component => {
                const queries = [{
                    name: component.name,
                    version: component?.version,
                    license: component?.licenses?.map(l => l.license?.id || '').join(' '),
                }]
                if (component?.purl) {
                    queries.push({
                        purl: decodeURIComponent(component.purl.split('?')[0]),
                        name: component.name,
                        version: component?.version,
                        license: component?.licenses?.map(l => l.license?.id || '').join(' '),
                    })
                }
                return queries
            })
            const osv = new OSV()
            const queries = osvQueries.map(q => {
                if (q?.purl) {
                    return { package: { purl: q?.purl } }
                }
                return { package: { name: q.name }, version: q.version }
            })
            const results = await osv.queryBatch(data.prisma, data.session.orgId, data.session.memberEmail, queries)
            let i = 0
            for (const result of results) {
                const { purl = null, name, version, license } = osvQueries[i]
                for (const vuln of result.vulns || []) {
                    if (!vuln?.id) {
                        continue
                    }
                    const findingId = await hex(`${data.session.orgId}${vuln.id}${name}${version}`)
                    const findingData = {
                        findingId,
                        orgId: data.session.orgId,
                        source: 'osv.dev',
                        category: 'sca',
                        createdAt: (new Date()).getTime(),
                        modifiedAt: (new Date(vuln.modified)).getTime(),
                        detectionTitle: vuln.id,
                        purl: purl || `pkg:generic/${[name, version].join('@')}`,
                        packageName: name,
                        packageVersion: version,
                        packageLicense: license,
                        malicious: vuln.id.startsWith("MAL-") ? 1 : 0,
                        cdxId
                    }
                    const originalFinding = await data.prisma.Finding.findFirst({
                        where: {
                            findingId,
                            AND: {
                                orgId: data.session.orgId
                            },
                        }
                    })
                    let finding;
                    if (originalFinding) {
                        finding = await data.prisma.Finding.update({
                            where: {
                                uuid: originalFinding.uuid,
                            },
                            data: {
                                cdxId,
                                purl: findingData.purl,
                                packageLicense: findingData.packageLicense,
                                malicious: findingData.malicious,
                                modifiedAt: findingData.modifiedAt
                            },
                        })
                    } else {
                        finding = await data.prisma.Finding.create({ data: findingData })
                    }
                    data.logger.info(`findings SCA`, finding)
                    // TODO lookup EPSS
                    const vexData = {
                        findingUuid: finding.uuid,
                        createdAt: (new Date()).getTime(),
                        lastObserved: (new Date()).getTime(),
                        seen: 0,
                        analysisState: 'in_triage'
                    }
                    const originalVex = await data.prisma.Triage.findFirst({
                        where: {
                            findingUuid: finding.uuid,
                            analysisState: 'in_triage',
                        }
                    })
                    let vex;
                    if (originalVex) {
                        vex = await data.prisma.Triage.update({
                            where: {
                                uuid: originalVex.uuid,
                            },
                            data: {
                                lastObserved: vexData.lastObserved
                            },
                        })
                    } else {
                        vex = await data.prisma.Triage.create({ data: vexData })
                    }
                    data.logger.info(`findings VEX`, vex)
                }
                i++
            }
        }
    } catch (err) {
        console.error(err)

        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED, files })
    }
    if (errors.size) {
        errors = [...errors].join(' ')
    } else {
        errors = null
    }

    return Response.json({ ok: true, files, error: { message: errors } })
}
