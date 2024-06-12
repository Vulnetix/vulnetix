<script setup>
import axios from 'axios';
import { reactive } from 'vue';
import { useTheme } from 'vuetify';
import { isJSON } from '../utils';

const { global } = useTheme()

axios.defaults.headers.common = {
    'x-trivialsec': localStorage.getItem('/session/token') || ''
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
        console.log('loading')
        const { data } = await axios.get('/github/repos')
        console.log('data', data)
        if (isJSON(data)) {
            localStorage.setItem('/github/repos', JSON.stringify(data))
            this.repos = data
            this.cached = false
        }
    }
}
const gh = reactive(new GitHub())
</script>

<template>
    <VRow>
        <VCol cols="12">
            <VCard title="GitHub">
                <VCardText>
                    <VBtn text="Connect to GitHub" prepend-icon="mdi-github" variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'" v-if="gh.repos.length === 0"
                        @click="gh.integrate" />
                    <VBtn text="Refresh" prepend-icon="mdi-github" variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'" v-else @click="gh.refresh" />
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
                                <img :src="item.avatarUrl" class="mr-1" v-if="item.avatarUrl" />
                                {{ item.latestCommitMessage }}
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
