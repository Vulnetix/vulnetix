<script setup>
import { useMemberStore } from '@/stores/member';
import { usePreferencesStore } from '@/stores/preferences';
import { Client, flatten, isJSON } from '@/utils';
import { reactive } from 'vue';
import router from "../router";

const client = new Client()
const Member = useMemberStore()
const Preferences = usePreferencesStore()
watch(Preferences, () => localStorage.setItem('/state/preferences/scaFilter', Preferences.scaFilter), { deep: true })
const dialogs = ref({})
const scaHeadings = [
    { title: '', key: 'triage_seen', align: 'start' },
    { title: 'Title', key: 'detectionTitle', align: 'start' },
    { title: 'Source', key: 'source' },
    { title: 'Discovered', key: 'createdAt', align: 'start' },
    { title: 'Observed', key: 'triage_lastObserved', align: 'start' },
    { title: 'Package', key: 'packageName', align: 'end' },
    { title: 'Version', key: 'packageVersion', align: 'start' },
    { title: 'License', key: 'packageLicense' },
    { title: 'Repository', key: 'spdx_repoName', align: 'start' },
    { title: 'BOM Version', key: 'spdx_spdxVersion' },
    { title: '', key: 'actions', align: 'end' },
]

const initialState = {
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    results: [],
    triageLoaders: {},
}
const state = reactive({
    ...initialState,
})
const clearAlerts = () => {
    state.error = ''
    state.warning = ''
    state.success = ''
    state.info = ''
}
class Controller {
    refresh = async () => {
        clearAlerts()
        state.loading = true
        try {
            const pageSize = 20
            let hasMore = true
            let skip = 0
            while (hasMore) {
                const { data } = await client.get(`/queue/sca?take=${pageSize}&skip=${skip}`)
                if (data.ok) {
                    if (data?.sca) {
                        data.sca.forEach(sca => state.results.push(flatten(sca)))
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
                if (data.sca.length < pageSize) {
                    hasMore = false
                } else {
                    skip += pageSize
                }
            }
            state.results.forEach((result, index) => {
                state.results.splice(index, 1, result)
                dialogs[result.id.toString()] = result
            })
            state.loading = false
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
    expandRow = async item => {
        const findingId = item.id.toString()
        state.triageLoaders[findingId] = true
        try {
            const { data } = await client.get(`/enrich/${findingId}?seen=1`)
            state.triageLoaders[findingId] = false
            if (data.ok) {
                if (data?.finding) {
                    let found = false
                    for (const [index, result] of state.results.entries()) {
                        if (result.id === item.id) {
                            state.results.splice(index, 1, flatten(data.finding))
                            dialogs[findingId] = data.finding
                            found = true
                        }
                    }
                    if (!found) {
                        dialogs[findingId] = data.finding
                        state.results.push(flatten(data.finding))
                    }
                }
            } else if (typeof data === "string" && !isJSON(data)) {
                return
            } else if (data?.error?.message) {
                state.error = data.error.message
                return
            } else if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
                state.info = data.result
                setTimeout(() => router.push('/logout'), 2000)
                return
            }
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.triageLoaders[findingId] = false
        }
    }
}

const controller = reactive(new Controller())
onMounted(() => Member.ensureSession().then(controller.refresh))
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
            {{ state.results.length }} Findings
            <VSpacer></VSpacer>
            <VTextField
                v-model="Preferences.scaFilter"
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
        <VDataTable
            v-model:search="Preferences.scaFilter"
            :items="state.results"
            item-key="id"
            item-value="detectionTitle"
            :headers="scaHeadings"
            :sort-by="[{ key: 'detectionTitle', order: 'asc' }, { key: 'createdAt', order: 'desc' }]"
            multi-sort
            hover
            :loading="state.loading"
        >
            <template v-slot:item.triage_seen="{ item }">
                <VIcon
                    :icon="item?.triage_seen === 1 ? 'tabler-eye-check' : 'mdi-eye-off-outline'"
                    :color="item?.triage_seen === 1 ? 'success' : 'warning'"
                    size="23"
                />
            </template>
            <template v-slot:item.source="{ item }">
                <div class="text-end">
                    <VChip
                        :color="item.source === 'GitHub' ? 'secondary' : 'info'"
                        :text="item.source"
                        size="small"
                        label
                    ></VChip>
                </div>
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
            <template v-slot:item.triage_lastObserved="{ item }">
                <div class="text-end">
                    <VTooltip
                        activator="parent"
                        location="top"
                    >{{ item.triage_lastObserved }}</VTooltip>
                    {{ new Date(item.triage_lastObserved).toLocaleDateString() }}
                </div>
            </template>
            <template v-slot:item.spdx_spdxVersion="{ item }">
                <div
                    class="text-end"
                    v-if="item?.cdx_cdxVersion"
                >
                    <VChip
                        color="info"
                        :text="`CDX ${item?.cdx_cdxVersion}`"
                        size="small"
                        label
                    ></VChip>
                </div>
                <div
                    class="text-end"
                    v-if="item?.spdx_spdxVersion"
                >
                    <VChip
                        color="secondary"
                        :text="item?.spdx_spdxVersion"
                        size="small"
                        label
                    ></VChip>
                </div>
            </template>
            <template v-slot:item.packageLicense="{ item }">
                <VChip
                    color="#232323"
                    :text="item.packageLicense ? item.packageLicense : 'Unlicensed'"
                    class="text-warning"
                    size="small"
                    label
                ></VChip>
            </template>
            <template v-slot:item.spdx_repoName="{ item }">
                <a
                    v-if="item.spdx_repo_source === 'GitHub'"
                    :href="`https://github.com/${item?.spdx_repoName}`"
                    target="_blank"
                >
                    {{ item?.spdx_repoName }}
                </a>
            </template>
            <template v-slot:item.actions="{ item }">
                <VDialog
                    v-model="dialogs[item.id.toString()]"
                    transition="dialog-bottom-transition"
                    fullscreen
                >
                    <template v-slot:activator="{ props: activatorProps }">
                        <VBtn
                            prepend-icon="icon-park-outline:more-app"
                            size="small"
                            text="More"
                            v-bind="activatorProps"
                            @click="controller.expandRow(item)"
                        ></VBtn>
                    </template>

                    <VCard>
                        <VToolbar color="#000">
                            <VProgressLinear
                                :active="!!state.triageLoaders[item.id.toString()]"
                                :indeterminate="!!state.triageLoaders[item.id.toString()]"
                                color="primary"
                                absolute
                                bottom
                            >
                            </VProgressLinear>
                            <VBtn
                                icon="mdi-close"
                                color="#FFF"
                                @click="dialogs[item.id.toString()] = false"
                            ></VBtn>
                            <VToolbarTitle>{{ item.detectionTitle }}</VToolbarTitle>
                            <VSpacer></VSpacer>
                            <VToolbarItems>
                                <VBtn
                                    text="Dismiss"
                                    variant="text"
                                    @click="dialogs[item.id.toString()] = false"
                                ></VBtn>
                            </VToolbarItems>
                        </VToolbar>
                        <VRow>
                            <VCol cols="12">
                                <VAlert
                                    v-if="item?.spdx_comment"
                                    color="info"
                                    icon="$info"
                                    title="Information"
                                    :text="item?.spdx_comment"
                                    border="start"
                                    variant="tonal"
                                />
                            </VCol>
                            <VCol cols="6">
                                <VList
                                    lines="two"
                                    subheader
                                >
                                    <VListItemTitle>Details</VListItemTitle>

                                    <VListItem
                                        v-if="item.triage_analysisState"
                                        :subtitle="item.triage_analysisState"
                                        title="Analysis State"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item?.spdxId"
                                        :subtitle="item.spdxId"
                                        title="SPDX Identifier"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item?.cdxId"
                                        :subtitle="item.cdxId"
                                        title="CycloneDX Identifier"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.cpe"
                                        :subtitle="item.cpe"
                                        title="CPE"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.purl"
                                        :subtitle="item.purl"
                                        title="PURL"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.createdAt"
                                        :subtitle="new Date(item.createdAt).toISOString()"
                                        title="Discovered"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_lastObserved"
                                        :subtitle="new Date(item.triage_lastObserved).toISOString()"
                                        title="Last Observed"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.fixVersion"
                                        :subtitle="item.fixVersion"
                                        title="Fix Version"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.maliciousSource"
                                        :subtitle="item.maliciousSource"
                                        title="Malicious Source"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.abandoned"
                                        subtitle="No updates or patches are expected."
                                        title="Abandoned"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.squattedPackage"
                                        :subtitle="`Did you mean to install '${item.squattedPackage}'?`"
                                        title="Squatted Package"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item?.spdx_toolName"
                                        :subtitle="item.spdx_toolName"
                                        title="Source"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item?.cdx_toolName"
                                        :subtitle="item.cdx_toolName"
                                        title="Source"
                                    ></VListItem>

                                    <VListItemTitle>Source Code</VListItemTitle>

                                    <VListItem
                                        v-if="item?.spdx_repoName"
                                        :title="`${item.spdx_repo_source} Repository`"
                                    >
                                        <a
                                            v-if="item?.spdx_repo_source === 'GitHub'"
                                            :href="`https://github.com/${item.spdx_repoName}`"
                                            target="_blank"
                                        >
                                            {{ item.spdx_repoName }}
                                        </a>
                                    </VListItem>
                                    <VListItem
                                        class="text-capitalize"
                                        v-if="item.spdx_repo_defaultBranch"
                                        :subtitle="item.spdx_repo_defaultBranch"
                                        title="Default Branch"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.spdx_repo_licenseName"
                                        :subtitle="item.spdx_repo_licenseName"
                                        title="License"
                                    >
                                    </VListItem>
                                    <VListItem
                                        class="text-capitalize"
                                        v-if="item.spdx_repo_visibility"
                                        :subtitle="item.spdx_repo_visibility"
                                        title="Visibility"
                                    ></VListItem>
                                    <VListItem
                                        :subtitle="item.spdx_repo_archived ? 'Archived' : item.spdx_repo_fork ? 'Forked' : item.spdx_repo_template ? 'Template' : 'Source'"
                                        title="Type"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.spdx_repo_pushedAt"
                                        :subtitle="(new Date(item.spdx_repo_pushedAt)).toLocaleDateString()"
                                        title="Last Pushed"
                                    >
                                    </VListItem>

                                    <VListItem
                                        v-if="item?.cdx_repoName"
                                        :title="`${item.cdx_repo_source} Repository`"
                                    >
                                        <a
                                            v-if="item?.cdx_repo_source === 'GitHub'"
                                            :href="`https://github.com/${item.cdx_repoName}`"
                                            target="_blank"
                                        >
                                            {{ item.cdx_repoName }}
                                        </a>
                                    </VListItem>
                                    <VListItem
                                        class="text-capitalize"
                                        v-if="item.cdx_repo_defaultBranch"
                                        :subtitle="item.cdx_repo_defaultBranch"
                                        title="Default Branch"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.cdx_repo_licenseName"
                                        :subtitle="item.cdx_repo_licenseName"
                                        title="License"
                                    >
                                    </VListItem>
                                    <VListItem
                                        class="text-capitalize"
                                        v-if="item.cdx_repo_visibility"
                                        :subtitle="item.cdx_repo_visibility"
                                        title="Visibility"
                                    ></VListItem>
                                    <VListItem
                                        :subtitle="item.cdx_repo_archived ? 'Archived' : item.cdx_repo_fork ? 'Forked' : item.cdx_repo_template ? 'Template' : 'Source'"
                                        title="Type"
                                    ></VListItem>
                                    <VListItem
                                        v-if="item.cdx_repo_pushedAt"
                                        :subtitle="(new Date(item.cdx_repo_pushedAt)).toLocaleDateString()"
                                        title="Last Pushed"
                                    >
                                    </VListItem>
                                </VList>
                            </VCol>
                            <VCol cols="6">
                                <VList
                                    lines="two"
                                    subheader
                                >
                                    <VListItemTitle>Triage Detail</VListItemTitle>
                                    <VListItem
                                        v-if="item.triage_triageAutomated === '1'"
                                        :subtitle="(new Date(item.triage_triagedAt)).toISOString()"
                                        title="Auto Triage"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-else-if="item.triage_triageAutomated === '0' && item.triage_triagedAt"
                                        :subtitle="(new Date(item.triage_triagedAt)).toISOString()"
                                        title="Manually Triaged"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-else-if="item.triage_seen === '1'"
                                        :subtitle="(new Date(item.triage_seenAt)).toISOString()"
                                        title="Queue item first seen"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_cvssVector"
                                        :subtitle="item.triage_cvssVector"
                                        title="CVSS Vector"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_cvssScore"
                                        :subtitle="item.triage_cvssScore"
                                        title="CVSS Score"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_epssScore"
                                        :subtitle="`${item.triage_epssScore} (${item.triage_epssPercentile})`"
                                        title="EPSS Score"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_ssvc"
                                        :subtitle="item.triage_ssvc"
                                        title="SSVC Outcome"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_remediation"
                                        :subtitle="item.triage_remediation"
                                        title="Remediation"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_analysisJustification"
                                        :subtitle="item.triage_analysisJustification"
                                        title="Analysis Justification"
                                    >
                                    </VListItem>
                                    <VListItem
                                        v-if="item.triage_analysisDetail"
                                        :subtitle="item.triage_analysisDetail"
                                        title="Analysis Detail"
                                    >
                                    </VListItem>
                                </VList>
                            </VCol>
                        </VRow>
                    </VCard>
                </VDialog>
            </template>
        </VDataTable>
    </VCard>
</template>
<style scoped>
.text-capitalize {
    text-transform: capitalize;
}
</style>
