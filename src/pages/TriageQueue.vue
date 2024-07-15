<script setup>
import { useMemberStore } from '@/stores/member';
import { usePreferencesStore } from '@/stores/preferences';
import { isJSON } from '@/utils';
import { default as axios } from 'axios';
import { reactive } from 'vue';
import { useTheme } from 'vuetify';
import router from "../router";

const { global } = useTheme()
const Member = useMemberStore()
const Preferences = usePreferencesStore()
watch(
    Preferences,
    () => {
        localStorage.setItem('/state/preferences/scaFilter', Preferences.scaFilter)
        localStorage.setItem('/state/preferences/sastFilter', Preferences.sastFilter)
    },
    { deep: true }
)
const tabs = ref()
const dialogs = ref({})
const scaHeadings = [
    { title: 'Title', key: 'detectionTitle', align: 'start' },
    { title: 'Source', key: 'source' },
    { title: 'Discovered', key: 'createdAt', align: 'start' },
    { title: 'Observed', key: 'modifiedAt', align: 'start' },
    { title: 'Package', key: 'packageName', align: 'end' },
    { title: 'Version', key: 'packageVersion', align: 'start' },
    { title: 'License', key: 'packageLicense' },
    { title: 'Repository', key: 'repoName', align: 'start' },
    { title: 'SPDX Version', key: 'spdxVersion' },
    { title: '', key: 'actions', align: 'end' },
]
const sarifHeadings = [
    { title: 'Title', key: 'ruleId', align: 'start' },
    { title: 'Source', key: 'source' },
    { title: 'Discovered', key: 'createdAt', align: 'start' },
    { title: 'Severity', key: 'securitySeverity' },
    { title: 'Tool', key: 'toolName', align: 'end' },
    { title: 'Version', key: 'toolVersion', align: 'start' },
    { title: 'Rule', key: 'rulesetName' },
    { title: 'Level', key: 'level' },
    { title: 'precision', key: 'precision' },
    { title: 'Repository', key: 'fullName', align: 'start' },
    { title: '', key: 'actions', align: 'end' },
]

