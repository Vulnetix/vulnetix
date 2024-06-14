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
    cached: false,
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
        } else if (!state.cached) {
            this.refresh()
        }
    }
    async install(code, installation_id) {
        const { data } = await axios.get(`/github/install/${installation_id}/${code}`)

        console.log(data)
        this.refresh()

        return setTimeout(state.success = "GitHub App installed successfully.", 1000)
    }
    async refresh() {
        clearAlerts()
        state.loading = true
        try {
            const { data } = await axios.get('/github/repos')

            state.loading = false
            if (typeof data === "string" && !isJSON(data)) {
                state.warning = state.cached ? "No data retrieved from GitHub. Was this GitHub App uninstalled?" : "No cached data. Have you tried to install the GitHub App?"
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
                    state.error = "No data retrieved from GitHub. Is this GitHub App uninstalled?"
                    state.warning = "Please check the GitHub App permissions, they may have been revoked or uninstalled."
                    state.cached = false
                } else {
                    state.apps = data
                    state.success = "Refreshed GitHub repositories"
                    localStorage.setItem('/github/installs', JSON.stringify(data))
                    state.cached = true
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
}
function installApp() {
    location.href = 'https://github.com/apps/triage-by-trivial-security/installations/new/'
}

function clearAlerts() {
    state.error = ''
    state.warning = ''
    state.success = ''
}

function loadCached() {
    clearAlerts()
    const stored = localStorage.getItem('/github/installs')
    state.apps = isJSON(stored) ? JSON.parse(stored) : []
    state.installs = state.apps.length > 0
    state.cached = state.apps.map(i => i.repos.length).reduce((a, b) => a + b, 0) > 0
}
loadCached()

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
                <template #title>
                    <div class="text-subtitle-1 mt-8">
                        GitHub Repositories
                    </div>
                </template>

                <template #actions>
                    <VBtn
                        text="Install GitHub App"
                        prepend-icon="line-md:github-loop"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="installApp"
                    />
                    <VBtn
                        v-if="state.cached"
                        text="Show Cached Repositories"
                        prepend-icon="line-md:downloading-loop"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="loadCached"
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
                        @click="gh.refresh"
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
                                    {{ repo.fullName }}
                                </td>
                                <td class="text-center">
                                    {{ repo.branch }}<span v-if="repo.branch === repo.defaultBranch"> (default)</span>
                                </td>
                                <td class="text-center">
                                    {{ repo.visibility }}
                                </td>
                                <td
                                    class="text-center"
                                    :title="repo.latestCommitSHA"
                                >
                                    <span class="ms-1">{{ repo.latestCommitMessage }}</span>
                                </td>
                                <td class="text-center">
                                    {{ new Date(repo.pushedAt).toLocaleDateString() }}
                                </td>
                                <td
                                    class="text-center"
                                    :title="repo.dotfileContents"
                                >
                                    {{ repo.dotfileExists }}
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
