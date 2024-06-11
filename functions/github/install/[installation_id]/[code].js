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
    const session = await env.d1db.prepare("SELECT * FROM sessions WHERE kid = ?")
        .bind(token)
        .first()
    if (session?.expiry <= +new Date()) {
        return Response.json({ 'err': 'Expired' })
    }
    if (params?.code) {
        const method = "POST"
        const url = new URL("https://github.com/login/oauth/access_token")
        url.search = new URLSearchParams({
            code: params.code,
            client_id: env.GITHUB_APP_CLIENT_ID,
            client_secret: env.GITHUB_APP_CLIENT_SECRET
        }).toString()
        const resp = await fetch(url, { method })
        const text = await resp.text()
        const data = Object.fromEntries(text.split('&').map(item => item.split('=').map(decodeURIComponent)))
        if (data?.error) {
            console.log(data)
            throw Error(data.error)
        }
        if (!data?.access_token) {
            console.log(data)
            throw Error('OAuth response invalid')
        }
        const info = await env.d1db.prepare('INSERT INTO integration_github (installation_id, memberEmail, access_key) VALUES (?1, ?2, ?3)')
            .bind(token, session.memberEmail, data.access_token)
            .run()
        console.log(`/github/install installation_id=${params?.installation_id} kid=${token}`, info)
        return Response.json(info)
    }
    return Response.json({ 'err': 'OAuth authorization code not provided' })
}
