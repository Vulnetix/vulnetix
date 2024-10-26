<script setup>
import { Client } from '@/utils';
import { watchEffect } from 'vue';

const client = new Client()
const router = useRouter()

defineOptions({ inheritAttrs: false })

const suggestionGroups = [
    {
        title: 'Quick Links',
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
        title: 'log4j NOT log4shell',
    },
    {
        title: '"CSRF token"',
    },
]

const initialState = {
    searchQuery: '',
    isAppSearchBarVisible: false,
    searchResults: [],
}
const state = reactive({
    ...initialState,
})
watchEffect(async () => {
    if (!state.searchQuery) {
        return
    }
    state.searchResults.splice(0)
    const { data } = await client.get(`/search?q=${encodeURIComponent(state.searchQuery)}`)
    if (data?.results?.findings) {
        const findings = []
        for (const finding of data.results.findings) {
            findings.push({
                title: finding.detectionTitle,
                text: `${finding?.purl} (${finding?.aliases?.join(" ")} ${finding?.cwes?.join(" ")})`,
                link: `/issue/${finding.uuid}`,
            })
        }
        if (findings) {
            state.searchResults.push({ header: true, title: 'Issues' })
            findings.forEach(f => state.searchResults.push(f))
        }
        const boms = []
        for (const finding of data.results.findings) {
            if (finding?.spdx?.artifact?.downloadLinks) {
                for (const link of finding.spdx.artifact.downloadLinks) {
                    boms.push({
                        title: finding.spdx.spdxVersion,
                        text: `${finding.spdx.name} (${finding.spdx.packagesCount} dependencies)`,
                        link: link.url,
                    })
                }
            }
            if (finding?.cdx?.artifact?.downloadLinks) {
                for (const link of finding.cdx.artifact.downloadLinks) {
                    boms.push({
                        title: `CycloneDX ${finding.cdx.cdxVersion}`,
                        text: `${finding.cdx.name} (${finding.cdx.dependenciesCount} dependencies)`,
                        link: link.url,
                    })
                }
            }
        }
        if (boms) {
            state.searchResults.push({ header: true, title: 'Bills of Materials' })
            boms.forEach(f => state.searchResults.push(f))
        }
    }
})

const redirectToSuggestedOrSearchedPage = selected => {
    router.push(selected.url)
    state.isAppSearchBarVisible = false
    state.searchQuery = ''
}

const LazyAppBarSearch = defineAsyncComponent(() => import('@core/components/AppBarSearch.vue'))
</script>

<template>
    <div
        class="d-flex align-center cursor-pointer"
        v-bind="$attrs"
        @click="state.isAppSearchBarVisible = !state.isAppSearchBarVisible"
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
        v-model:isDialogVisible="state.isAppSearchBarVisible"
        v-model:search-query="state.searchQuery"
        :search-results="state.searchResults"
        :suggestions="suggestionGroups"
        :no-data-suggestion="noDataSuggestions"
        @item-selected="redirectToSuggestedOrSearchedPage"
    >
        <template v-slot:searchResult="{ item }">
            <VListItem link>
                <VIcon
                    v-if="item?.icon"
                    size="20"
                    :icon="item.icon"
                    class="me-3"
                />
                <VListItemTitle>
                    <div
                        v-if="item?.title"
                        class="text-h5"
                    >
                        {{ item.title }}
                    </div>
                    <RouterLink
                        class="text-base"
                        v-if="item?.link"
                        :to="item?.link"
                    >
                        {{ item.text }}
                    </RouterLink>
                    <span v-else>
                        {{ item.text }}
                    </span>
                </VListItemTitle>
                <VIcon
                    size="20"
                    icon="tabler-corner-down-left"
                    class="enter-icon text-disabled"
                />
            </VListItem>
        </template>
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
