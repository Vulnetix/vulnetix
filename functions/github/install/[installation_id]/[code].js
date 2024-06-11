export const onRequestGet = async context => {
    if (context.params?.code) { //installation_id
        console.log('installation_id', context.params?.installation_id)
        const method = "POST"
        const url = new URL("https://github.com/login/oauth/access_token")
        url.search = new URLSearchParams({
            code: context.params.code,
            client_id: context.env.GITHUB_APP_CLIENT_ID,
            client_secret: context.env.GITHUB_APP_CLIENT_SECRET
        }).toString()
        return fetch(url, { method })
    }
    return new Response({ 'err': 'OAuth authorization code not provided' })
}
