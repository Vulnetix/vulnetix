
export async function onRequestPost(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    const errors = []
    const results = []
    try {
        for (const { fullName, branch } of data.json?.targetRepos || []) {
            const info = await data.prisma.GitBranch.update({
                where: {
                    repoName_name: {
                        repoName: fullName,
                        name: branch,
                    },
                    AND: {
                        orgId: data.session.orgId,
                    }
                },
                data: {
                    monitored: 1,
                },
            })
            results.push(info)
            data.logger.debug(`/github/import ${fullName} ${branch}`, info)
        }
    } catch (err) {
        errors.push(err)
        data.logger.error(err)
    }

    return Response.json({ ok: !errors.length, error: { message: errors.join('. ') || null }, results })
}

// const gitRepos = []
// const installs = await data.prisma.GitHubApp.findMany({
//     where: {
//         orgId: data.session.orgId,
//         AND: { expires: { gte: (new Date()).getTime(), } }
//     },
// })
// for (const app of installs) {
//     if (!app.accessToken) {
//         data.logger.info(`github_apps kid=${data.session.kid} installationId=${app.installationId}`)
//         throw new Error('github_apps invalid')
//     }
//     const gh = new GitHub(data.prisma, data.session.orgId, data.session.memberEmail, app.accessToken)
//     for (const { fullName, branch } of data.json?.targetRepos || []) {
//         // https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
//         // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#check-if-vulnerability-alerts-are-enabled-for-a-repository
//         // https://docs.github.com/en/rest/dependabot/alerts?apiVersion=2022-11-28#list-dependabot-alerts-for-a-repository
//         // https://docs.github.com/en/rest/secret-scanning/secret-scanning?apiVersion=2022-11-28#list-secret-scanning-alerts-for-a-repository
//         // https://docs.github.com/en/rest/secret-scanning/secret-scanning?apiVersion=2022-11-28#list-locations-for-a-secret-scanning-alert
//         // https://docs.github.com/en/rest/code-scanning/code-scanning?apiVersion=2022-11-28#list-code-scanning-alerts-for-a-repository
//         const { content, error } = await gh.getBranch(fullName, branch)
//         if (error?.message) {
//             if ("Bad credentials" === error.message) {
//                 app.expires = (new Date()).getTime()
//                 await data.prisma.GitHubApp.update({
//                     where: {
//                         installationId: parseInt(app.installationId, 10),
//                         AND: { orgId: app.orgId, },
//                     },
//                     data: app,
//                 })
//                 continue
//             }
//             delete app.accessToken

//             return Response.json({ gitRepos, error, app })
//         }
//         data.logger.info('REPO', content)
//         const repo = await saveRepo(data.prisma, data.session, content, branch)
//         gitRepos.push(repo)
//     }
// }

// const memberKeys = await data.prisma.MemberKey.findMany({
//     where: {
//         memberEmail: data.session.memberEmail,
//         keyType: 'github_pat',
//     },
// })
// for (const memberKey of memberKeys) {
//     const gh = new GitHub(data.prisma, data.session.orgId, data.session.memberEmail, memberKey.secret)
//     for (const { fullName, branch } of data.json?.targetRepos || []) {
//         const { content, error } = await gh.getBranch(fullName, branch)
//         if (error?.message) {
//             return Response.json({ gitRepos, error, app: { login: memberKey.keyLabel } })
//         }
//         const repo = await saveRepo(data.prisma, data.session, content, branch)
//         gitRepos.push(repo)
//     }
// }
