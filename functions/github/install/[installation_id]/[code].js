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
            throw new Error(data.error)
        }
        if (!data?.access_token) {
            console.log('installation_id', params?.installation_id, 'kid', token, 'data', data)
            throw new Error('OAuth response invalid')
        }
        const info = await env.d1db.prepare('INSERT INTO integration_github (installation_id, memberEmail, access_key) VALUES (?1, ?2, ?3)')
            .bind(params?.installation_id, session?.memberEmail, data.access_token)
            .run()
        console.log(`/github/install installation_id=${params?.installation_id} kid=${token}`, info)
        const fetcher = new GitHubRepoFetcher(data.access_token)
        const details = await fetcher.getRepoDetails()
        const repos = JSON.stringify(details, null, 2)
        console.log('repos', repos)
        return Response.json(repos)
    }
    return Response.json({ 'err': 'OAuth authorization code not provided' })
}

const fetch = require('node-fetch')

class GitHubRepoFetcher {
    constructor(accessKey) {
        this.accessKey = accessKey
        this.headers = {
            'Authorization': `Bearer ${this.accessKey}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    }
    async fetchJSON(url) {
        const response = await fetch(url, { headers: this.headers })
        if (!response.ok) {
            throw new Error(`GitHubRepoFetcher error! status: ${response.status}`)
        }
        return response.json()
    }
    async getRepos() {
        return await this.fetchJSON('https://api.github.com/user/repos')
    }
    async getBranches(repo) {
        return await this.fetchJSON(`https://api.github.com/repos/${repo.full_name}/branches`)
    }
    async getLatestCommit(repo, branch) {
        const commit = await this.fetchJSON(`https://api.github.com/repos/${repo.full_name}/commits/${branch.name}`)
        return {
            hash: commit.sha,
            message: commit.commit.message,
            url: commit.html_url
        }
    }
    async getFileContents(repo, branch) {
        const fileUrl = `https://api.github.com/repos/${repo.full_name}/contents/.trivialsec?ref=${branch.name}`
        try {
            const fileResponse = await fetch(fileUrl, { headers: this.headers })
            if (!fileResponse.ok) {
                if (fileResponse.status === 404) {
                    return { exists: false, content: null }
                }
                throw new Error(`getFileContents error! status: ${fileResponse.status}`)
            }
            const file = await fileResponse.json()
            const content = Buffer.from(file.content, 'base64').toString('utf-8')
            return { exists: true, content }
        } catch (error) {
            console.error(error)
            return { exists: false, content: null }
        }
    }
    async getRepoDetails() {
        const repos = await this.getRepos()
        const repoDetails = []

        for (const repo of repos) {
            const branches = await this.getBranches(repo)

            for (const branch of branches) {
                const latestCommit = await this.getLatestCommit(repo, branch)
                const fileDetails = await this.getFileContents(repo, branch)

                repoDetails.push({
                    branch: branch.name,
                    latestCommitHash: latestCommit.hash,
                    latestCommitMessage: latestCommit.message,
                    repoUrl: repo.html_url,
                    fileExists: fileDetails.exists,
                    fileContents: fileDetails.content
                })
            }
        }

        return repoDetails
    }
}
