export const onRequestGet = async context => {
    if (context.request.headers.has('x-trivialsec')) {
        return new Response.json({ 'err': 'Forbidden' })
    }
    const token = context.request.headers.get('x-trivialsec')
    const session = await context.env.d1db.prepare("SELECT * FROM sessions WHERE kid = ?")
        .bind(context.params.email)
        .first()
    if (context.params?.code && session?.secret) {
        const method = "POST"
        const url = new URL("https://github.com/login/oauth/access_token")
        url.search = new URLSearchParams({
            code: context.params.code,
            client_id: context.env.GITHUB_APP_CLIENT_ID,
            client_secret: context.env.GITHUB_APP_CLIENT_SECRET
        }).toString()
        const resp = await fetch(url, { method }).catch(err => {
            throw Error(err)
        })
        const data = resp.json()
        const info = await context.env.d1db.prepare('INSERT INTO integration_github (installation_id, memberEmail, access_key) VALUES (?1, ?2, ?3)')
            .bind(token, session.memberEmail, data.access_token)
            .run()
        console.log(`/github/install installation_id=${context.params?.installation_id} kid=${session.kid}`, info)

        return new Response.json(info)
    }
    return new Response.json({ 'err': 'OAuth authorization code not provided' })
}
