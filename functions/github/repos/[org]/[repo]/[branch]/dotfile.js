import { CloudFlare, GitHub } from "../../../../../../src/utils"

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
        for (const app of githubApps) {
            if (!app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${app.installationId}`)
                throw new Error('github_apps invalid')
            }
            const gh = new GitHub(app.accessToken)

            const branches = []
            const repoFullName = `${params.org}/${params.repo}`
            const prefixBranches = `/github/${app.installationId}/branches/${repoFullName}/`
            for (const branch of await gh.getBranches(repoFullName)) {
                await cf.PPPPUUUUUUTTTTTTT(env.r2icache, `${prefixBranches}/${branch.name}.json`, branch)
                branchData.branch = branch.name
                branchData.latestCommitSHA = branch.commit.sha
                const latestCommit = await gh.getCommit(repo, branch)
                branchData.latestCommitMessage = latestCommit.commit.message
                branchData.latestCommitVerification = latestCommit.commit.verification
                branchData.latestCommitter = latestCommit.commit.committer
                branchData.latestStats = latestCommit.stats
                branchData.latestFilesChanged = latestCommit.files.length
                const fileDetails = await gh.getFileContents(repo, branch)
                branchData.dotfileExists = fileDetails.exists
                branchData.dotfileContents = fileDetails.content
                repos.push(branchData)
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
