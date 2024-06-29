import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';
import { App, AuthResult, OSV, VulnCheck, hex, isSPDX } from "../../src/utils";


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
    const { err, result, session } = await (new App(request, prisma)).authenticate()
    if (result !== AuthResult.AUTHENTICATED) {
        return Response.json({ err, result })
    }

    const keyData = await prisma.member_keys.findFirst({
        where: {
            memberEmail: session.memberEmail,
            keyType: 'vulncheck',
        }
    })
    let vulncheck
    if (typeof keyData?.secret !== 'undefined') {
        vulncheck = new VulnCheck(keyData.secret)
    }

    const files = []
    let errors = new Set()
    try {
        const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' } }
        const inputs = await request.json()
        for (const spdx of inputs) {
            if (!isSPDX(spdx)) {
                return Response.json({
                    ok: false, err: 'SPDX is missing necessary fields.'
                })
            }
            const spdxStr = JSON.stringify(spdx)
            const spdxId = await hex(spdxStr)
            const objectPrefix = `uploads/${session.memberEmail}/spdx/`
            const fileName = `${spdxId}.json`
            console.log(fileName, await env.r2icache.put(`${objectPrefix}${fileName}`, spdxStr, putOptions))

            const info = await env.d1db.prepare(`
                INSERT OR REPLACE INTO spdx (
                spdxId,
                spdxVersion,
                source,
                repoName,
                name,
                dataLicense,
                documentNamespace,
                toolName,
                packageCount,
                createdAt,
                memberEmail,
                comment
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            `)
                .bind(
                    spdxId,
                    spdx.spdxVersion,
                    'upload',
                    '',
                    spdx.name,
                    spdx.dataLicense,
                    spdx.documentNamespace,
                    spdx.creationInfo.creators.join(', '),
                    spdx.packages.length,
                    (new Date(spdx.creationInfo.created)).getTime(),
                    session.memberEmail,
                    spdx.creationInfo?.comment || ''
                )
                .run()

            console.log(`/github/repos/spdx ${fileName} kid=${session.kid}`, info)

            files.push({
                spdxId,
                spdxVersion: spdx.spdxVersion,
                source: 'upload',
                repoName: '',
                name: spdx.name,
                dataLicense: spdx.dataLicense,
                documentNamespace: spdx.documentNamespace,
                toolName: spdx.creationInfo.creators.join(', '),
                packageCount: spdx.packages.length,
                createdAt: (new Date(spdx.creationInfo.created)).getTime(),
                memberEmail: session.memberEmail,
                comment: spdx.creationInfo?.comment || ''
            })
            const osvQueries = []

            vulncheckPackages:
            for (const pkg of spdx.packages) {
                for (const ref of pkg.externalRefs) {
                    if (ref?.referenceType === 'purl') {
                        osvQueries.push({ purl: ref.referenceLocator, name: pkg.name, version: pkg.versionInfo, licenseDeclared: pkg.licenseDeclared })
                        // if (!vulncheck) {
                        //     continue
                        // }
                        // const vc = await vulncheck.getPurl(ref.referenceLocator)
                        // if (vc?.content && vc.content?.errors) {
                        //     vc.content.errors.map(e => errors.add(`VulnCheck error [${vc.url}] ${e}`))
                        // }
                        // if (vc?.status === 402) {
                        //     break vulncheckPackages
                        // }
                        // if (vc?.ok === true) {
                        //     const createLog = await prisma.integration_usage_log.create({
                        //         data: {
                        //             memberEmail: session.memberEmail,
                        //             source: 'vulncheck',
                        //             request: JSON.stringify({ url: vc.url, purl: ref.referenceLocator }),
                        //             response: JSON.stringify(vc.content),
                        //             statusCode: vc?.status ? parseInt(vc.status, 10) : 0,
                        //             createdAt: (new Date()).getTime(),
                        //         }
                        //     })
                        //     console.log(`vulncheck.getPurl(${ref.referenceLocator})`, createLog)
                        //     for (const vulnerability of vc.content?.data?.vulnerabilities) {
                        //         const createFinding = await prisma.findings_sca.create({
                        //             data: {
                        //                 findingId: hex(`${session.memberEmail}${vulnerability.detection}${pkg.name}${pkg.versionInfo}`),
                        //                 memberEmail: session.memberEmail,
                        //                 source: 'vulncheck',
                        //                 createdAt: (new Date()).getTime(),
                        //                 detectionTitle: vulnerability.detection,
                        //                 purl: ref.referenceLocator,
                        //                 packageName: pkg.name,
                        //                 packageVersion: pkg.versionInfo,
                        //                 licenseDeclared: pkg.licenseDeclared,
                        //                 fixedVersion: vulnerability?.fixed_version,
                        //                 maliciousSource: research_attributes.malicious_source,
                        //                 abandoned: research_attributes.abandoned,
                        //                 squattedPackage: research_attributes.squatted_package,
                        //             }
                        //         })
                        //         console.log(`findings_sca`, createFinding)
                        //     }
                        // }
                    }
                }
            }
            const osv = new OSV()
            const queries = osvQueries.map(q => ({ package: { purl: q.purl } }))
            console.log(`osv queries`, queries)
            const vulns = await osv.queryBatch(queries)
            for (const [i, vuln] of vulns) {
                const finding = await prisma.findings_sca.create({
                    data: {
                        findingId: hex(`${session.memberEmail}${vuln.id}${osvQueries[i].name}${osvQueries[i].version}`),
                        memberEmail: session.memberEmail,
                        source: 'osv.dev',
                        createdAt: (new Date()).getTime(),
                        modifiedAt: (new Date(vuln.modified)).getTime(),
                        detectionTitle: vuln.id,
                        purl: osvQueries[i].purl,
                        packageName: osvQueries[i].name,
                        packageVersion: osvQueries[i].version,
                        licenseDeclared: osvQueries[i].licenseDeclared
                    }
                })
                console.log(`findings_sca`, finding)
            }
        }
    } catch (err) {
        console.error(err)

        return Response.json({ ok: false, err, files })
    }
    if (errors.size) {
        errors = [...errors].join(' ')
    }

    return Response.json({ ok: true, files, err: errors })
}
