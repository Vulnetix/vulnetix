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
  success: "",
  info: "",
  loading: false,
  results: [],
}

const state = reactive({
  ...initialState,
})

axios.defaults.headers.common = {
  'x-trivialsec': localStorage.getItem('/session/token') || '',
}
class Sarif {
  constructor() {
    this.refresh()
  }

  async refresh() {
    clearAlerts()
    try {
      const { data } = await axios.get(`/sarif/results`)

      if (typeof data === "string" && !isJSON(data)) {
        state.warning = "No data retrieved from GitHub. Was this GitHub App uninstalled?"

        return
      }
      if (data?.err) {
        state.error = data.err
      }
      if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
        state.info = data.result

        return setTimeout(router.push('/logout'), 2000)
      }
      if (!data.sarif) {
        state.info = "No SARIF data available."
      } else {
        state.results = data.sarif
        state.success = "Refreshed SARIF"
      }

      return
    } catch (e) {
      console.error(e)
      state.error = `${e.code} ${e.message}`
    }
    state.warning = "No SARIF data available."
  }
}

function clearAlerts() {
  state.error = ''
  state.warning = ''
  state.success = ''
  state.info = ''
}

function groupedByOrg() {
  return state.results.reduce((acc, sarif) => {
    const [orgName, repoName] = sarif.fullName.split('/')
    let group = acc.find(group => group.orgName === orgName)

    if (!group) {
      group = {
        orgName: orgName,
        avatarUrl: sarif?.repo?.avatarUrl,
        sarif: []
      };
      acc.push(group)
    }
    group.sarif.push({ ...sarif, orgName, repoName })
    return acc
  }, [])
}

const sarif = reactive(new Sarif())
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
      <VAlert
        v-if="state.info"
        color="info"
        icon="$info"
        title="Information"
        :text="state.info"
        border="start"
        variant="tonal"
      />
    </VCol>
    <VCol cols="12">
      <VCard
        v-if="state.results.length || state.loading"
        title="SARIF"
      >
        <VCardText>
          <VBtn
            text="Refresh"
            prepend-icon="mdi-refresh"
            variant="text"
            :color="global.name.value === 'dark' ? '#fff' : '#272727'"
            :disabled="state.loading"
            @click="sarif.refresh"
          />
        </VCardText>
        <v-expansion-panels accordion>
          <v-expansion-panel
            v-for="(group, k) in groupedByOrg()"
            :key="k"
          >
            <v-expansion-panel-title class="text-subtitle-1">
              <img
                :src="group.avatarUrl"
                width="25"
                class="me-3"
              >{{ group.orgName }} ({{ group.sarif.length }} results)
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <VSkeletonLoader
                v-if="state.loading"
                type="table"
              />
              <VTable
                v-else
                height="20rem"
                fixed-header
              >
                <thead>
                  <tr>
                    <th class="text-uppercase">
                      Repository
                    </th>
                    <th>
                      Ref
                    </th>
                    <th>
                      Findings
                    </th>
                    <th>
                      Rules Count
                    </th>
                    <th>
                      Tool
                    </th>
                    <th>
                      Commit SHA
                    </th>
                    <th>
                      Reports
                    </th>
                    <th>
                      Created Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="(result, i) in group.sarif"
                    :key="i"
                  >
                    <td>
                      {{ result.repoName }}
                    </td>
                    <td class="text-center">
                      {{ result.ref }}
                    </td>
                    <td class="text-center">
                      {{ result.resultsCount }}
                    </td>
                    <td class="text-center">
                      {{ result.rulesCount }}
                    </td>
                    <td class="text-center">
                      {{ result.toolName }} {{ result.toolVersion }}
                    </td>
                    <td class="text-center">
                      {{ result.commitSha }}
                    </td>
                    <td class="text-center">
                      {{ result.results.length }}
                    </td>
                    <td class="text-center">
                      {{ new Date(result.createdAt).toLocaleDateString() }}
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
