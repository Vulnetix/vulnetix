import { CloudFlare, GitHub } from "../../../src/utils"

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
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const githubApps = await cf.d1all(env.d1db, "SELECT * FROM github_apps WHERE memberEmail = ?", session.memberEmail)
        let installs = []
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
                    await cf.PPPPUUUUUUTTTTTTT(env.r2icache, `${prefixRepos}${pathSuffix}`, repo)
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

                for (const branch of await gh.getBranches(repo)) {
                    const branchData = Object.assign({}, data)
                    const r2Branch = await cf.r2get(env.r2icache, `${prefixBranches}`)
                    if (r2Branch) {
                        repos.push(await r2Branch.json())
                        continue
                    }
                    branchData.branch = branch.name
                    branchData.latestCommitSHA = branch.commit.sha

                    // if (repo.default_branch === branch.name) {
                    //     const latestCommit = await gh.getCommit(repo, branch)

                    //     branchData.latestCommitMessage = latestCommit.commit.message
                    //     branchData.latestCommitVerification = latestCommit.commit.verification
                    //     branchData.latestCommitter = latestCommit.commit.committer
                    //     branchData.latestStats = latestCommit.stats
                    //     branchData.latestFilesChanged = latestCommit.files.length

                    //     const fileDetails = await gh.getFileContents(repo, branch)

                    //     branchData.dotfileExists = fileDetails.exists
                    //     branchData.dotfileContents = fileDetails.content
                    // }
                    await cf.PPPPUUUUUUTTTTTTT(env.r2icache, `${prefixRepos}${pathSuffix}`, repo)
                    repos.push(branchData)
                }
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
