<script setup>
import router from "@/router";
import { Client, isCDX, isJSON, timeAgo } from '@/utils';
import { reactive } from 'vue';
import { useTheme } from 'vuetify';

const client = new Client()
const { global } = useTheme()

const initialState = {
  uploadError: "",
  uploadSuccess: "",
  error: "",
  warning: "",
  success: "",
  info: "",
  loading: false,
  files: [],
  uploads: [],
}

const state = reactive({
  ...initialState,
})

class Controller {
  constructor() {
    this.refresh(true)
  }

  async refresh(initial = false) {
    clearAlerts()
    state.loading = true
    try {
      const pageSize = 50
      let hasMore = true
      let skip = 0
      while (hasMore) {
        const { data } = await client.get(`/cdx/results?take=${pageSize}&skip=${skip}`)
        if (data.ok) {
          if (data?.cdx) {
            data.cdx.filter(item => item.source === "upload").forEach(cdx => state.uploads.push(cdx))
          }
        } else if (typeof data === "string" && !isJSON(data)) {
          if (initial !== true) {
            state.warning = "CycloneDX data could not be retrieved, please try again later."
          }
          break
        } else if (data?.error?.message) {
          state.loading = false
          state.error = data.error.message
          return
        } else if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
          state.loading = false
          state.info = data.result
          setTimeout(() => router.push('/logout'), 2000)
          return
        } else {
          if (initial !== true) {
            state.info = "No CycloneDX data available."
          }
          break
        }
        if (data.spdx.length < pageSize) {
          hasMore = false
          if (initial !== true) {
            state.info = "Refreshed CycloneDX"
          }
        } else {
          skip += pageSize
        }
      }
      state.loading = false

      return
    } catch (e) {
      console.error(e)
      if (initial !== true) {
        state.error = `${e.code} ${e.message}`
      }
      state.loading = false
    }
    if (initial !== true) {
      state.warning = "No CycloneDX data available."
    }
  }

  async upload() {
    clearAlerts()
    const files = []
    try {
      for (const blob of state.files) {
        const text = await blob.text()
        if (!isCDX(text)) {
          state.uploadError = "Provided file does not include CycloneDX required fields."
          break
        }
        files.push(JSON.parse(text))
      }
      if (!files.length) {
        state.uploadError = state.uploadError ? state.uploadError : "No CycloneDX files were provided."
        return
      }
      state.loading = true
      const { data } = await client.post(`/cdx/upload`, files)
      state.loading = false

      if (data?.error?.message) {
        state.uploadError = data?.error?.message
      }
      if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
        state.uploadError = data.result

        // return setTimeout(() => router.push('/logout'), 2000)
      }
      if (typeof data === "string" && !isJSON(data)) {
        state.uploadError = "CycloneDX data could not be uploaded, please try again later."

        return
      }
      if (!data?.files?.length) {
        state.uploadError = "No CycloneDX data available."
      } else {
        for (const file of data.files) {
          if (file.source === "upload" && !state.uploads.some(f => f.cdxId === file.cdxId)) {
            state.uploads.push(file)
          }
        }
        state.uploadSuccess = "Uploaded CycloneDX, you may close this dialogue now."
      }

      return
    } catch (e) {
      console.error(e)
      state.uploadError = typeof e === "string" ? e : `${e.code} ${e.message}`
      state.loading = false
    }
  }
}

function clearAlerts() {
  state.uploadError = ''
  state.uploadSuccess = ''
  state.error = ''
  state.warning = ''
  state.success = ''
  state.info = ''
}

