import { GitHubRepoFetcher } from "../../src/github"

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
    console.log('token', token)
    const session = await
        env.d1db.prepare("SELECT memberEmail, expiry FROM sessions WHERE kid = ?")
            .bind(token)
            .first()
    console.log('session expiry', session?.expiry)
    if (!session) {
        return Response.json({ 'err': 'Revoked' })
    }
    if (session?.expiry <= +new Date()) {
        return Response.json({ 'err': 'Expired' })
    }
    const access_token = await
        env.d1db.prepare("SELECT access_key FROM integration_github WHERE memberEmail = ?")
            .bind(session.memberEmail)
            .first('access_key')
    if (!access_token) {
        console.log(`integration_github kid=${token}`)
        throw new Error('integration_github invalid')
    }
    const fetcher = new GitHubRepoFetcher(access_token)
    const details = await fetcher.getRepoDetails()
    const repos = JSON.stringify(details, null, 2)
    console.log('repos', repos)
    return Response.json(repos)
}
