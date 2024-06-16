import { CloudFlare, GitHub } from "../../../../../src/utils"

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
        const branches = []
        const uploadedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' }, onlyIf: { uploadedAfter } }
        for (const app of githubApps) {
            if (!app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${app.installationId}`)
                throw new Error('github_apps invalid')
            }
            const gh = new GitHub(app.accessToken)

            const branches = []
            const full_name = `${params.org}/${params.repo}`
            for (const branch of await gh.getBranches({ full_name })) {
                await env.r2icache.put(`github/${app.installationId}/branches/${full_name}/${branch.name}.json`, JSON.stringify(branch), putOptions)

                const info = await env.d1db.prepare('INSERT OR REPLACE INTO git_repos (pk, fullName, createdAt, updatedAt, pushedAt, defaultBranch, ownerId, memberEmail, licenseSpdxId, licenseName, fork, template, archived, visibility, avatarUrl) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)')
                    .bind(data.ghid, data.fullName, data.createdAt, data.updatedAt, data.pushedAt, data.defaultBranch, data.ownerId, session.memberEmail, data.licenseSpdxId, data.licenseName, data.fork, data.template, data.archived, data.visibility, data.avatarUrl)
                    .run()

                console.log(`/github/branches git_repos ${data.fullName} kid=${token}`, info)

                branches.push({
                    fullName: full_name,
                    branch: branch.name,
                    latestCommitSHA: branch.commit.sha,
                })
            }
        }

        return Response.json(branches)
    } catch (e) {
        console.error(e)

        return Response.json(e)
    }
}
