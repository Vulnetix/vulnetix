import { AuthResult, ensureStrReqBody, hex, isCDX, OSV, saveArtifact, Server } from "@/utils";
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';


export async function onRequestPost(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    const adapter = new PrismaD1(env.d1db)
    const prisma = new PrismaClient({
        adapter,
        transactionOptions: {
            maxWait: 1500, // default: 2000
            timeout: 2000, // default: 5000
        },
    })
    const verificationResult = await (new Server(request, prisma)).authenticate()
    if (!verificationResult.isValid) {
        return Response.json({ ok: false, result: verificationResult.message })
    }

    const files = []
    let errors = new Set()
    try {
        const body = await ensureStrReqBody(request)
        const inputs = JSON.parse(body)
        for (const cdx of inputs) {
            if (!isCDX(cdx)) {
                return Response.json({ ok: false, error: { message: 'CDX is missing necessary fields.' } })
            }
            const componentsJSON = JSON.stringify(cdx.components)
            const cdxId = await hex(cdx.metadata?.component?.name + componentsJSON)

            const originalCdx = await prisma.CycloneDXInfo.findFirst({
                where: {
                    cdxId,
                    orgId: verificationResult.session.orgId,
                }
            })
            let artifact;
            const artifactUuid = originalCdx?.artifactUuid || cdx.serialNumber.startsWith('urn:uuid:') ? cdx.serialNumber.substring(9) : crypto.randomUUID()
            if (!originalCdx) {
                const cdxStr = JSON.stringify(cdx)
                artifact = await saveArtifact(prisma, env.r2artifacts, cdxStr, artifactUuid, `cyclonedx`)
            }

            const cdxData = {
                cdxId,
                artifactUuid,
                source: 'upload',
                orgId: verificationResult.session.orgId,
                memberEmail: verificationResult.session.memberEmail,
                cdxVersion: cdx.specVersion,
                serialNumber: cdx.serialNumber,
                name: cdx.metadata?.component?.name,
                version: cdx.metadata?.component?.version,
                createdAt: (new Date(cdx.metadata.timestamp)).getTime(),
                toolName: cdx.metadata.tools.map(t => `${t?.vendor} ${t?.name} ${t?.version}`.trim()).join(', '),
                externalReferencesCount: cdx.metadata.component?.externalReferences?.length || 0,
                componentsCount: cdx.components?.length || 0,
                dependenciesCount: cdx.dependencies?.length || 0,
            }
            const info = await prisma.CycloneDXInfo.upsert({
                where: {
                    cdxId,
                    memberEmail: verificationResult.session.memberEmail,
                },
                update: {
                    createdAt: cdxData.createdAt,
                    serialNumber: cdxData.serialNumber
                },
                create: cdxData
            })
            console.log(`/upload/cdx ${cdxId} kid=${verificationResult.session.kid}`, info)
            files.push(cdxData)

            const osvQueries = cdx.components.map(component => {
                if (!component?.purl) { return }
                return {
                    referenceLocator: decodeURIComponent(component.purl),
                    name: component.name,
                    version: component?.version,
                    license: component?.licenses?.map(l => l.license?.id || '').join(' '),
                }
            })
            const osv = new OSV()
            const queries = osvQueries.map(q => ({ package: { purl: q?.referenceLocator } }))
            const results = await osv.queryBatch(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, queries)
            let i = 0
            for (const result of results) {
                const { referenceLocator, name, version, license } = osvQueries[i]
                for (const vuln of result.vulns || []) {
                    if (!vuln?.id) {
                        continue
                    }
                    const findingId = await hex(`${vuln.id}${referenceLocator}`)
                    const findingData = {
                        findingId,
                        orgId: verificationResult.session.orgId,
                        memberEmail: verificationResult.session.memberEmail,
                        source: 'osv.dev',
                        category: 'sca',
                        createdAt: (new Date()).getTime(),
                        modifiedAt: (new Date(vuln.modified)).getTime(),
                        detectionTitle: vuln.id,
                        purl: referenceLocator,
                        packageName: name,
                        packageVersion: version,
                        packageLicense: license,
                        maliciousSource: vuln.id.startsWith("MAL-"),
                        cdxId
                    }
                    const originalFinding = await prisma.Finding.findFirst({
                        where: {
                            findingId,
                            AND: {
                                orgId: verificationResult.session.orgId
                            },
                        }
                    })
                    let finding;
                    if (originalFinding) {
                        finding = await prisma.Finding.update({
                            where: {
                                uuid: originalFinding.uuid,
                            },
                            data: {
                                cdxId,
                                modifiedAt: findingData.modifiedAt
                            },
                        })
                    } else {
                        finding = await prisma.Finding.create({ data: findingData })
                    }
                    console.log(`findings SCA`, finding)
                    // TODO lookup EPSS
                    const vexData = {
                        findingUuid: finding.uuid,
                        createdAt: (new Date()).getTime(),
                        lastObserved: (new Date()).getTime(),
                        seen: 0,
                        analysisState: 'in_triage'
                    }
                    const originalVex = await prisma.Triage.findFirst({
                        where: {
                            findingUuid: finding.uuid,
                            analysisState: 'in_triage',
                        }
                    })
                    let vex;
                    if (originalVex) {
                        vex = await prisma.Triage.update({
                            where: {
                                uuid: originalVex.uuid,
                            },
                            data: {
                                lastObserved: vexData.lastObserved
                            },
                        })
                    } else {
                        vex = await prisma.Triage.create({ data: vexData })
                    }
                    console.log(`findings VEX`, vex)
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
