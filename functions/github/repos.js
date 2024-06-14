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
        const githubApps = cf.d1all("d1db", "SELECT * FROM github_apps WHERE memberEmail = ?", session.memberEmail)
        let installs = []
        for (const app of githubApps) {
            if (!app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${app.installationId}`)
                throw new Error('github_apps invalid')
            }
            const gh = new GitHub(app.accessToken)
            const prefixRepos = `/github/${app.installationId}/repos/`
            let repoCache = cf.r2list('r2icache', prefixRepos)

            const repos = []
            for (const repo of await gh.getRepos()) {
                const pathSuffix = `${repo.full_name}/${repo.id}.json`
                const repoMetadata = repoCache.filter(r => r.key.endsWith(pathSuffix))
                if (repoMetadata.length === 0) {
                    await cf.r2put('r2icache', `${prefixRepos}${pathSuffix}`, repo)
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
                const branchCache = cf.r2get('r2icache', `${prefixBranches}${repo.default_branch}.json`)
                if (branchCache) {
                    const branch = branchCache.json()
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
