<script setup>
import { useQueueStore } from '@/stores/findingQueue';
import { getPastelColor } from '@/utils';
import { useTheme } from 'vuetify';

const queueStore = useQueueStore()

const props = defineProps({
    finding: {
        type: Object,
        required: true,
    },
    currentTriage: {
        type: Object,
        required: true,
    },
})

const { global } = useTheme()

const dialog = ref(false)
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

const handleNext = async () => {
    // const findingUuid = props.finding.uuid
    // state.finding = null
    // state.loading = true
    // await client.get(`/issue/${findingUuid}?seen=1`)
    // await controller.refresh()
    queueStore.incrementProgress()
}

const handleTriage = () => {
    if (!response.value || !justification.value) {
        return
    }

    // Save result logic here

    queueStore.incrementProgress()
}

const timelineEvents = computed(() => {
    const events = [
        {
            value: 'First discovered in repo',
            time: props.finding.createdAt,
            color: getPastelColor(),
        },
        {
            value: 'Last synchronized with finding source',
            time: props.finding.modifiedAt,
            color: getPastelColor(),
        },
        {
            value: 'Advisory first published',
            time: props.finding.publishedAt-1,
            color: getPastelColor(),
        }
    ]

    if (props.currentTriage?.lastObserved) {
        events.push({
            value: 'Last VEX created',
            time: props.currentTriage.lastObserved,
            color: getPastelColor(),
        })
    }

    if (props.currentTriage?.triagedAt) {
        events.push({
            value: 'Last finding outcome decision',
            time: props.currentTriage.triagedAt,
            color: getPastelColor(),
        })
    }

    if (props.currentTriage?.seenAt) {
        events.push({
            value: `Reviewed by ${props.currentTriage.memberEmail}`,
            time: props.currentTriage.seenAt,
            color: getPastelColor(),
        })
    }

    if (props.finding.cisaDateAdded) {
        events.push({
            value: 'Added to CISA KEV',
            time: props.finding.cisaDateAdded,
            color: getPastelColor(),
        })
    }

    if (props.finding.spdx?.createdAt) {
        events.push({
            value: 'SPDX BOM created',
            time: props.finding.spdx.createdAt,
            color: getPastelColor(),
        })
    }

    if (props.finding.cdx?.createdAt) {
        events.push({
            value: 'CycloneDX BOM created',
            time: props.finding.cdx.createdAt,
            color: getPastelColor(),
        })
    }
    if (props.finding?.timeline) {
        props.finding.timeline.forEach(t => {
            t.color = getPastelColor()
            events.push(t)
        })
    }
    return events.sort((a, b) => a.time - b.time)
})
</script>