const initialState = {
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    sca: [],
    sast: [],
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
            const pageSize = 10
            let hasMore = true
            let skip = 0
            while (hasMore) {
                const { data } = await axios.get(`/queue/in_triage?take=${pageSize}&skip=${skip}`)
                if (data.ok) {
                    if (data?.sca) {
                        data.sca.forEach(sca => state.sca.push(sca))
                    }
                    if (data?.sast) {
                        data.sast.forEach(sast => state.sast.push(sast))
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
            state.loading = false
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
}

const manager = reactive(new TriageQueue())
</script>

<template>
    <VTabs
        v-model="tabs"
        :bgColor="global.name.value === 'dark' ? 'rgb(var(--v-theme-primary))' : 'rgba(var(--v-theme-primary),var(--v-activated-opacity))'"
        :color="global.name.value === 'dark' ? '#272727' : 'rgba(var(--v-theme-on-surface),var(--v-medium-emphasis-opacity))'"
        fixed-tabs
    >
        <VTab
            base-color="#272727"
            prepend-icon="hugeicons:blockchain-07"
            text="Supply Chain Security"
            value="sca"
        ></VTab>
        <VTab
            base-color="#272727"
            prepend-icon="eos-icons:critical-bug-outlined"
            text="CodeQL & SARIF"
            value="sast"
        ></VTab>
        <VTab
            base-color="#272727"
            prepend-icon="eos-icons:critical-bug-outlined"
            text="Defects"
            value="sast"
        ></VTab>
    </VTabs>
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
    <VTabsWindow v-model="tabs">
        <VTabsWindowItem value="sca">
            <VCard flat>
                <VCardTitle class="d-flex align-center pe-2">
                    {{ state.sca.length }} Findings
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
                    :items="state.sca"
                    :headers="scaHeadings"
                    :sort-by="[{ key: 'modifiedAt', order: 'desc' }, { key: 'detectionTitle', order: 'asc' }]"
                    multi-sort
                >
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
                    <template v-slot:item.modifiedAt="{ item }">
                        <div class="text-end">
                            <VTooltip
                                activator="parent"
                                location="top"
                            >{{ item.modifiedAt }}</VTooltip>
                            {{ new Date(item.modifiedAt).toLocaleDateString() }}
                        </div>
                    </template>
                    <template v-slot:item.spdxVersion="{ item }">
                        <div
                            class="text-end"
                            v-if="item.spdx.spdxVersion"
                        >
                            <VChip
                                :color="item.spdx.spdxVersion === 'SPDX-2.3' ? 'success' : ''"
                                :text="item.spdx.spdxVersion"
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
                    <template v-slot:item.repoName="{ item }">
                        <a
                            v-if="item.spdx?.repo?.source === 'GitHub'"
                            :href="`https://github.com/${item.spdx.repoName}`"
                            target="_blank"
                        >
                            {{ item.spdx.repoName }}
                        </a>
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <VDialog
                            v-model="dialogs[item.findingId]"
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
                                        @click="dialogs[item.findingId] = false"
                                    ></VBtn>
                                    <VToolbarTitle>{{ item.detectionTitle }}</VToolbarTitle>
                                    <VSpacer></VSpacer>
                                    <VToolbarItems>
                                        <VBtn
                                            text="Dismiss"
                                            variant="text"
                                            @click="dialogs[item.findingId] = false"
                                        ></VBtn>
                                    </VToolbarItems>
                                </VToolbar>
                                <VRow>
                                    <VCol cols="12">
                                        <VAlert
                                            v-if="item.spdx.comment"
                                            color="info"
                                            icon="$info"
                                            title="Information"
                                            :text="item.spdx.comment"
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
                                                v-if="item.spdxId"
                                                :subtitle="item.spdxId"
                                                title="SPDX Identifier"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item.cdxId"
                                                :subtitle="item.cdxId"
                                                title="CycloneDX Identifier"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item.cpe"
                                                :subtitle="item.cpe"
                                                title="CPE"
                                            ></VListItem>
                                            <VListItem
                                                :subtitle="item.purl"
                                                title="PURL"
                                            ></VListItem>
                                            <VListItem
                                                :subtitle="new Date(item.createdAt).toISOString()"
                                                title="Discovered"
                                            ></VListItem>
                                            <VListItem
                                                :subtitle="new Date(item.modifiedAt).toISOString()"
                                                title="Observed"
                                            ></VListItem>
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
                                                v-if="item.spdx.toolName"
                                                :subtitle="item.spdx.toolName"
                                                title="Source"
                                            ></VListItem>

                                            <VListItemTitle>Source Code</VListItemTitle>

                                            <VListItem
                                                v-if="item.spdx?.repoName"
                                                :title="`${item.spdx?.repo?.source} Repository`"
                                            >
                                                <a
                                                    v-if="item.spdx.repo.source === 'GitHub'"
                                                    :href="`https://github.com/${item.spdx.repoName}`"
                                                    target="_blank"
                                                >
                                                    {{ item.spdx.repoName }}
                                                </a>

                                            </VListItem>
                                            <VListItem
                                                class="text-capitalize"
                                                v-if="item.spdx?.repo.defaultBranch"
                                                :subtitle="item.spdx?.repo.defaultBranch"
                                                title="Default Branch"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item.spdx?.repo.licenseName"
                                                :subtitle="item.spdx?.repo.licenseName"
                                                title="License"
                                            >
                                            </VListItem>
                                            <VListItem
                                                class="text-capitalize"
                                                v-if="item.spdx?.repo.visibility"
                                                :subtitle="item.spdx?.repo.visibility"
                                                title="Visibility"
                                            ></VListItem>
                                            <VListItem
                                                :subtitle="item.spdx?.repo.archived ? 'Archived' : item.spdx?.repo.fork ? 'Forked' : item.spdx?.repo.template ? 'Template' : 'Source'"
                                                title="Type"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item.spdx?.repo.pushedAt"
                                                :subtitle="(new Date(item.spdx?.repo.pushedAt)).toLocaleDateString()"
                                                title="Last Pushed"
                                            >
                                            </VListItem>
                                        </VList>
                                    </VCol>
                                    <VCol cols="6">
                                        <VList
                                            lines="two"
                                            subheader
                                            v-for="(vex, key) in item.triage"
                                            :key="key"
                                        >
                                            <VListItemTitle>Triage Detail</VListItemTitle>
                                            <VListItem
                                                :subtitle="(new Date(vex.createdAt)).toISOString()"
                                                title="Created"
                                            ></VListItem>
                                            <VListItem
                                                :subtitle="(new Date(vex.lastObserved)).toISOString()"
                                                title="Last Observed"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.seenAt"
                                                :subtitle="(new Date(vex.seenAt)).toISOString()"
                                                title="Manually Triaged"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-else
                                                :subtitle="(new Date(vex.lastObserved)).toISOString()"
                                                title="Auto Triage"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.cvssVector"
                                                :subtitle="vex.cvssVector"
                                                title="CVSS Vector"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.cvssScore"
                                                :subtitle="vex.cvssScore"
                                                title="CVSS Score"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.epssScore"
                                                :subtitle="vex.epssScore"
                                                title="EPSS Score"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.epssPercentile"
                                                :subtitle="vex.epssPercentile"
                                                title="EPSS Percentile"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.ssvc"
                                                :subtitle="vex.ssvc"
                                                title="SSVC Outcome"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.remediation"
                                                :subtitle="vex.remediation"
                                                title="Remediation"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.analysisJustification"
                                                :subtitle="vex.analysisJustification"
                                                title="Analysis Justification"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="vex.analysisDetail"
                                                :subtitle="vex.analysisDetail"
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
        </VTabsWindowItem>
        <VTabsWindowItem value="sast">
            <VCard flat>
                <VCardTitle class="d-flex align-center pe-2">
                    {{ state.sast.length }} Findings
                    <VSpacer></VSpacer>
                    <VTextField
                        v-model="Preferences.sastFilter"
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
                    v-model:search="Preferences.sastFilter"
                    :items="state.sast"
                    :headers="sarifHeadings"
                    :sort-by="[{ key: 'createdAt', order: 'desc' }, { key: 'securitySeverity', order: 'asc' }]"
                    multi-sort
                >
                    <template v-slot:item.source="{ item }">
                        <div class="text-end">
                            <VChip
                                :color="item.sarif.source === 'GitHub' ? 'secondary' : 'info'"
                                :text="item.sarif.source"
                                size="small"
                                label
                            ></VChip>
                        </div>
                    </template>
                    <template v-slot:item.fullName="{ item }">
                        <a
                            v-if="item.sarif.source === 'GitHub'"
                            :href="`https://github.com/${item.sarif.fullName}`"
                            target="_blank"
                        >
                            {{ item.sarif.fullName }}
                        </a>
                    </template>
                    <template v-slot:item.toolName="{ item }">
                        {{ item.sarif.toolName }}
                    </template>
                    <template v-slot:item.toolVersion="{ item }">
                        {{ item.sarif.toolVersion }}
                    </template>
                    <template v-slot:item.createdAt="{ item }">
                        <div class="text-end">
                            <VTooltip
                                activator="parent"
                                location="top"
                            >{{ new Date(item.sarif.createdAt).toISOString() }}</VTooltip>
                            {{ new Date(item.sarif.createdAt).toLocaleDateString() }}
                        </div>
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <VDialog
                            v-model="dialogs[item.guid]"
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
                                        @click="dialogs[item.guid] = false"
                                    ></VBtn>
                                    <VToolbarTitle>{{ item.ruleId }}</VToolbarTitle>
                                    <VSpacer></VSpacer>
                                    <VToolbarItems>
                                        <VBtn
                                            text="Dismiss"
                                            variant="text"
                                            @click="dialogs[item.guid] = false"
                                        ></VBtn>
                                    </VToolbarItems>
                                </VToolbar>
                                <VRow>
                                    <VCol
                                        cols="12"
                                        v-if="item.warning"
                                    >
                                        <VAlert
                                            color="warning"
                                            icon="$warning"
                                            title="Warning"
                                            :text="item.warning"
                                            border="start"
                                            variant="tonal"
                                        />
                                    </VCol>
                                    <VCol cols="6">
                                        <VList
                                            lines="two"
                                            subheader
                                        >
                                            <VListItem
                                                :subtitle="item.messageText"
                                                title="Issue"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item.description && item.messageText !== item.description"
                                                :subtitle="item.description"
                                                title="Description"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item?.helpMarkdown"
                                                :subtitle="item.helpMarkdown.replace(item.messageText, '')"
                                                title="Help"
                                            >
                                            </VListItem>

                                            <VListSubheader>Details</VListSubheader>

                                            <VListItem
                                                v-if="item.source === 'GitHub'"
                                                :subtitle="item.reportId"
                                                title="GitHub Report ID"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="item.sarifId"
                                                :subtitle="item.sarifId"
                                                title="SARIF Identifier"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="item.locations"
                                                title="Locations"
                                            >
                                                <VCard
                                                    v-for="(location, k) in JSON.parse(item.locations)"
                                                    :key="k"
                                                >
                                                    <VCardSubtitle v-if="location.physicalLocation?.region?.startLine">
                                                        <span v-if="location.physicalLocation?.artifactLocation?.uri">
                                                            {{ location.physicalLocation.artifactLocation.uri }}
                                                        </span>:{{ location.physicalLocation.region.startLine }}
                                                        <span v-if="location.physicalLocation?.region?.startColumn">
                                                            Column {{ location.physicalLocation.region.startColumn }}
                                                        </span>
                                                        <div v-if="location.physicalLocation?.region?.snippet?.text">
                                                            <VCode
                                                                bgColor="#efefef"
                                                                color="primary"
                                                                class="pa-4"
                                                            >{{
                                                                location.physicalLocation?.region?.snippet?.text
                                                                }}</VCode>
                                                        </div>
                                                    </VCardSubtitle>
                                                </VCard>
                                            </VListItem>
                                            <VListItem
                                                v-if="item.automationDetailsId"
                                                :subtitle="item.automationDetailsId"
                                                title="automationDetailsId"
                                            ></VListItem>
                                            <VListItem
                                                :subtitle="new Date(item.createdAt).toISOString()"
                                                title="Discovered"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="item.tags"
                                                title="Tags"
                                            >
                                                <VChip
                                                    v-for="(tag, k) in JSON.parse(item.tags)"
                                                    :key="k"
                                                    class="ma-2"
                                                    variant="outlined"
                                                >
                                                    {{ tag }}
                                                </VChip>
                                            </VListItem>
                                            <VListItem
                                                v-if="item.commitSha"
                                                :subtitle="item.commitSha"
                                                title="Commit SHA-256"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="item.ref"
                                                :subtitle="item.ref"
                                                title="Ref"
                                            ></VListItem>
                                            <VListItem
                                                v-if="item.analysisKey"
                                                :subtitle="item.analysisKey"
                                                title="analysisKey"
                                            >
                                            </VListItem>
                                            <VListItem
                                                v-if="item.toolName"
                                                :subtitle="`${item.toolName} ${item?.toolVersion}`"
                                                title="Source"
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
        </VTabsWindowItem>
        <VTabsWindowItem value="sast">
            SAST, DAST, Linting, IaC, and Secrets
        </VTabsWindowItem>
    </VTabsWindow>
</template>
<style scoped>
.text-capitalize {
    text-transform: capitalize;
}
</style>
