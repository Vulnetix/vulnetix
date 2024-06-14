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
        let installs = []
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' } }
        for (const app of githubApps) {
            if (!app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${app.installationId}`)
                throw new Error('github_apps invalid')
            }
            const gh = new GitHub(app.accessToken)
            const prefixRepos = `/github/${app.installationId}/repos/`
            let repoCache = await cf.r2list(env.r2icache, prefixRepos)

            const repos = []
            for (const repo of await gh.getRepos()) {
                const pathSuffix = `${repo.full_name}/${repo.id}.json`
                const repoMetadata = repoCache.filter(r => r.key.endsWith(pathSuffix))
                if (repoMetadata.length === 0) {
                    await env.r2icache.put(`${prefixRepos}${pathSuffix}`, JSON.stringify(repo), putOptions)
                }
                const data = {
                    ghid: repo.id,
                    fullName: repo.full_name,
                    createdAt: repo.created_at,
                    visibility: repo.visibility,
                    archived: repo.archived,
                    defaultBranch: repo.default_branch,
                    pushedAt: repo.pushed_at,
                    avatarUrl: repo.owner.avatar_url,
                    license: repo.license,
                }
                const prefixBranches = `/github/${app.installationId}/branches/${repo.full_name}/`
                data.branch = repo.default_branch
                const branchCache = await cf.r2get(env.r2icache, `${prefixBranches}${repo.default_branch}.json`, oneDayAgo)
                if (branchCache) {
                    const branch = await branchCache.json()
                    data.latestCommitSHA = branch?.commit?.sha
                    data.latestCommitMessage = branch?.commit?.message
                    data.latestCommitVerification = branch?.commit?.verification
                    data.latestCommitter = branch?.commit?.committer
                    data.latestStats = branch?.stats
                    data.latestFilesChanged = branch?.files?.length
                    data.dotfileExists = branch?.exists
                    data.dotfileContents = branch?.content
                }
                repos.push(data)
            }
            installs = installs.concat({
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
