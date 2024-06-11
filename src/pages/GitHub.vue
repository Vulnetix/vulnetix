<script setup>
import axios from 'axios';
import { useTheme } from 'vuetify';

const { global } = useTheme()

const integrations = []
const urlQuery = Object.fromEntries(location.search.substring(1).split('&').map(item => item.split('=').map(decodeURIComponent)))
if (urlQuery?.setup_action === 'install') {
    console.log('urlQuery', urlQuery)
    if (urlQuery?.code && urlQuery?.installation_id) {
        axios.get(`/github/install/${urlQuery.installation_id}/${urlQuery.code}`)
            .then(console.log)
            .catch(console.log)
    }
}

const install = () => {
    location.href = 'https://github.com/apps/trivial-triage/installations/new/'
}
</script>

<template>
    <VRow>
        <VCol cols="12">
            <VCard title="GitHub">
                <VCardText>
                    <VBtn text="Connect to GitHub" prepend-icon="mdi-github" variant="text"
                        :color="global.name.value === 'dark' ? '#fff' : '#272727'" @click="install" />
                </VCardText>
                <VTable height="80%" fixed-header>
                    <thead>
                        <tr>
                            <th class="text-uppercase">
                                Repository
                            </th>
                            <th>
                                Public
                            </th>
                            <th>
                                Target
                            </th>
                            <th>
                                Type
                            </th>
                            <th>
                                Dependency count
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="item in integrations" :key="item.uuid">
                            <td>
                                {{ item.repo }}
                            </td>
                            <td class="text-center">
                                {{ item.visibility }}
                            </td>
                            <td class="text-center">
                                {{ item.target }}
                            </td>
                            <td class="text-center">
                                {{ item.type }}
                            </td>
                            <td class="text-center">
                                {{ item.Dependencies.length }}
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCard>
        </VCol>
    </VRow>
</template>
