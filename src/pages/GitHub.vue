<script setup>
import { default as axios } from 'axios'
import { reactive } from 'vue'
import { useTheme } from 'vuetify'
import router from "../router"
import { isJSON } from '../utils'

const { global } = useTheme()

const initialState = {
    error: "",
    warning: "",
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

        const stored = localStorage.getItem('/github/repos')

        this.repos = stored ? JSON.parse(stored) : []
        if (this.urlQuery?.setup_action === 'install' && this.urlQuery?.code && this.urlQuery?.installation_id) {
            this.install(this.urlQuery.code, this.urlQuery.installation_id)
        }
        if (this.repos.length === 0) {
            this.refresh()
        }
    }
    async install(code, installation_id) {
        const { data } = await axios.get(`/github/install/${installation_id}/${code}`)

        console.log(data)
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
                localStorage.setItem('/github/repos', JSON.stringify(data))
                this.repos = data
                this.cached = false
            } else {
                state.warning = "No data retrieved from GitHub."
            }
        } catch (e) {
            console.error(e)
            state.error = e.code
        }
    }
}
const gh = reactive(new GitHub())
</script>

<template>
    <VRow>
        <VCol cols="12">
            <VAlert v-if="state.error" color="error" icon="$error" title="Server Error" :text="state.error"
                border="start" variant="tonal" closable close-label="Close Alert" />
            <VAlert v-if="state.warning" color="warning" icon="$warning" title="Warning" :text="state.warning"
                border="start" variant="tonal" closable close-label="Close Alert" />
        </VCol>
        <VCol cols="12">
            <VCard title="GitHub">
                <VCardText>
                    <VBtn v-if="gh.repos.length === 0" text="Connect to GitHub" prepend-icon="mdi-github" variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'" @click="gh.integrate" />
                    <VBtn v-else text="Refresh" prepend-icon="mdi-github" variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'" @click="gh.refresh" />
                </VCardText>
                <VTable height="80%" fixed-header>
                    <thead>
                        <tr>
                            <th class="text-uppercase">
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
                                .trivialsec
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="item in gh.repos" :key="item.latestCommitSHA">
                            <td :title="item.createdAt">
                                {{ item.fullName }}
                            </td>
                            <td class="text-center" :title="item.latestCommitSHA">
                                {{ item.branch }}<span v-if="item.branch === item.defaultBranch"> (default)</span>
                            </td>
                            <td class="text-center">
                                {{ item.visibility }}
                            </td>
                            <td class="text-center" :title="item.latestCommitSHA">
                                <img v-if="item.avatarUrl" :src="item.avatarUrl">
                                <span class="ms-1">{{ item.latestCommitMessage }}</span>
                            </td>
                            <td class="text-center">
                                {{ item.pushedAt }}
                            </td>
                            <td class="text-center" :title="item.dotfileContents">
                                {{ item.dotfileExists }}
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCard>
        </VCol>
    </VRow>
</template>