<template>
    <v-container
        fluid
        class="pa-0"
        v-if="props.finding"
    >
        <v-row>
            <v-col cols="12">
                <v-card>
                    <!-- Progress Header -->
                    <v-card-title class="d-flex justify-space-between align-center">
                        <div>
                            <span class="text-h5">{{ props.finding.detectionTitle }}</span>
                            <v-chip
                                v-if="props.finding.malicious"
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
                                            <v-icon icon="proicons:open-source" />
                                        </template>
                                        <v-list-item-title>Source: {{ props.finding.source }}</v-list-item-title>
                                    </v-list-item>

                                    <v-list-item>
                                        <template v-slot:prepend>
                                            <v-icon icon="mdi-package-variant" />
                                        </template>
                                        <v-list-item-title>
                                            Package: {{ props.finding.packageEcosystem }}:{{ props.finding.packageName
                                            }}@{{
                                                props.finding.packageVersion || '*' }}
                                        </v-list-item-title>
                                    </v-list-item>

                                    <v-list-item v-if="props.finding.vendor || props.finding.product">
                                        <template v-slot:prepend>
                                            <v-icon icon="mdi-domain" />
                                        </template>
                                        <v-list-item-title>
                                            {{ props.finding.vendor }} {{ props.finding.product }}
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
                                        v-for="alias in props.finding.aliases"
                                        :key="alias"
                                        color="primary"
                                        variant="outlined"
                                    >
                                        {{ alias }}
                                    </v-chip>

                                    <v-chip
                                        v-for="cwe in props.finding.cwes"
                                        :key="cwe"
                                        color="info"
                                    >
                                        {{ cwe }}
                                    </v-chip>
                                </div>
                            </v-col>

                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-card variant="outlined" title="Data Sources">
                                    <v-card-text>
                                        <v-list density="compact">
                                            <v-list-item
                                                v-if="props.finding.cdx?.artifact?.downloadLinks?.length"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon aria-label="CycloneDX" role="img" aria-hidden="false">
                                                        <img src="@images/icons/logo/cyclonedx.png" width="25"/>
                                                    </v-icon>
                                                </template>
                                                <v-list-item-title>
                                                    {{ [props.finding.cdx.name, props.finding.cdx?.version].filter(a => !!a).join('@') }}
                                                    <v-btn
                                                        icon="mdi:download"
                                                        :href="props.finding.cdx.artifact.downloadLinks[0].url"
                                                        download
                                                        variant="outlined"
                                                        size="x-small"
                                                    >
                                                    </v-btn>
                                                </v-list-item-title>
                                            </v-list-item>
        
                                            <v-list-item
                                                v-if="props.finding.spdx?.artifact?.downloadLinks?.length"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon aria-label="SPDX" role="img" aria-hidden="false">
                                                        <img src="@images/icons/logo/spdx.png" width="25"/>
                                                    </v-icon>
                                                </template>
                                                <v-list-item-title>
                                                    {{ [props.finding.spdx.name, props.finding.spdx?.version].filter(a => !!a).join('@') }}
                                                    <v-btn
                                                        icon="mdi:download"
                                                        :href="props.finding.spdx.artifact.downloadLinks[0].url"
                                                        download
                                                        variant="outlined"
                                                        size="x-small"
                                                    >
                                                    </v-btn>
                                                </v-list-item-title>
                                            </v-list-item>
        
                                            <v-list-item v-if="props.finding.repoName">
                                                <template v-slot:prepend>
                                                    <v-icon icon="mdi-source-repository" />
                                                </template>
                                                <v-list-item-title>{{ props.finding.repoName }}</v-list-item-title>
                                            </v-list-item>
        
                                        </v-list>
                                    </v-card-text>
                                </v-card>
                            </v-col>

                            <!-- CVSS & EPSS Info -->
                            <v-col
                                cols="12"
                                md="6"
                            >
                                <v-card variant="outlined" title="Enrichment">
                                    <v-card-text>
                                        <div
                                            v-if="props.currentTriage?.cvssVector"
                                            class="d-flex align-center mb-2"
                                        >
                                            <v-tooltip :text="props.currentTriage?.cvssVector">
                                                <template v-slot:activator="{ props }">
                                                    <a
                                                        v-bind="props"
                                                        :href="`https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator?vector=${props.currentTriage?.cvssVector}`"
                                                        target="_blank"
                                                        class="text-decoration-none"
                                                        :style="`color: ${getSeverityColor(props.currentTriage.cvssScore)};`"
                                                    >
                                                        CVSS Score: {{ props.currentTriage.cvssScore }}
                                                    </a>
                                                </template>
                                            </v-tooltip>
                                        </div>
                                        <div v-if="props.currentTriage?.epssScore">
                                            EPSS Score: {{ props.currentTriage?.epssScore }}
                                            ({{ props.currentTriage?.epssPercentile }} percentile)
                                        </div>
                                        <div v-if="props.currentTriage?.ssvc">
                                            SSVC: {{ props.currentTriage?.ssvc }}
                                        </div>
                                        <div v-if="props.finding.fixVersion">
                                            Fixed in version: {{ props.finding.fixVersion }}
                                        </div>
                                        <div v-if="props.finding.vulnerableVersionRange">
                                            Vulnerable versions: {{ props.finding.vulnerableVersionRange }}
                                        </div>
                                        <time
                                            v-if="props.currentTriage?.lastObserved"
                                            :datetime="new Date(props.currentTriage?.lastObserved).toISOString()"
                                        >
                                            Last observed: {{ new Date(props.currentTriage?.lastObserved).toLocaleString() }}
                                        </time>
                                    </v-card-text>
                                </v-card>
                            </v-col>

                            <!-- Timeline -->
                            <v-col cols="8">
                                <v-card variant="outlined" title="Timeline">
                                    <v-card-text>
                                        <v-timeline
                                            align="center"
                                        >
                                            <v-timeline-item
                                                v-for="(event, i) in timelineEvents"
                                                :key="i"
                                                :dot-color="event.color"
                                                size="large"
                                            >
                                                <template v-slot:opposite>
                                                    <div
                                                        class="pt-1 headline font-weight-bold"
                                                        :style="`color: ${global.name.value === 'dark' ? event.color : 'rgb(var(--v-theme-on-surface-bright))'};`"
                                                        v-text="new Date(event.time).toLocaleDateString()"
                                                    ></div>
                                                </template>
                                                <template v-slot:default>
                                                    <v-card>
                                                        <v-card-title class="text-h6" :style="`color: rgb(var(--v-theme-on-surface-bright)); background-color: ${event.color};`">
                                                            {{ event.value }}
                                                        </v-card-title>
                                                    </v-card>
                                                </template>
                                            </v-timeline-item>
                                        </v-timeline>
                                    </v-card-text>
                                </v-card>
                            </v-col>

                            <!-- Dependency Tree -->
                            <v-col
                                cols="8"
                                v-if="props.finding.source === 'sca'"
                            >
                                <v-card variant="outlined">
                                    <v-card-title>Dependencies (TODO locked ver)</v-card-title>
                                    <v-card-text>
                                        <v-treeview
                                            v-if="props.finding?.cdxJson?.dependencies"
                                            :items="props.finding.cdxJson.dependencies"
                                            item-children="dependsOn"
                                            item-text="ref"
                                        />
                                        <v-treeview
                                            v-else-if="props.finding?.spdxJson?.packages"
                                            :items="props.finding.spdxJson.packages"
                                            item-children="relationships"
                                            item-text="name"
                                        />
                                    </v-card-text>
                                </v-card>
                            </v-col>

                            <!-- References List -->
                            <v-col
                                cols="4"
                                rows="2"
                            >
                                <v-card variant="outlined" title="References">
                                    <v-card-text>
                                        <v-list>
                                            <v-list-item
                                                v-for="ref in [...props.finding?.references || [], props.finding?.advisoryUrl]"
                                                :key="ref"
                                                :href="ref"
                                                target="_blank"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon icon="mdi:open-in-new" />
                                                </template>
                                                {{ ref }}
                                            </v-list-item>

                                            <v-list-item
                                                v-if="props.finding?.repoSource === 'GitHub'"
                                                :href="`https://github.com/${props.finding.repoName}`"
                                                target="_blank"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon icon="mdi-github" />
                                                </template>
                                                {{ props.finding.repoName }}
                                            </v-list-item>

                                            <v-list-item
                                                v-for="exploit in [...props.finding?.exploits || [], ...props.finding?.knownExploits || []]"
                                                :key="exploit"
                                                :href="exploit"
                                                target="_blank"
                                                color="error"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon
                                                        icon="mdi:alert-circle"
                                                        color="error"
                                                    />
                                                </template>
                                                {{ exploit }}
                                            </v-list-item>
                                        </v-list>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>

                        <!-- References -->
                        <v-row class="mt-4">
                            <v-col cols="12">
                                
                            </v-col>
                        </v-row>
                    </v-card-text>

                    <v-card-actions>
                        <v-spacer />
                        <v-dialog
                            v-model="dialog"
                            max-width="600"
                        >
                            <template v-slot:activator="{ props: activatorProps }">
                                <v-btn
                                class="text-none font-weight-regular"
                                prepend-icon="mdi-account"
                                text="Triage"
                                variant="tonal"
                                v-bind="activatorProps"
                                ></v-btn>
                            </template>

                            <v-card>
                                <v-card-text>
                                    <!-- Analysis Form -->
                                    <v-row dense>
                                        <v-col
                                            cols="12"
                                            md="6"
                                        >
                                            <v-select
                                                v-model="response"
                                                :items="Object.values(Response)"
                                                label="Response*"
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
                                                label="Justification*"
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

                                <small class="text-caption text-medium-emphasis">*indicates required field</small>
                                </v-card-text>

                                <v-divider></v-divider>

                                <v-card-actions>
                                <v-spacer></v-spacer>

                                <v-btn
                                    text="Close"
                                    variant="plain"
                                    @click="dialog = false"
                                ></v-btn>

                                <v-btn
                                    color="primary"
                                    text="Save"
                                    variant="tonal"
                                    :disabled="!response || !justification"
                                    @click="handleTriage"
                                ></v-btn>
                                </v-card-actions>
                            </v-card>
                        </v-dialog>
                        <v-btn
                            color="primary"
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
