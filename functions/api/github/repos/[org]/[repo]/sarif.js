import { GitHub, Server, saveArtifact } from "@/utils";
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
    const verificationResult = await (new Server(request, prisma)).authenticate()
    if (!verificationResult.isValid) {
        return Response.json({ ok: false, result: verificationResult.message })
    }
    const githubIntegration = await prisma.IntegrationConfig.findFirst({
        where: {
            orgId: verificationResult.session.orgId,
            AND: { name: `github` },
        }
    })
    if (!!githubIntegration?.suspend) {
        return Response.json({ ok: false, error: { message: 'GitHub Disabled' } })
    }
    const errors = []
    const githubApps = await prisma.GitHubApp.findMany({
        where: {
            memberEmail: verificationResult.session.memberEmail,
        },
    })
    const repoName = `${params.org}/${params.repo}`
    const files = []
    for (const app of githubApps) {
        if (!app.accessToken) {
            console.error(`Invalid github_apps kid=${verificationResult.session.kid} installationId=${app.installationId}`)
            continue
        }
        const gh = new GitHub(app.accessToken)

        const { content, error } = await gh.getRepoSarif(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, repoName)
        if (error?.message) {
            if ("Bad credentials" === error.message) {
                app.expires = (new Date()).getTime()
                await prisma.GitHubApp.update({
                    where: {
                        installationId: parseInt(app.installationId, 10),
                        AND: { memberEmail: app.memberEmail, },
                    },
                    data: app,
                })
                continue
            }
            delete app.accessToken
            delete app.memberEmail
            errors.push({ error, app })
            continue
        }
        for (const data of content) {
            const artifact = await saveArtifact(prisma, env.r2artifacts, JSON.stringify(data.sarif), crypto.randomUUID(), `sarif`)
            files.push(await process(prisma, verificationResult.session, data, repoName))
        }
    }

    const memberKeys = await prisma.MemberKey.findMany({
        where: {
            memberEmail: verificationResult.session.memberEmail,
            keyType: 'github_pat',
        },
    })
    for (const memberKey of memberKeys) {
        const gh = new GitHub(memberKey.secret)
        const { content, error } = await gh.getRepoSarif(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, repoName)
        if (error?.message) {
            errors.push({ error, app: { login: memberKey.keyLabel } })
            continue
        }
        for (const data of content) {
            await saveArtifact(prisma, env.r2artifacts, JSON.stringify(data.sarif), data.report.sarif_id, `sarif`)
            files.push(await process(prisma, verificationResult.session, data, repoName))
        }
    }

    return Response.json({ sarif: files, errors })
}

const process = async (prisma, session, data, fullName) => {
    const sarifId = data.report.sarif_id
    const info = await prisma.SARIFInfo.upsert({
        where: {
            reportId: data.report.id.toString(),
        },
        update: {
            commitSha: data.report.commit_sha,
            ref: data.report.ref,
            resultsCount: data.report.results_count,
            rulesCount: data.report.rules_count,
            toolName: data.report.tool.name,
            toolVersion: data.report.tool?.version,
            analysisKey: data.report.analysis_key,
            warning: data.report.warning || '',
        },
        create: {
            sarifId,
            reportId: data.report.id.toString(),
            artifactUuid: sarifId,
            fullName,
            source: 'GitHub',
            orgId: session.orgId,
            memberEmail: session.memberEmail,
            commitSha: data.report.commit_sha,
            ref: data.report.ref,
            createdAt: (new Date(data.report.created_at)).getTime(),
            resultsCount: data.report.results_count,
            rulesCount: data.report.rules_count,
            toolName: data.report.tool.name,
            toolVersion: data.report.tool?.version,
            analysisKey: data.report.analysis_key,
            warning: data.report.warning || '',
        },
    })
    console.log(`/github/repos/sarif ${fullName} kid=${session.kid}`, info)

    const results = []
    for (const run of data.sarif.runs) {
        if (Object.entries(run.results).length === 0) {
            continue
        }
        for (const result of run.results) {
            const resultData = {
                guid: result.guid || data.report.id.toString(),
                reportId: data.report.id.toString(),
                messageText: result.message.text,
                ruleId: result.ruleId,
                locations: JSON.stringify(result.locations),
                automationDetailsId: run.automationDetails.id,
            }
            for (const extension of run.tool.extensions) {
                resultData.rulesetName = extension.name
                for (const rule of extension.rules) {
                    if (rule.id === result.ruleId) {
                        resultData.level = rule.defaultConfiguration.level
                        resultData.description = rule.fullDescription.text
                        resultData.helpMarkdown = rule.help?.markdown || rule.help?.text
                        resultData.securitySeverity = rule.properties['security-severity']
                        resultData.precision = rule.properties.precision
                        resultData.tags = JSON.stringify(rule.properties.tags)
                        break
                    }
                }
            }
            results.push(resultData)
            console.log(
                resultData.guid,
                resultData.reportId,
                resultData.messageText,
                resultData.ruleId,
                resultData.locations,
                resultData.automationDetailsId,
                resultData.rulesetName,
                resultData.level,
                resultData.description,
                resultData.helpMarkdown,
                resultData.securitySeverity,
                resultData.precision,
                resultData.tags
            )
            const reportInfo = await prisma.SarifResults.upsert({
                where: {
                    guid: resultData.guid,
                },
                update: {
                    messageText: resultData.messageText,
                    ruleId: resultData.ruleId,
                    locations: resultData.locations,
                    automationDetailsId: resultData.automationDetailsId,
                    rulesetName: resultData.rulesetName,
                    level: resultData.level || '',
                    description: resultData.description || '',
                    helpMarkdown: resultData.helpMarkdown || '',
                    securitySeverity: resultData.securitySeverity || '',
                    precision: resultData.precision || '',
                    tags: resultData.tags || '',
                },
                create: {
                    guid: resultData.guid,
                    reportId: resultData.reportId,
                    messageText: resultData.messageText,
                    ruleId: resultData.ruleId,
                    locations: resultData.locations,
                    automationDetailsId: resultData.automationDetailsId,
                    rulesetName: resultData.rulesetName,
                    level: resultData.level || '',
                    description: resultData.description || '',
                    helpMarkdown: resultData.helpMarkdown || '',
                    securitySeverity: resultData.securitySeverity || '',
                    precision: resultData.precision || '',
                    tags: resultData.tags || '',
                },
            })
            console.log(`/github/repos/sarif_results ${fullName} kid=${session.kid}`, reportInfo)
        }
    }
    const result = {
        sarifId,
        reportId: data.report.id.toString(),
        artifactUuid: sarifId,
        fullName,
        memberEmail: session.memberEmail,
        commitSha: data.report.commit_sha,
        ref: data.report.commit_sha,
        createdAt: (new Date(data.report.created_at)).getTime(),
        resultsCount: data.report.results_count,
        rulesCount: data.report.rules_count,
        toolName: data.report.tool.name,
        toolVersion: data.report.tool?.version,
        analysisKey: data.report.analysis_key,
        warning: data.report.warning,
        results
    }
    return { result }
}