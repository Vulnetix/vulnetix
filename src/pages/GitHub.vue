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
  info: "",
  loading: false,
  octodexImageUrl: `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`,
  githubApps: [],
  gitRepos: [],
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
        state.warning = cached === true ? "No cached data. Have you tried to install the GitHub App?" : "No data retrieved from GitHub. Was this GitHub App uninstalled?"
        state.octodexImageUrl = `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`

        return
      }
      if (["Expired", "Revoked", "Forbidden"].includes(data?.err)) {
        state.error = data.err

        return setTimeout(router.push('/logout'), 2000)
      }
      if (data.gitRepos.length === 0) {
        state.error = "No data retrieved from GitHub. Is this GitHub App installed?"
        state.warning = "Please check the GitHub App permissions, they may have been revoked or uninstalled."
      } else {
        state.githubApps = data.githubApps
        state.gitRepos = data.gitRepos.map(r => {
          if (!r.branch) {
            r.branch = r.defaultBranch
          }
          return r
        })
        if (cached === true) {
          state.info = "Loaded cached GitHub repositories"
        } else {
          state.success = "Refreshed GitHub repositories"
        }
      }

      return
    } catch (e) {
      console.error(e)
      state.error = `${e.code} ${e.message}`
    }
    state.warning = "No data retrieved from GitHub. Is this GitHub App uninstalled?"
    state.octodexImageUrl = `https://octodex.github.com/images/${octodex[Math.floor(Math.random() * octodex.length)]}`
    state.loading = false
  }
  async refreshBranches(repoFullName) {
    clearAlerts()
    try {
      const { data } = await axios.get(`/github/repos/${repoFullName}/branches`)

      if (typeof data === "string" && !isJSON(data)) {
        state.warning = "No data retrieved from GitHub. Was this GitHub App uninstalled?"

        return
      }
      if (["Expired", "Revoked", "Forbidden"].includes(data?.err)) {
        state.error = data.err

        return setTimeout(router.push('/logout'), 2000)
      }
      state.success = "Refreshed GitHub repositories"
      for (const branch of data.branches) {
        let isMatch = false
        let matchedRepo
        for (const repo of state.gitRepos) {
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
          state.gitRepos.push(matchedRepo)
        }
      }

      return
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
  state.info = ''
}

function groupedRepos() {
  return state.gitRepos.reduce((acc, repo) => {
    const [orgName, repoName] = repo.fullName.split('/')
    let group = acc.find(group => group.orgName === orgName)

    if (!group) {
      group = {
        orgName: orgName,
        avatarUrl: repo.avatarUrl,
        repos: []
      };
      acc.push(group)
    }
    group.repos.push({ ...repo, orgName, repoName })
    return acc
  }, [])
}

const gh = reactive(new GitHub())
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VAlert v-if="state.error" color="error" icon="$error" title="Error" :text="state.error" border="start"
        variant="tonal" />
      <VAlert v-if="state.warning" color="warning" icon="$warning" title="Warning" :text="state.warning" border="start"
        variant="tonal" />
      <VAlert v-if="state.success" color="success" icon="$success" title="Success" :text="state.success" border="start"
        variant="tonal" />
      <VAlert v-if="state.info" color="info" icon="$info" title="Information" :text="state.info" border="start"
        variant="tonal" />
    </VCol>
    <VCol cols="12">

      <VEmptyState v-if="!state.gitRepos.length && !state.loading" :image="state.octodexImageUrl">
        <template #actions>
          <VBtn text="Install" prepend-icon="line-md:github-loop" variant="text"
            :color="global.name.value === 'dark' ? '#fff' : '#272727'" @click="installApp" />
        </template>
      </VEmptyState>

      <VCard v-if="state.githubApps.length || state.loading" title="Repositories">
        <VCardText>
          <VBtn text="Install another GitHub Account" prepend-icon="line-md:github-loop" variant="text"
            :color="global.name.value === 'dark' ? '#fff' : '#272727'" @click="installApp" />
          <VBtn text="Refresh Repositories" prepend-icon="mdi-refresh" variant="text"
            :color="global.name.value === 'dark' ? '#fff' : '#272727'" :disabled="state.loading"
            @click="gh.refreshRepos" />
        </VCardText>
        <v-expansion-panels accordion>
          <v-expansion-panel v-for="(group, k) in groupedRepos()" :key="k">
            <v-expansion-panel-title class="text-subtitle-1">
              <img :src="group.avatarUrl" width="25" class="me-3">{{ group.orgName }} ({{ group.repos.length }}
              repositories)
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <VSkeletonLoader v-if="state.loading" type="table" />
              <VTable v-else height="20rem" fixed-header>
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
                      Fork
                    </th>
                    <th>
                      Archived
                    </th>
                    <th>
                      Template
                    </th>
                    <th>
                      License
                    </th>
                    <th>
                      Last Pushed
                    </th>
                    <th>
                      Created Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="(repo, i) in group.repos" :key="i">
                    <td :title="new Date(repo.createdAt).toLocaleDateString()">
                      <VBtn title="Refresh Branches" icon="mdi-refresh" variant="plain" color="rgb(26, 187, 156)"
                        @click="gh.refreshBranches(repo.fullName)" />
                      {{ repo.repoName }}
                    </td>
                    <td class="text-center">
                      {{ repo.branch }}<span v-if="repo.branch === repo.defaultBranch"> (default)</span>
                    </td>
                    <td class="text-center">
                      {{ repo.visibility }}
                    </td>
                    <td class="text-center">
                      {{ repo.fork ? "Forked" : "Source" }}
                    </td>
                    <td class="text-center">
                      {{ repo.archived ? "Archived" : "Active" }}
                    </td>
                    <td class="text-center">
                      {{ repo.template ? "Template" : "Code" }}
                    </td>
                    <td class="text-center" :title="repo.licenseSpdxId">
                      {{ repo.licenseName }}
                    </td>
                    <td class="text-center">
                      {{ new Date(repo.pushedAt).toLocaleDateString() }}
                    </td>
                    <td class="text-end">
                      {{ new Date(repo.createdAt).toLocaleDateString() }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </VCard>

    </VCol>
  </VRow>
</template>

<style lang="scss" scoped>
.VBtn {
  text-transform: none;
}
</style>