const controller = reactive(new Controller())
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
      <VBtn
        text="Refresh"
        prepend-icon="mdi-refresh"
        variant="text"
        :color="global.name.value === 'dark' ? '#fff' : '#272727'"
        :disabled="state.loading"
        @click="controller.refresh"
      />
      <VDialog
        width="50%"
        persistent
      >
        <template v-slot:activator="{ props: activatorProps }">
          <VBtn
            class="text-right"
            prepend-icon="mdi-upload"
            text="Upload CycloneDX"
            variant="text"
            :color="global.name.value === 'dark' ? '#fff' : '#272727'"
            v-bind="activatorProps"
          />
        </template>
        <template v-slot:default="{ isActive }">
          <VCard title="Select CycloneDX files">
            <VProgressLinear
              :active="state.loading"
              :indeterminate="state.loading"
              color="primary"
              absolute
              bottom
            ></VProgressLinear>
            <VAlert
              v-if="state.uploadError"
              color="error"
              icon="$error"
              title="Error"
              :text="state.uploadError"
              border="start"
              variant="tonal"
            />
            <VAlert
              v-if="state.uploadSuccess"
              color="success"
              icon="$success"
              title="Success"
              :text="state.uploadSuccess"
              border="start"
              variant="tonal"
            />
            <VDivider class="mt-3"></VDivider>
            <VCardText class="px-4">
              <VFileInput
                v-model="state.files"
                :show-size="1000"
                accept="application/json"
                label="File input"
                placeholder="Select your files"
                prepend-icon="mdi-paperclip"
                variant="outlined"
                counter
                multiple
              >
                <template v-slot:selection="{ fileNames }">
                  <template
                    v-for="(fileName, index) in fileNames"
                    :key="fileName"
                  >
                    <VChip
                      v-if="index < 2"
                      class="me-2"
                      size="small"
                      label
                    >
                      {{ fileName }}
                    </VChip>

                    <span
                      v-else-if="index === 2"
                      class="text-overline text-grey-darken-3 mx-2"
                    >
                      +{{ state.files.length - 2 }} File(s)
                    </span>
                  </template>
                </template>
              </VFileInput>
            </VCardText>
            <VDivider></VDivider>
            <VCardActions class="mt-3">
              <VBtn
                text="Close"
                @click="isActive.value = false"
              />
              <VSpacer></VSpacer>
              <VBtn
                text="Upload"
                variant="flat"
                @click="controller.upload"
              />
            </VCardActions>
          </VCard>
        </template>
      </VDialog>
    </VCol>
    <VCol
      cols="12"
      v-if="state.uploads.length || state.loading"
    >
      <VCard
        title="Uploads"
        prepend-icon="uil-file-upload"
      >
        <VSkeletonLoader
          v-if="state.loading"
          type="table-row@10"
        />
        <VTable
          v-else
          height="20rem"
          fixed-header
        >
          <thead>
            <tr>
              <th class="text-uppercase">
                File
              </th>
              <th>
                CycloneDX Version
              </th>
              <th>
                Component Name
              </th>
              <th>
                Component Version
              </th>
              <th>
                Tool
              </th>
              <th>
                Packages
              </th>
              <th>
                Created Date
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(cdx, k) in state.uploads"
              :key="k"
            >
              <td>
                <VTooltip
                  activator="parent"
                  location="top"
                >{{ cdx.cdxId }}</VTooltip>
                <img
                  src="/cyclonedx-logo.png"
                  width="25"
                  height="25"
                  class="mr-2"
                >
                {{ cdx.cdxId }}.json
              </td>
              <td class="text-center">
                {{ cdx.cdxVersion }}
              </td>
              <td class="text-center">
                {{ cdx.name }}
              </td>
              <td class="text-center">
                {{ cdx.version }}
              </td>
              <td class="text-center">
                {{ cdx.toolName }}
              </td>
              <td class="text-center">
                {{ cdx.componentsCount }}
              </td>
              <td class="text-center">
                <VTooltip
                  :text="(new Date(cdx.createdAt)).toLocaleString()"
                  location="left"
                >
                  <template v-slot:activator="{ props }">
                    <time
                      v-bind="props"
                      :datetime="(new Date(cdx.createdAt)).toISOString()"
                    >
                      {{ timeAgo(new Date(cdx.createdAt)) }}
                    </time>
                  </template>
                </VTooltip>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </VCol>
  </VRow>
</template>
