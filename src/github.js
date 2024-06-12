class GitHubRepoFetcher {
    constructor(accessKey) {
        this.accessKey = accessKey
        this.headers = {
            'Authorization': 'Bearer ${this.accessKey}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
        this.baseUrl = "https://api.github.com"
    }
    async fetchJSON(url) {
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
        const repoDetails = []

        for (const repo of repos) {
            const branches = await this.getBranches(repo)

            for (const branch of branches) {
                const latestCommit = await this.getLatestCommit(repo, branch)
                const fileDetails = await this.getFileContents(repo, branch)

                repoDetails.push({
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
                    dotfileContents: fileDetails.content
                })
            }
        }

        return repoDetails
    }
}
