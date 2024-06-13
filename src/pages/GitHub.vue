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
    loading: true,
    installs: false,
    octodexImageUrl: `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`
}

const state = reactive({
    ...initialState,
})

axios.defaults.headers.common = {
    'x-trivialsec': localStorage.getItem('/session/token') || '',
}

class GitHub {
    constructor() {
        this.cached = true
        this.urlQuery = Object.fromEntries(location.search.substring(1).split('&').map(item => item.split('=').map(decodeURIComponent)))

        const url = new URL(location)

        url.search = ""
        history.pushState({}, "", url)

        const stored = localStorage.getItem('/github/installs')
        this.installs = stored ? JSON.parse(stored) : []

        if (this.urlQuery?.setup_action === 'install' && this.urlQuery?.code && this.urlQuery?.installation_id) {
            this.install(this.urlQuery.code, this.urlQuery.installation_id)
            return
        }
        if (this.installs.length === 0) {
            this.refresh()
        } else {
            this.cached = true
            state.installs = true
        }
    }
    async install(code, installation_id) {
        const { data } = await axios.get(`/github/install/${installation_id}/${code}`)
        console.log(data)
        state.success = "GitHub App installed successfully."
        if (this.installs.length === 0) {
            this.refresh()
        }
    }
    async integrate() {
        location.href = 'https://github.com/apps/triage-by-trivial-security/installations/new/'
    }
    async refresh() {
        try {
            const { data } = await axios.get('/github/repos')
            if (["Expired", "Revoked", "Forbidden"].includes(data?.err)) {
                console.log('data', data)
                state.error = data.err
                router.push('/logout')

                return
            }
            if (isJSON(data)) {
                localStorage.setItem('/github/installs', JSON.stringify(data))
                this.installs = data
                this.cached = false
                if (data.length > 0) {
                    state.installs = true
                    state.success = "Refreshed GitHub repositories"
                    return
                }
            }
            state.error = "No data retrieved from GitHub. Is it still installed?"
            state.warning = "Please check the GitHub App permissions, they may have been revoked or uninstalled."
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
        }
    }
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
                title="Server Error"
                :text="state.error"
                border="start"
                variant="tonal"
                closable
                close-label="Close Alert"
            />
            <VAlert
                v-if="state.warning"
                color="warning"
                icon="$warning"
                title="Warning"
                :text="state.warning"
                border="start"
                variant="tonal"
                closable
                close-label="Close Alert"
            />
        </VCol>
        <VCol cols="12">
            <VEmptyState
                v-if="!state.installs"
                :image="state.octodexImageUrl"
            >
                <template v-slot:title>
                    <div class="text-subtitle-1 mt-8">
                        GitHub Repositories
                    </div>
                </template>

                <template v-slot:actions>
                    <VBtn
                        text="Install GitHub App"
                        prepend-icon="mdi-github"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="gh.integrate"
                    />
                    <VBtn
                        v-if="state.installs"
                        text="Refresh Repositories"
                        prepend-icon="mdi-refresh"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="gh.refresh"
                    />
                </template>
            </VEmptyState>

            <VCard
                title="Repositories"
                v-if="state.installs"
            >
                <VCardText>
                    <VBtn
                        text="Install another GitHub Account"
                        prepend-icon="mdi-github"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="gh.integrate"
                    />
                    <VBtn
                        text="Refresh Repositories"
                        prepend-icon="mdi-refresh"
                        variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                        @click="gh.refresh"
                    />
                </VCardText>
                <VTable
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
                            v-for="item in gh.installs"
                            :key="item.installationId"
                        >
                            <tr
                                v-for="repo in item.repos"
                                :key="repo.latestCommitSHA"
                            >
                                <td>
                                    <img
                                        width="25"
                                        v-if="repo.avatarUrl"
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
