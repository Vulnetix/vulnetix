<script setup>
import { useTheme } from 'vuetify';
const { global } = useTheme()

const integrations = []

const redirect = () => {
  location.href = 'https://github.com/apps/trivial-triage/installations/new/'
}
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard title="GitHub">
        <VCardText>
          <VBtn
                text="Connect to GitHub"
                prepend-icon="mdi-github"
                variant="text"
                :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                @click="redirect"
              />
        </VCardText>
        <VTable
          height="80%"
          fixed-header
        >
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
            <tr
              v-for="item in integrations"
              :key="item.uuid"
            >
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
