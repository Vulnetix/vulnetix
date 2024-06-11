<script setup>
import { useTheme } from 'vuetify'

const { global } = useTheme()

const integrations = []
const urlQuery = Object.fromEntries(location.search.substring(1).split('&').map(item => item.split('=').map(decodeURIComponent)))
if (urlQuery?.setup_action === 'install') {
    console.log('urlQuery', urlQuery)
    if (urlQuery?.code) {
        const url = new URL("https://github.com/login/oauth/access_token")
        url.search = new URLSearchParams({
            code: urlQuery.code,
            client_id: 'Iv23liW5R5lkjMRgFrWI',
            client_secret: '33e8e3bd7c04a4d2bf0a80b8c2d970c8056df085'
        }).toString()
        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
        })
            .then(console.log)
            .catch(console.log)
    }
}

// /github-integration?code=c1ed5cbf17e7a98da805&installation_id=51710144&setup_action=install
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
