import { App, AuthResult, GitHub, hex, isSPDX, OSV } from "@/utils";
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

export async function onRequestGet(context) {
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
        return Response.json({ error: { message: err }, result })
    }
    const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' } }
    const repoName = `${params.org}/${params.repo}`
    const errors = []
    const files = []

    const githubApps = await prisma.github_apps.findMany({
        where: {
            memberEmail: session.memberEmail,
        },
    })
    for (const app of githubApps) {
        if (!app.accessToken) {
            console.log(`github_apps kid=${session.kid} installationId=${app.installationId}`)
            throw new Error('github_apps invalid')
        }
        const gh = new GitHub(app.accessToken)
        const { content, error } = await gh.getRepoSpdx(repoName)
        if (error?.message) {
            delete app.accessToken
            delete app.memberEmail
            errors.push({ error, app })
            continue
        }
        if (typeof content?.sbom === 'undefined' || typeof content?.sbom?.SPDXID === 'undefined' || !isSPDX(content?.sbom)) {
            console.log('typeof content?.sbom', typeof content?.sbom)
            console.log('typeof content?.sbom?.SPDXID', typeof content?.sbom?.SPDXID)
            console.log('isSPDX(content?.sbom)', isSPDX(content?.sbom))
            console.log('content', content)
            continue
        }
        const { spdxId, spdxStr } = await process(prisma, session, repoName, content)
        const objectPrefix = `github/${app.installationId}/repos/${repoName}/sbom/`
        console.log(`${repoName}/sbom/${spdxId}.json`, await env.r2icache.put(`${objectPrefix}${spdxId}.json`, spdxStr, putOptions))
        files.push(content)
    }
    const memberKeys = await prisma.member_keys.findMany({
        where: {
            memberEmail: session.memberEmail,
            keyType: 'github_pat',
        },
    })
    for (const memberKey of memberKeys) {
        const gh = new GitHub(memberKey.secret)
        const { content, error } = await gh.getRepoSpdx(repoName)
        if (error?.message) {
            errors.push({ error, app: { login: memberKey.keyLabel } })
            continue
        }
        if (typeof content?.sbom === 'undefined' || typeof content?.sbom?.SPDXID === 'undefined' || !isSPDX(content?.sbom)) {
            console.log('typeof content?.sbom', typeof content?.sbom)
            console.log('typeof content?.sbom?.SPDXID', typeof content?.sbom?.SPDXID)
            console.log('isSPDX(content?.sbom)', isSPDX(content?.sbom))
            console.log('content', content)
            continue
        }
        const { spdxId, spdxStr } = await process(prisma, session, repoName, content)
        const objectPrefix = `github/pat_${memberKey.id}/repos/${repoName}/sbom/`
        console.log(`${repoName}/sbom/${spdxId}.json`, await env.r2icache.put(`${objectPrefix}${spdxId}.json`, spdxStr, putOptions))
        files.push({ spdx: content, errors })
    }

    return Response.json(files)
}

const process = async (prisma, session, repoName, content) => {
    console.log('process', repoName, content)
    const spdx = content.sbom
    const spdxStr = JSON.stringify(spdx)
    const spdxId = await hex(spdxStr)

    const info = await prisma.spdx.upsert({
        where: {
            spdxId,
        },
        update: {
            comment: spdx.creationInfo?.comment || '' + ` - Refreshed ${(new Date()).toISOString()}`,
        },
        create: {
            spdxId,
            spdxVersion: spdx.spdxVersion,
            source: 'GitHub',
            repoName,
            name: spdx.name,
            dataLicense: spdx.dataLicense,
            documentNamespace: spdx.documentNamespace,
            toolName: spdx.creationInfo.creators.join(', '),
            packageCount: spdx.packages.length,
            createdAt: (new Date(spdx.creationInfo.created)).getTime(),
            memberEmail: session.memberEmail,
            comment: spdx.creationInfo?.comment || '',
        },
    })

    console.log(`/github/repos/spdx ${repoName} kid=${session.kid}`, info)
    const osvQueries = spdx.packages.flatMap(pkg => {
        if (!pkg?.externalRefs) { return }
        return pkg.externalRefs
            .filter(ref => ref?.referenceType === 'purl')
            .map(ref => ({
                purl: ref.referenceLocator,
                name: pkg.name,
                version: pkg.versionInfo,
                licenseDeclared: pkg.licenseDeclared
            }))
    })
    console.log(`osvQueries ${repoName} kid=${session.kid}`, osvQueries)
    const osv = new OSV()
    const queries = osvQueries.filter(q => q?.purl).map(q => ({ package: { purl: q.purl } }))
    const vulns = await osv.queryBatch(queries)
    if (typeof vulns?.length !== 'undefined') {
        let i = 0
        for (const vuln of vulns) {
            if (typeof vuln?.id === 'undefined') {
                continue
            }
            const findingId = await hex(`${session.memberEmail}${vuln.id}${osvQueries[i].name}${osvQueries[i].version}`)
            const finding = await prisma.findings.upsert({
                where: {
                    findingId,
                },
                update: {
                    modifiedAt: (new Date(vuln.modified)).getTime()
                },
                create: {
                    findingId,
                    memberEmail: session.memberEmail,
                    source: 'osv.dev',
                    category: 'sca',
                    createdAt: (new Date()).getTime(),
                    modifiedAt: (new Date(vuln.modified)).getTime(),
                    detectionTitle: vuln.id,
                    purl: osvQueries[i].purl,
                    packageName: osvQueries[i].name,
                    packageVersion: osvQueries[i].version,
                    licenseDeclared: osvQueries[i].licenseDeclared,
                    spdxId
                }
            })
            console.log(`findings SCA`, finding)
            const vex = await prisma.triage_activity.upsert({
                where: {
                    findingId,
                    analysisState: 'in_triage',
                },
                update: {
                    lastObserved: (new Date()).getTime()
                },
                create: {
                    findingId,
                    createdAt: (new Date()).getTime(),
                    lastObserved: (new Date()).getTime(),
                    seen: 0,
                    analysisState: 'in_triage',
                }
            })
            console.log(`findings VEX`, vex)
            i = i++
        }
    }

    return { spdxId, spdxStr }
}
