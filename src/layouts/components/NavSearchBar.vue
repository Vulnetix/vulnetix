<script setup>
import { Client } from '@/utils';

const client = new Client()

defineOptions({ inheritAttrs: false })

// 👉 Is App Search Bar Visible
const isAppSearchBarVisible = ref(false)

// 👉 Default suggestions
const suggestionGroups = [
  {
    title: 'Popular Pages',
    content: [
      {
        icon: 'bx-home',
        title: 'Dashboard',
        link: '/dashboard',
      },
      {
        icon: 'eos-icons:file-system-outlined',
        title: 'Artifacts',
        link: '/artifacts',
      },
      {
        icon: 'pajamas:project',
        title: 'Projects',
        link: '/projects',
      },
      {
        icon: 'mdi-clipboard-text-history',
        title: 'Triage History',
        link: '/triage/history',
      },
    ],
  }
]

const noDataSuggestions = [
  {
    title: 'CVE-2024-9680 CVE-2021-44228'
  },
  {
    title: 'log4j OR log4shell',
  },
  {
    title: '"CSRF token"',
  },
]

const resolveCategories = val => {
  if (val === 'dashboards')
    return 'Dashboards'
  if (val === 'appsPages')
    return 'Apps & Pages'
  if (val === 'userInterface')
    return 'User Interface'
  if (val === 'formsTables')
    return 'Forms Tables'
  if (val === 'chartsMisc')
    return 'Charts Misc'

  return 'Misc'
}

const searchQuery = ref('')
const searchResult = ref([])
const router = useRouter()

watchEffect(async () => {
  const { data } = await client.get(`/search?q=${encodeURIComponent(searchQuery.value)}`)
  console.log(data)
})

const redirectToSuggestedOrSearchedPage = selected => {
  router.push(selected.url)
  isAppSearchBarVisible.value = false
  searchQuery.value = ''
}

const LazyAppBarSearch = defineAsyncComponent(() => import('@core/components/AppBarSearch.vue'))
</script>

<template>
  <div
    class="d-flex align-center cursor-pointer"
    v-bind="$attrs"
    @click="isAppSearchBarVisible = !isAppSearchBarVisible"
  >
    <VBtn
      icon
      variant="text"
      color="default"
      size="small"
    >
      <VIcon
        icon="tabler-search"
        size="24"
      />
    </VBtn>

    <span class="d-none d-md-flex align-center text-disabled">
      <span class="me-3">Search</span>
      <span class="meta-key">&#8984;K</span>
    </span>
  </div>

  <!-- 👉 App Bar Search -->
  <LazyAppBarSearch
    v-model:isDialogVisible="isAppSearchBarVisible"
    v-model:search-query="searchQuery"
    :search-results="searchResult"
    :suggestions="suggestionGroups"
    :no-data-suggestion="noDataSuggestions"
    :resolve-categories="resolveCategories"
    @item-selected="redirectToSuggestedOrSearchedPage"
  >
    <!--
      <template #suggestions>
      use this slot if you want to override default suggestions
      </template>
-->

    <!--
      <template #noData>
      use this slot to change the view of no data section
      </template>
    -->

    <!--
      <template #searchResult="{ item }">
      use this slot to change the search item
      </template>
    -->
  </LazyAppBarSearch>
</template>

<style lang="scss" scoped>
@use "@styles/variables/_vuetify.scss";

.meta-key {
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: vuetify.$card-border-radius;
  block-size: 1.5625rem;
  line-height: 1.3125rem;
  padding-block: 0.125rem;
  padding-inline: 0.25rem;
}
</style>
