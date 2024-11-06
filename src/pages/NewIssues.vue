<script setup>
import Finding from '@/components/Finding.vue';
import { useQueueStore } from '@/stores/findingQueue';
import { useMemberStore } from '@/stores/member';
import { Client } from '@/utils';
import IconVulnetix from '@images/IconVulnetix.vue';
import { reactive } from 'vue';

const client = new Client()
const Member = useMemberStore()
const queueStore = useQueueStore()

const initialState = {
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    finding: null,
    triageLoaders: {},
    currentTriage: {},
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
            const { data } = await client.get(`/next-issue?seen=1`)
            state.loading = false
            if (data.ok && data?.finding) {
                state.finding = data.finding
                state.currentTriage = data.finding.triage.sort((a, b) =>
                    a.lastObserved - b.lastObserved
                ).pop()
                if (!queueStore.total) {
                    queueStore.setTotal(data.findingCount)
                    queueStore.incrementProgress()
                }
            }
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
}

const controller = reactive(new Controller())
onMounted(() => Member.ensureSession().then(controller.refresh))
</script>

<template>
    <VCard>
        <VProgressLinear
            :active="state.loading"
            :indeterminate="state.loading"
            color="primary"
            absolute
            bottom
        ></VProgressLinear>
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
        <VCardText>
            <Finding v-if="state.finding" :finding="state.finding" :current-triage="state.currentTriage" />
        </VCardText>
    </VCard>
    <v-empty-state
        v-if="state.loading"
        size="250"
    >
        <template v-slot:media>
            <div class="mb-8">
                <IconVulnetix width="150" />
            </div>
        </template>

        <template v-slot:title>
            <div class="text-h6 text-high-emphasis">Pix is working</div>
        </template>

        <template v-slot:text>
            <div class="text-body-1">Gathering the latest information for your issue.</div>
            <div class="text-body-1">This should be no more than 10 seconds.</div>
        </template>
    </v-empty-state>
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
