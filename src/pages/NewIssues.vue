<script setup>
import { useQueueStore } from '@/stores/findingQueue';
import { useMemberStore } from '@/stores/member';
import { usePreferencesStore } from '@/stores/preferences';
import { Client } from '@/utils';
import { reactive } from 'vue';

const client = new Client()
const Member = useMemberStore()
const Preferences = usePreferencesStore()
const queueStore = useQueueStore()

watch(Preferences, () => localStorage.setItem('/state/preferences/scaFilter', Preferences.scaFilter), { deep: true })

const initialState = {
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    finding: {},
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
            const { data } = await client.get(`/next-issue`)
            state.loading = false
            if (data.ok && data?.finding) {
                state.finding = data.finding
                queueStore.setTotal(data.findingCount)
            }
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
}
const response = ref('')
const justification = ref('')
const justificationText = ref('')

const Response = {
    false_positive: "False Positive",
    not_affected: "Not Affected",
    can_not_fix: "Can Not Fix",
    will_not_fix: "Will Not Fix",
    workaround_available: "Workaround Available"
}

const Justification = {
    code_not_present: "Code Not Present",
    code_not_reachable: "Code Not Reachable",
    requires_configuration: "Requires Configuration",
    requires_dependency: "Requires Dependency",
    requires_environment: "Requires Environment",
    protected_by_compiler: "Protected By Compiler",
    protected_at_runtime: "Protected At Runtime",
    protected_at_perimeter: "Protected At Perimeter",
    protected_by_mitigating_control: "Protected By Mitigating Control"
}

const getSeverityColor = (score) => {
    if (!score) return 'grey'
    if (score < 4) return 'green'
    if (score < 7) return 'yellow'
    if (score < 9) return 'orange'
    return 'red'
}

const getSourceIcon = (url) => {
    if (!url) return 'mdi-source-repository'
    return url.includes('github') ? 'mdi-github' : 'mdi-git'
}

