<script setup>
import { default as axios } from 'axios'
import { reactive } from 'vue'
import { useTheme } from 'vuetify'
import router from "../router"
import { isJSON, octodex } from '../utils'

const { global } = useTheme()

const initialState = {
    error: "",
    warning: "",
    success: "",
    loading: false,
    installs: false,
    octodexImageUrl: `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`,
    apps: [],
}

const state = reactive({
    ...initialState,
})

axios.defaults.headers.common = {
    'x-trivialsec': localStorage.getItem('/session/token') || '',
}

class GitHub {
    constructor() {
        this.urlQuery = Object.fromEntries(location.search.substring(1).split('&').map(item => item.split('=').map(decodeURIComponent)))

        const url = new URL(location)

        url.search = ""
        history.pushState({}, "", url)

        if (this.urlQuery?.setup_action === 'install' && this.urlQuery?.code && this.urlQuery?.installation_id) {
            this.install(this.urlQuery.code, this.urlQuery.installation_id)
        } else {
            this.refreshRepos(true)
        }
    }
    async install(code, installation_id) {
        const { data } = await axios.get(`/github/install/${installation_id}/${code}`)

        console.log(data)
        this.refreshRepos()

        return setTimeout(state.success = "GitHub App installed successfully.", 1000)
    }
    async refreshRepos(cached = false) {
        clearAlerts()
        state.loading = true
        try {
            let uriPath = '/github/repos'
            if (cached === true) {
                uriPath += '/cached'
            }
            const { data } = await axios.get(uriPath)

            state.loading = false
            if (typeof data === "string" && !isJSON(data)) {
                state.warning = cached ? "No cached data. Have you tried to install the GitHub App?" : "No data retrieved from GitHub. Was this GitHub App uninstalled?"
                state.octodexImageUrl = `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`

                return
            }
            if (Array.isArray(data) && data.length > 0) {
                if (["Expired", "Revoked", "Forbidden"].includes(data?.err)) {
                    state.error = data.err

                    return setTimeout(router.push('/logout'), 2000)
                }
                state.installs = true
                if (data.map(i => i.repos.length).reduce((a, b) => a + b, 0) === 0) {
                    state.error = "No data retrieved from GitHub. Is this GitHub App installed?"
                    state.warning = "Please check the GitHub App permissions, they may have been revoked or uninstalled."
                } else {
                    state.apps = data
                    state.success = cached ? "Loaded cached GitHub repositories" : "Refreshed GitHub repositories"
                }

                return
            }
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
        }
        state.warning = "No data retrieved from GitHub. Is this GitHub App uninstalled?"
        state.octodexImageUrl = `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`
        state.loading = false
    }
    async refreshLatestCommit(repoFullName, branchName) {
        clearAlerts()
    }
    async refreshDotfile(repoFullName, branchName) {
        clearAlerts()
    }
    async refreshBranch(repoFullName) {
        clearAlerts()
    }
    async refreshBranches(repoFullName) {
        clearAlerts()
        try {
            const { data } = await axios.get(`/github/repos/${repoFullName}/branches`)

            if (typeof data === "string" && !isJSON(data)) {
                state.warning = "No data retrieved from GitHub. Was this GitHub App uninstalled?"

                return
            }
            if (Array.isArray(data) && data.length > 0) {
                if (["Expired", "Revoked", "Forbidden"].includes(data?.err)) {
                    state.error = data.err

                    return setTimeout(router.push('/logout'), 2000)
                }
                state.success = "Refreshed GitHub repositories"
                for (const branch of data.branches) {
                    for (const app of state.apps) {
                        let isMatch = false
                        let matchedRepo;
                        for (const repo of app.repos) {
                            if (repo.fullName === branch.fullName) {
                                matchedRepo = Object.assign(repo, branch)
                                if (repo.branch === branch.branch) {
                                    repo.latestCommitSHA = branch.latestCommitSHA
                                    isMatch = true
                                    break
                                }
                            }
                        }
                        if (!isMatch && matchedRepo) {
                            app.repos.push(matchedRepo)
                        }
                    }
                }

                return
            }
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
        }
        state.warning = "No data retrieved from GitHub. Is this GitHub App uninstalled?"
    }
}
function installApp() {
    location.href = 'https://github.com/apps/triage-by-trivial-security/installations/new/'
}

function clearAlerts() {
    state.error = ''
    state.warning = ''
    state.success = ''
}

const gh = reactive(new GitHub())
</script>

