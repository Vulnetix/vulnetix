<script setup>
import { useMemberStore } from '@/stores/member';
import { usePreferencesStore } from '@/stores/preferences';
import { isJSON } from '@/utils';
import { default as axios } from 'axios';
import { reactive } from 'vue';
import router from "../router";

const Member = useMemberStore()
const Preferences = usePreferencesStore()
watch(Preferences, () => localStorage.setItem('/state/preferences/issueFilter', Preferences.issueFilter), { deep: true })
const dialogs = ref({})
const expanded = ref([])
const issueHeadings = [
    { title: 'Discovered', key: 'createdAt', align: 'start' },
    { title: '', key: 'actions', align: 'end' },
]

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
    'x-trivialsec': Member.session?.token,
}
const clearAlerts = () => {
    state.error = ''
    state.warning = ''
    state.success = ''
    state.info = ''
}
class TriageQueue {
    constructor() {
        this.refresh()
    }
    refresh = async () => {
        clearAlerts()
        state.loading = true
        try {
            const pageSize = 20
            let hasMore = true
            let skip = 0
            while (hasMore) {
                const { data } = await axios.get(`/history?take=${pageSize}&skip=${skip}`)
                if (data.ok) {
                    if (data?.results) {
                        state.results = data.results
                    }
                } else if (typeof data === "string" && !isJSON(data)) {
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
                    break
                }
                if (Object.keys(data.results).length < pageSize) {
                    hasMore = false
                } else {
                    skip += pageSize
                }
            }
            state.loading = false
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
    expandRow = async (_, VEvent) => {
        VEvent.item.detectionTitle
    }
}

const manager = reactive(new TriageQueue())
</script>

<template>
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
    <VCard flat>
        <VCardTitle class="d-flex align-center pe-2">
            Repositories
            <!-- {{ Object.keys(state.results).length }} Findings -->
            <VSpacer></VSpacer>
            <VTextField
                v-model="Preferences.issueFilter"
                density="compact"
                label="Filter"
                prepend-inner-icon="mdi-magnify"
                variant="solo-filled"
                flat
                hide-details
                single-line
            ></VTextField>
        </VCardTitle>
        <VDivider></VDivider>
        <!-- <VExpansionPanels accordion>
            <VSkeletonLoader
                v-if="state.loading"
                type="table-row@10"
            />
            <VExpansionPanel v-for="(results, repoFullName) in state.results">
                <VExpansionPanelTitle class="text-subtitle-1">
                    {{ repoFullName }}
                </VExpansionPanelTitle>
                <VExpansionPanelText> -->
        <VDataTable
            class="elevation-1"
            v-model:expanded="expanded"
            v-model:search="Preferences.issueFilter"
            :items="state.results"
            item-value="findingId"
            :headers="issueHeadings"
            :sort-by="[{ key: 'modifiedAt', order: 'desc' }, { key: 'detectionTitle', order: 'asc' }]"
            multi-sort
            hover
            expand-on-click
            @click:row="manager.expandRow"
            :loading="state.loading"
        >
            <template v-slot:expanded-row="{ item, columns }">
                <tr>
                    <td :colspan="columns.length">
                        <pre>{{ JSON.stringify(item, null, 2) }}</pre>
                    </td>
                </tr>
            </template>

            <template v-slot:item.createdAt="{ item }">
                <div class="text-end">
                    <VTooltip
                        activator="parent"
                        location="top"
                    >{{ item.createdAt }}</VTooltip>
                    {{ new Date(item.createdAt).toLocaleDateString() }}
                </div>
            </template>
            <template v-slot:item.actions="{ item, index }">
                <VDialog
                    v-model="dialogs[index]"
                    transition="dialog-bottom-transition"
                    fullscreen
                >
                    <template v-slot:activator="{ props: activatorProps }">
                        <VBtn
                            prepend-icon="icon-park-outline:more-app"
                            size="small"
                            text="More"
                            v-bind="activatorProps"
                        ></VBtn>
                    </template>

                    <VCard>
                        <VToolbar color="#000">
                            <VBtn
                                icon="mdi-close"
                                color="#FFF"
                                @click="dialogs[index] = false"
                            ></VBtn>
                            <VToolbarTitle>Title</VToolbarTitle>
                            <VSpacer></VSpacer>
                            <VToolbarItems>
                                <VBtn
                                    text="Dismiss"
                                    variant="text"
                                    @click="dialogs[index] = false"
                                ></VBtn>
                            </VToolbarItems>
                        </VToolbar>
                        <VRow>
                            <VCol cols="12">
                            </VCol>
                            <VCol cols="6">
                                <VList
                                    lines="two"
                                    subheader
                                >
                                    <VListItemTitle>Details</VListItemTitle>

                                    <VListItem
                                        :subtitle="new Date(item.createdAt).toISOString()"
                                        title="Discovered"
                                    ></VListItem>
                                </VList>
                            </VCol>
                        </VRow>
                    </VCard>
                </VDialog>
            </template>
        </VDataTable>
        <!-- </VExpansionPanelText>
            </VExpansionPanel>
        </VExpansionPanels> -->
    </VCard>
</template>
<style scoped>
.text-capitalize {
    text-transform: capitalize;
}
</style>
