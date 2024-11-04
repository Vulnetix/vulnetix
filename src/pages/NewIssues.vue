<script setup>
import { useMemberStore } from '@/stores/member';
import { usePreferencesStore } from '@/stores/preferences';
import { Client } from '@/utils';
import { reactive } from 'vue';

const client = new Client()
const Member = useMemberStore()
const Preferences = usePreferencesStore()
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
            }
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
}

const selectedAction = ref(null)

const actions = [
    'Resolve',
    'False Positive',
    'Protected At Perimeter',
    'Protected By Mitigating Control',
    'Will Not Fix',
    'Workaround Available'
]

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString()
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

const resolveFindingState = (resolution) => {
    // Here you would typically call an API to update the finding status
    console.log(`Finding resolved with action: ${resolution}`)
}

const resolveFinding = (event) => {
    event.preventDefault()
    if (!selectedAction.value) return
    // Here you would typically call an API to update the finding status
    console.log(`Finding resolved with action: ${selectedAction.value}`)
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

    <v-card v-if="state.finding">
        <v-toolbar color="primary">
            <v-toolbar-title>{{ state.finding.detectionTitle }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text>
            <v-container>
                <v-row>
                    <v-col
                        cols="12"
                        md="6"
                    >
                        <v-list>
                            <v-list-item>
                                <v-list-item-title>CVSS Score</v-list-item-title>
                                <v-list-item-subtitle>{{ state.finding.cvssScore || 'N/A'
                                    }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>EPSS Score</v-list-item-title>
                                <v-list-item-subtitle>{{ state.finding.epssScore || 'N/A'
                                    }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>Fix Version</v-list-item-title>
                                <v-list-item-subtitle>{{ state.finding.fixVersion || 'N/A'
                                    }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>Vulnerable Version Range</v-list-item-title>
                                <v-list-item-subtitle>{{ state.finding.vulnerableVersionRange || 'Unknown'
                                    }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>Malicious</v-list-item-title>
                                <v-list-item-subtitle>{{ state.finding.malicious ? 'Yes' : 'No'
                                    }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>CVE</v-list-item-title>
                                <v-list-item-subtitle>{{ state.finding.cve || 'N/A' }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>Published At</v-list-item-title>
                                <v-list-item-subtitle>{{ formatDate(state.finding.publishedAt)
                                    }}</v-list-item-subtitle>
                            </v-list-item>
                        </v-list>
                    </v-col>
                    <v-col
                        cols="12"
                        md="6"
                    >
                        <v-card>
                            <v-card-title>Exploits</v-card-title>
                            <v-card-text>
                                <v-list
                                    dense
                                    v-if="state.finding?.exploits?.length"
                                >
                                    <v-list-item
                                        v-for="(exploit, k) in state.finding.exploits"
                                        :key="k"
                                    >
                                        {{ exploit.description }}
                                    </v-list-item>
                                </v-list>
                                <v-alert
                                    v-else
                                    type="primary"
                                >No known exploits</v-alert>
                            </v-card-text>
                        </v-card>
                        <v-card class="mt-4">
                            <v-card-title>Timeline</v-card-title>
                            <v-card-text>
                                <v-timeline v-if="state.finding?.timeline?.length">
                                    <v-timeline-item
                                        v-for="(event, k) in state.finding.timeline"
                                        :key="k"
                                    >
                                        <template v-slot:opposite>
                                            {{ formatDate(event.date) }}
                                        </template>
                                        <v-card>
                                            <v-card-text>
                                                {{ event.description }}
                                            </v-card-text>
                                        </v-card>
                                    </v-timeline-item>
                                </v-timeline>
                                <v-alert
                                    v-else
                                    type="primary"
                                >No timeline available</v-alert>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
                <v-row v-if="state.finding?.advisoryUrl">
                    <v-col cols="12">
                        <v-card>
                            <v-card-title>Advisory</v-card-title>
                            <v-card-text>
                                <v-btn
                                    :href="state.finding.advisoryUrl"
                                    target="_blank"
                                    color="primary"
                                >
                                    Open external source
                                </v-btn>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12">
                        <v-card>
                            <v-card-title>Triage Action</v-card-title>
                            <v-card-text>
                                <v-btn-group variant="outlined">
                                    <v-btn @click="resolveFindingState('Resolve')">Resolve</v-btn>
                                    <v-btn @click="resolveFindingState('False Positive')">False Positive</v-btn>
                                    <v-btn @click="resolveFindingState('Protected At Perimeter')">Protected At
                                        Perimeter</v-btn>
                                    <v-btn @click="resolveFindingState('Protected By Mitigating Control')">Protected
                                        By
                                        Mitigating
                                        Control</v-btn>
                                    <v-btn @click="resolveFindingState('Will Not Fix')">Will Not Fix</v-btn>
                                    <v-btn @click="resolveFindingState('Workaround Available')">Workaround
                                        Available</v-btn>
                                </v-btn-group>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </v-container>
        </v-card-text>
    </v-card>

    <VAlert
        v-else
        color="primary"
        icon="pixelarticons-mood-sad"
        variant="tonal"
        text="No Issues queued for triage review"
    />


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
