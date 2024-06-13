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
        const { results } = await env.d1db.prepare("SELECT * FROM github_apps WHERE memberEmail = ?")
            .bind(session.memberEmail)
            .all()

        let repos = []
        for (const github_app of results) {
            if (!github_app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${installationId}`)
                throw new Error('github_apps invalid')
            }
            const fetcher = new GitHubRepoFetcher(github_app.accessToken)

            console.log('headers', fetcher.headers)
            console.log('fetcher', fetcher.repos)

            await fetcher.getRepoDetails()
            console.log('fetcher', fetcher.repos)

            repos = repos.concat(fetcher.repos)
            console.log('repos', repos)
        }

        return Response.json(repos)
    } catch (e) {
        console.error(e)

        return Response.json(e)
    }
}

class GitHubRepoFetcher {
    constructor(accessToken) {
        this.repos = []
        this.headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': `token ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
        }
        this.baseUrl = "https://api.github.com"
    }
    async fetchJSON(url) {
        console.log(url)

        const response = await fetch(url, { headers: this.headers })
        if (!response.ok) {
            throw new Error(`GitHubRepoFetcher error! status: ${response.status}`)
        }

        return response.json()
    }
    async getRepos() {
        return await this.fetchJSON(`${this.baseUrl}/user/repos`)
    }
    async getBranches(repo) {
        return await this.fetchJSON(`${this.baseUrl}/repos/${repo.full_name}/branches`)
    }
    async getLatestCommit(repo, branch) {
        return await this.fetchJSON(`${this.baseUrl}/repos/${repo.full_name}/commits/${branch.commit.sha}`)
    }
    async getFileContents(repo, branch) {
        const fileUrl = `${this.baseUrl}/repos/${repo.full_name}/contents/.trivialsec?ref=${branch.name}`

        console.log(fileUrl)
        try {
            const fileResponse = await fetch(fileUrl, { headers: this.headers })
            if (!fileResponse.ok) {
                if (fileResponse.status === 404) {
                    return { exists: false, content: null }
                }
                throw new Error(`getFileContents error! status: ${fileResponse.status}`)
            }
            const file = await fileResponse.json()
            const content = Buffer.from(file.content, file.encoding).toString('utf-8')

            return { exists: true, content }
        } catch (error) {
            console.error(error)

            return { exists: false, content: null }
        }
    }
    async getRepoDetails() {
        const repos = await this.getRepos()

        for (const repo of repos) {
            const branches = await this.getBranches(repo)

            for (const branch of branches) {
                const latestCommit = await this.getLatestCommit(repo, branch)
                const fileDetails = await this.getFileContents(repo, branch)

                this.repos.push({
                    ghid: repo.id,
                    fullName: repo.full_name,
                    branch: branch.name,
                    defaultBranch: repo.default_branch,
                    avatarUrl: repo.owner.avatar_url,
                    archived: repo.archived,
                    visibility: repo.visibility,
                    createdAt: repo.created_at,
                    pushedAt: repo.pushed_at,
                    license: repo.license,
                    latestCommitSHA: latestCommit.sha,
                    latestCommitMessage: latestCommit.commit.message,
                    latestCommitVerification: latestCommit.commit.verification,
                    latestCommitter: latestCommit.commit.committer,
                    latestStats: latestCommit.stats,
                    latestFilesChanged: latestCommit.files.length,
                    dotfileExists: fileDetails.exists,
                    dotfileContents: fileDetails.content,
                })
            }
        }
    }
}
