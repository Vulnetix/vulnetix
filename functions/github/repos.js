import { CloudFlare, GitHub } from "../../src/utils"

const cf = new CloudFlare()

export async function onRequestGet(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context

    const token = request.headers.get('x-trivialsec')
    if (!token) {
        return Response.json({ 'err': 'Forbidden' })
    }

    const session = await env.d1db.prepare("SELECT memberEmail, expiry FROM sessions WHERE kid = ?")
        .bind(token)
        .first()

    console.log('session expiry', session?.expiry)
    if (!session) {
        return Response.json({ 'err': 'Revoked' })
    }
    if (session?.expiry <= +new Date()) {
        return Response.json({ 'err': 'Expired' })
    }
    try {
        const githubApps = await cf.d1all(env.d1db, "SELECT * FROM github_apps WHERE memberEmail = ?", session.memberEmail)
        const installs = []
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' } }
        for (const app of githubApps) {
            if (!app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${app.installationId}`)
                throw new Error('github_apps invalid')
            }
            const gh = new GitHub(app.accessToken)
            const prefixRepos = `github/${app.installationId}/repos/`
            console.log(`prefixRepos = ${prefixRepos}`)
            const repoCache = await cf.r2list(env.r2icache, prefixRepos)

            const repos = []
            for (const repo of await gh.getRepos()) {
                const pathSuffix = `${repo.full_name}.json`
                const repoMetadata = repoCache.filter(r => r.key.endsWith(pathSuffix))
                if (repoMetadata.length === 0) {
                    console.log(`r2icache.put ${prefixRepos}${pathSuffix}`)
                    await env.r2icache.put(`${prefixRepos}${pathSuffix}`, JSON.stringify(repo), putOptions)
                }
                const data = {
                    ghid: repo.id,
                    fullName: repo.full_name,
                    ownerId: repo.owner.id,
                    createdAt: repo.created_at,
                    updatedAt: repo.updated_at,
                    visibility: repo.visibility,
                    archived: repo.archived,
                    fork: repo.fork,
                    template: repo.is_template,
                    defaultBranch: repo.default_branch,
                    pushedAt: repo.pushed_at,
                    avatarUrl: repo.owner.avatar_url,
                    licenseSpdxId: repo.license?.spdx_id || '',
                    licenseName: repo.license?.name || '',
                }
                console.log(`/github/repos github_apps ${data.fullName} kid=${token}`, info)
                const info = await env.d1db.prepare('INSERT INTO github_apps (pk, fullName, createdAt, updatedAt, pushedAt, defaultBranch, ownerId, memberEmail, licenseSpdxId, licenseName, fork, template, archived, visibility, avatarUrl) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)')
                    .bind(data.ghid, data.fullName, data.createdAt, data.updatedAt, data.pushedAt, data.defaultBranch, data.ownerId, session.memberEmail, data.licenseSpdxId, data.licenseName, data.fork, data.template, data.archived, data.visibility, data.avatarUrl)
                    .run()

                const prefixBranches = `/github/${app.installationId}/branches/${repo.full_name}/`
                data.branch = repo.default_branch
                console.log(`r2icache.get ${prefixBranches}${repo.default_branch}.json`)
                const branchCache = await cf.r2get(env.r2icache, `${prefixBranches}${repo.default_branch}.json`, oneDayAgo)
                if (!branchCache) {
                    console.log(`Branch ${repo.default_branch} not cached`)
                    repos.push(data)
                    continue
                }
                const branch = await branchCache.json()
                data.latestCommitSHA = branch?.commit?.sha
                // data.latestCommitMessage = branch?.commit?.message
                // data.latestCommitVerification = branch?.commit?.verification
                // data.latestCommitter = branch?.commit?.committer
                // data.latestStats = branch?.stats
                // data.latestFilesChanged = branch?.files?.length
                // data.dotfileExists = branch?.exists
                // data.dotfileContents = branch?.content

                repos.push(data)
            }
            installs.push({
                repos,
                installationId: app.installationId,
                created: app.created,
            })
        }

        return Response.json(installs)
    } catch (e) {
        console.error(e)

        return Response.json(e)
    }
}