<template>
    <VRow>
        <VCol cols="12">
            <VAlert
                v-if="state.error"
                color="error"
                icon="$error"
                title="Error"
                :text="state.error"
                border="start"
                variant="tonal"
            />
            <VAlert
                v-if="state.warning"
                color="warning"
                icon="$warning"
                title="Warning"
                :text="state.warning"
                border="start"
                variant="tonal"
            />
            <VAlert
                v-if="state.success"
                color="success"
                icon="$success"
                title="Success"
                :text="state.success"
                border="start"
                variant="tonal"
            />
        </VCol>
        <VCol cols="12">
            <VEmptyState
                v-if="!state.installs && !state.loading"
                :image="state.octodexImageUrl"
            >
                <template #actions>
                    <VBtn
                        text="Install"
                        prepend-icon="line-md:github-loop"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="installApp"
                    />
                </template>
            </VEmptyState>
            <VCard
                v-if="state.installs || state.loading"
                title="Repositories"
            >
                <VCardText>
                    <VBtn
                        text="Install another GitHub Account"
                        prepend-icon="line-md:github-loop"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="installApp"
                    />
                    <VBtn
                        text="Refresh Repositories"
                        prepend-icon="mdi-refresh"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        :disabled="state.loading"
                        @click="gh.refreshRepos"
                    />
                </VCardText>
                <VSkeletonLoader
                    v-if="state.loading"
                    type="table"
                />
                <VTable
                    v-else
                    height="80%"
                    fixed-header
                >
                    <thead>
                        <tr>
                            <th
                                colspan="2"
                                class="text-uppercase"
                            >
                                Repository
                            </th>
                            <th>
                                Branch
                            </th>
                            <th>
                                Visibility
                            </th>
                            <th>
                                Latest Commit
                            </th>
                            <th>
                                Pushed
                            </th>
                            <th>
                                dotfile
                            </th>
                            <th>
                                Installation ID
                            </th>
                            <th>
                                Installed Date
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <template
                            v-for="item in state.apps"
                            :key="item.installationId"
                        >
                            <tr
                                v-for="repo in item.repos"
                                :key="repo.latestCommitSHA"
                            >
                                <td>
                                    <img
                                        v-if="repo.avatarUrl"
                                        width="25"
                                        :src="repo.avatarUrl"
                                    >
                                </td>
                                <td :title="new Date(repo.createdAt).toLocaleDateString()">
                                    <VBtn
                                        title="Refresh Branches"
                                        icon="mdi-refresh"
                                        variant="plain"
                                        color="rgb(26, 187, 156)"
                                        @click="gh.refreshBranches(repo.fullName)"
                                    />
                                    {{ repo.fullName }}
                                </td>
                                <td class="text-center">
                                    <VBtn
                                        title="Refresh all branch metadata"
                                        icon="mdi-refresh"
                                        variant="plain"
                                        color="rgb(26, 187, 156)"
                                        @click="gh.refreshBranch(repo.fullName)"
                                    />
                                    {{ repo.branch }}<span v-if="repo.branch === repo.defaultBranch"> (default)</span>
                                </td>
                                <td class="text-center">
                                    {{ repo.visibility }}
                                </td>
                                <td class="text-center">
                                    <VBtn
                                        v-if="repo?.latestCommitSHA"
                                        title="Check Latest Commit"
                                        icon="mdi-refresh"
                                        variant="plain"
                                        color="rgb(26, 187, 156)"
                                        @click="gh.refreshLatestCommit(repo.fullName, repo.branch)"
                                    />
                                    <span
                                        class="ms-1"
                                        v-if="repo?.latestCommitMessage"
                                        :title="repo?.latestCommitSHA"
                                    >
                                        {{ repo.latestCommitMessage }}
                                    </span>
                                    <span v-else-if="repo?.latestCommitSHA">
                                        {{ repo.latestCommitSHA }}
                                    </span>
                                    <span v-else>
                                        <VBtn
                                            text="Check"
                                            prepend-icon="ph:git-commit-duotone"
                                            variant="plain"
                                            color="rgb(26, 187, 156)"
                                            @click="gh.refreshLatestCommit(repo.fullName, repo.branch)"
                                        />
                                    </span>
                                </td>
                                <td class="text-center">
                                    {{ new Date(repo.pushedAt).toLocaleDateString() }}
                                </td>
                                <td
                                    class="text-center"
                                    :title="repo?.dotfileContents"
                                >
                                    <span
                                        class="ms-1"
                                        v-if="repo?.dotfileExists"
                                    >
                                        <VBtn
                                            title="Check dotfile contents"
                                            icon="mdi-refresh"
                                            variant="plain"
                                            color="rgb(26, 187, 156)"
                                            @click="gh.refreshDotfile(repo.fullName, repo.branch)"
                                        />
                                        {{ repo.dotfileExists }}
                                    </span>
                                    <VBtn
                                        v-else
                                        text="Check"
                                        prepend-icon="ph:git-commit-duotone"
                                        variant="plain"
                                        color="rgb(26, 187, 156)"
                                        @click="gh.refreshDotfile(repo.fullName, repo.branch)"
                                    />
                                </td>
                                <td>
                                    {{ item.installationId }}
                                </td>
                                <td class="text-end">
                                    {{ new Date(item.created).toLocaleDateString() }}
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </VTable>
            </VCard>
        </VCol>
    </VRow>
</template>

<style lang="scss" scoped>
.v-btn {
    text-transform: none;
}
</style>
