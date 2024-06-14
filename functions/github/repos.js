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
        const { results } = await env.d1db.prepare("SELECT * FROM github_apps WHERE memberEmail = ?")
            .bind(session.memberEmail)
            .all()

        let installs = []
        for (const github_app of results) {
            if (!github_app.accessToken) {
                console.log(`github_apps kid=${token} installationId=${github_app.installationId}`)
                throw new Error('github_apps invalid')
            }
            const fetcher = new GitHubRepoFetcher(github_app.accessToken)

            installs = installs.concat({
                repos: await fetcher.getRepoDetails(),
                installationId: github_app.installationId,
                created: github_app.created,
            })
        }

        return Response.json(installs)
    } catch (e) {
        console.error(e)

        return Response.json(e)
    }
}

class GitHubRepoFetcher {
    constructor(accessToken) {
        this.headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': `token ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Triage-by-Trivial-Security',
        }
        this.baseUrl = "https://api.github.com"
    }
    async fetchJSON(url) {
        console.log(url)

        const response = await fetch(url, { headers: this.headers })
        if (!response.ok) {
            console.error(await response.text(), response.headers.entries().map(pair => `${pair[0]}: ${pair[1]}`))
            throw new Error(`GitHubRepoFetcher error! status: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }
    async getRepos() {
        // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
        return await this.fetchJSON(`${this.baseUrl}/user/repos`)
    }
    async getBranch(repo, branch) {
        // https://docs.github.com/en/rest/branches/branches?apiVersion=2022-11-28#get-a-branch
        return await this.fetchJSON(`${this.baseUrl}/repos/${repo.full_name}/branches/${branch}`)
    }
    async getBranches(repo) {
        // https://docs.github.com/en/rest/branches/branches?apiVersion=2022-11-28#list-branches
        return await this.fetchJSON(`${this.baseUrl}/repos/${repo.full_name}/branches`)
    }
    async getCommit(repo, branch) {
        // https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28
        return await this.fetchJSON(`${this.baseUrl}/repos/${repo.full_name}/commits/${branch.commit.sha}`)
    }
    async getFileContents(repo, branch) {
        // https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28
        const fileUrl = `${this.baseUrl}/repos/${repo.full_name}/contents/.trivialsec?ref=${branch.name}`

        console.log(fileUrl)
        try {
            const fileResponse = await fetch(fileUrl, { headers: this.headers })
            if (!fileResponse.ok) {
                if (fileResponse.status === 404) {
                    return { exists: false, content: null }
                }
                console.error(await response.text(), response.headers.entries().map(pair => `${pair[0]}: ${pair[1]}`))
                throw new Error(`getFileContents error! status: ${response.status} ${response.statusText}`)
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
        const collection = []
        for (const repo of await this.getRepos()) {
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

            for (const branch of await this.getBranches(repo)) {
                data.branch = branch.name
                data.latestCommitSHA = branch.commit.sha

                const branchData = Object.assign({}, data)
                if (repo.default_branch === branch.name) {
                    const latestCommit = await this.getCommit(repo, branch)

                    branchData.latestCommitMessage = latestCommit.commit.message
                    branchData.latestCommitVerification = latestCommit.commit.verification
                    branchData.latestCommitter = latestCommit.commit.committer
                    branchData.latestStats = latestCommit.stats
                    branchData.latestFilesChanged = latestCommit.files.length

                    const fileDetails = await this.getFileContents(repo, branch)

                    branchData.dotfileExists = fileDetails.exists
                    branchData.dotfileContents = fileDetails.content
                }
                collection.push(branchData)
            }
        }

        return collection
    }
}