const currentTriage = computed(() => {
    if (!state?.finding?.triage?.length) return;
    return state?.finding?.triage?.sort((a, b) =>
        a.lastObserved - b.lastObserved
    )?.pop()
})
const handleNext = () => {
    if (!response.value || !justification.value) {
        return
    }

    // Save result logic here

    queueStore.incrementProgress()
}
const timelineEvents = computed(() => {
    const triage = state?.finding?.triage?.sort((a, b) =>
        a.lastObserved - b.lastObserved
    )?.pop()

    const events = [
        {
            title: 'First discovered in repo',
            date: state.finding.createdAt
        },
        {
            title: 'Last synchronized with finding source',
            date: state.finding.modifiedAt
        },
        {
            title: 'Advisory first published',
            date: state.finding.publishedAt
        }
    ]

    if (triage?.lastObserved) {
        events.push({
            title: 'Last VEX created',
            date: triage.lastObserved
        })
    }

    if (triage?.triagedAt) {
        events.push({
            title: 'Last finding outcome decision',
            date: triage.triagedAt
        })
    }

    if (triage?.seenAt) {
        events.push({
            title: `Reviewed by ${triage.memberEmail}`,
            date: triage.seenAt
        })
    }

    if (state.finding.cisaDateAdded) {
        events.push({
            title: 'Added to CISA KEV',
            date: state.finding.cisaDateAdded
        })
    }

    if (state.finding.spdx?.createdAt) {
        events.push({
            title: 'SPDX BOM created',
            date: state.finding.spdx.createdAt
        })
    }

    if (state.finding.cdx?.createdAt) {
        events.push({
            title: 'CycloneDX BOM created',
            date: state.finding.cdx.createdAt
        })
    }

    return events.sort((a, b) => b.date - a.date)
})

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

    <v-container
        fluid
        class="pa-0"
    >
        <v-row>
            <v-col cols="12">
                <v-card>
                    <!-- Progress Header -->
                    <v-card-title class="d-flex justify-space-between align-center">
                        <div>
                            <span class="text-h5">{{ state.finding.detectionTitle }}</span>
                            <v-chip
                                v-if="state.finding.malicious"
                                color="error"
                                class="ml-2"
                            >
                                Malicious Package
                                <v-icon
                                    end
                                    icon="mdi-alert-circle"
                                />
                            </v-chip>
                        </div>
                        <div class="d-flex align-center">
                            <span class="mr-4">{{ queueStore.progress }} / {{ queueStore.total }}</span>
                            <v-btn
                                v-if="state.finding.spdx?.downloadLinks?.length"
                                icon
                                :href="state.finding.spdx.downloadLinks[0].url"
                                download
                            >
                                <v-icon :icon="mdiDownload" />
                            </v-btn>
                        </div>
                    </v-card-title>

                    <v-card-text>
                        <!-- Basic Info -->
                        <v-row>
                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-list density="compact">
                                    <v-list-item>
                                        <template v-slot:prepend>
                                            <v-icon icon="mdi-source-repository" />
                                        </template>
                                        <v-list-item-title>Source: {{ state.finding.source }}</v-list-item-title>
                                    </v-list-item>

                                    <v-list-item>
                                        <template v-slot:prepend>
                                            <v-icon icon="mdi-package-variant" />
                                        </template>
                                        <v-list-item-title>
                                            Package: {{ state.finding.packageEcosystem }}:{{ state.finding.packageName
                                            }}@{{
                                                state.finding.packageVersion || '*' }}
                                        </v-list-item-title>
                                    </v-list-item>

                                    <v-list-item v-if="state.finding.vendor || state.finding.product">
                                        <template v-slot:prepend>
                                            <v-icon icon="mdi-domain" />
                                        </template>
                                        <v-list-item-title>
                                            {{ state.finding.vendor }} {{ state.finding.product }}
                                        </v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-col>

                            <v-col
                                cols="12"
                                md="6"
                            >
                                <div class="d-flex flex-wrap gap-2">
                                    <v-chip
                                        v-for="alias in state.finding.aliases"
                                        :key="alias"
                                        color="primary"
                                        variant="outlined"
                                    >
                                        {{ alias }}
                                    </v-chip>

                                    <v-chip
                                        v-for="cwe in state.finding.cwes"
                                        :key="cwe"
                                        color="info"
                                    >
                                        {{ cwe }}
                                    </v-chip>
                                </div>
                            </v-col>
                        </v-row>

                        <!-- CVSS & EPSS Info -->
                        <v-row class="mt-4">
                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-card variant="outlined">
                                    <v-card-text>
                                        <div
                                            v-if="currentTriage?.cvssVector"
                                            class="d-flex align-center mb-2"
                                        >
                                            <v-tooltip :text="currentTriage?.cvssVector">
                                                <template v-slot:activator="{ props }">
                                                    <a
                                                        v-bind="props"
                                                        :href="`https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator?vector=${currentTriage?.cvssVector}`"
                                                        target="_blank"
                                                        class="text-decoration-none"
                                                    >
                                                        CVSS Score: {{ currentTriage?.cvssScore }}
                                                    </a>
                                                </template>
                                            </v-tooltip>
                                        </div>
                                        <div v-if="currentTriage?.epssScore">
                                            EPSS Score: {{ currentTriage?.epssScore }}
                                            ({{ currentTriage?.epssPercentile }} percentile)
                                        </div>
                                        <div v-if="currentTriage?.ssvc">
                                            SSVC: {{ currentTriage?.ssvc }}
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </v-col>

                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-card variant="outlined">
                                    <v-card-text>
                                        <div v-if="state.finding.fixVersion">
                                            Fixed in version: {{ state.finding.fixVersion }}
                                        </div>
                                        <div v-if="state.finding.vulnerableVersionRange">
                                            Vulnerable versions: {{ state.finding.vulnerableVersionRange }}
                                        </div>
                                        <time
                                            v-if="currentTriage?.lastObserved"
                                            :datetime="new Date(currentTriage?.lastObserved).toISOString()"
                                        >
                                            Last observed: {{ new Date(currentTriage?.lastObserved).toLocaleString() }}
                                        </time>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>

                        <!-- Dependency Tree -->
                        <v-row
                            v-if="state.finding.source === 'sca'"
                            class="mt-4"
                        >
                            <v-col cols="12">
                                <v-card variant="outlined">
                                    <v-card-title>Dependencies</v-card-title>
                                    <v-card-text>
                                        <v-treeview
                                            v-if="state?.finding?.cdxJson?.dependencies"
                                            :items="state.finding.cdxJson.dependencies"
                                            item-children="dependsOn"
                                            item-text="ref"
                                        />
                                        <v-treeview
                                            v-else-if="state?.finding?.spdxJson?.packages"
                                            :items="state.finding.spdxJson.packages"
                                            item-children="relationships"
                                            item-text="name"
                                        />
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>

                        <!-- Timeline -->
                        <v-row class="mt-4">
                            <v-col cols="12">
                                <v-timeline
                                    side="end"
                                    density="compact"
                                >
                                    <v-timeline-item
                                        v-for="event in timelineEvents"
                                        :key="event.date"
                                        :dot-color="event.color || 'primary'"
                                    >
                                        <template v-slot:opposite>
                                            {{ new Date(event.date).toLocaleDateString() }}
                                        </template>
                                        <div class="text-subtitle-2">{{ event.title }}</div>
                                    </v-timeline-item>
                                </v-timeline>
                            </v-col>
                        </v-row>

                        <!-- Analysis Form -->
                        <v-row class="mt-4">
                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-select
                                    v-model="response"
                                    :items="Object.values(Response)"
                                    label="Response"
                                    required
                                />
                            </v-col>

                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-select
                                    v-model="justification"
                                    :items="Object.values(Justification)"
                                    label="Justification"
                                    required
                                />
                            </v-col>

                            <v-col cols="12">
                                <v-textarea
                                    v-model="justificationText"
                                    label="Additional Notes"
                                    rows="3"
                                />
                            </v-col>
                        </v-row>

                        <!-- References -->
                        <v-row class="mt-4">
                            <v-col cols="12">
                                <v-list>
                                    <v-list-item
                                        v-for="ref in [...state?.finding?.references || [], state?.finding?.advisoryUrl]"
                                        :key="ref"
                                        :href="ref"
                                        target="_blank"
                                    >
                                        <template v-slot:prepend>
                                            <v-icon :icon="mdiOpenInNew" />
                                        </template>
                                        {{ ref }}
                                    </v-list-item>

                                    <v-list-item
                                        v-if="state?.finding?.repoSource === 'GitHub'"
                                        :href="`https://github.com/${state.finding.repoName}`"
                                        target="_blank"
                                    >
                                        <template v-slot:prepend>
                                            <v-icon icon="mdi-github" />
                                        </template>
                                        {{ state.finding.repoName }}
                                    </v-list-item>

                                    <v-list-item
                                        v-for="exploit in [...state?.finding?.exploits || [], ...state?.finding?.knownExploits || []]"
                                        :key="exploit"
                                        :href="exploit"
                                        target="_blank"
                                        color="error"
                                    >
                                        <template v-slot:prepend>
                                            <v-icon
                                                :icon="mdiAlertCircle"
                                                color="error"
                                            />
                                        </template>
                                        {{ exploit }}
                                    </v-list-item>
                                </v-list>
                            </v-col>
                        </v-row>
                    </v-card-text>

                    <v-card-actions>
                        <v-spacer />
                        <v-btn
                            color="primary"
                            :disabled="!response || !justification"
                            @click="handleNext"
                        >
                            Next Finding
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.text-capitalize {
    text-transform: capitalize;
}

.finding-list {
    background-color: transparent !important;
}

.finding-list .v-list-item {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    margin-bottom: 8px;
    transition: background-color 0.2s ease;
}

.finding-list .v-list-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
}
</style>
