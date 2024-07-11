<script setup>
import { isJSON } from '@/utils';
import { default as axios } from 'axios';
import { reactive } from 'vue';
import { useTheme } from 'vuetify';

const { global } = useTheme()

const initialState = {
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    apiKey: '',
    log: []
}
const state = reactive({
    ...initialState,
})
axios.defaults.headers.common = {
    'x-trivialsec': localStorage.getItem('/session/token') || '',
}
const clearAlerts = () => {
    state.error = ''
    state.warning = ''
    state.success = ''
    state.info = ''
}
class Controller {
    constructor() {
        this.refresh()
    }
    refresh = async () => {
        clearAlerts()
        state.loading = true
        try {
            const { data } = await axios.get(`/osv/log`)
            state.loading = false
            if (typeof data === "string" && !isJSON(data)) {
                state.error = "Data could not be retrieved, please try again later."

                return
            }
            if (data?.error?.message) {
                state.error = data?.error?.message
                return
            }
            if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
                state.info = data.result

                setTimeout(() => router.push('/logout'), 2000)
                return
            }
            state.log = data.log
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
}

const controller = reactive(new Controller())
</script>

<template>
    <Vrow>
        <VCol cols="12">
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
        </VCol>
    </Vrow>
    <VCard title="Google's Open Source Vulnerabilities (OSV)">
        <VSkeletonLoader
            v-if="state.loading"
            type="table-row@10"
        />
        <VTable
            class="text-no-wrap"
            height="40rem"
            fixed-header
            v-if="!state.loading && state.log.length"
        >
            <thead>
                <tr>
                    <th scope="col">
                        Event Time
                    </th>
                    <th scope="col">
                        Status Code
                    </th>
                    <th scope="col">
                        Request
                    </th>
                    <th scope="col">
                        Response
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="(record, i) in state.log"
                    :key="i"
                >
                    <td>
                        {{ (new Date(record.createdAt)).toLocaleString() }}
                    </td>
                    <td>
                        <v-chip
                            size="small"
                            variant="outlined"
                            :color="record.statusCode.toString()[0] === '2' ? '#35933f' : 'error'"
                        >
                            {{ record.statusCode }}
                        </v-chip>
                    </td>
                    <td>
                        <v-dialog max-width="800">
                            <template v-slot:activator="{ props: activatorProps }">
                                <VBtn
                                    v-bind="activatorProps"
                                    :text="`View JSON (${record.request.length} chars)`"
                                    :color="global.name.value === 'dark' ? 'secondary' : 'primary'"
                                    variant="tonal"
                                    density="comfortable"
                                ></VBtn>
                            </template>
                            <template v-slot:default="{ isActive }">
                                <v-card title="Request">
                                    <v-card-text>
                                        <pre>{{ JSON.stringify(JSON.parse(record.request || ''), null, 2) }}</pre>
                                    </v-card-text>
                                    <v-card-actions>
                                        <v-spacer></v-spacer>
                                        <VBtn
                                            text="Close"
                                            :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                                            variant="tonal"
                                            density="comfortable"
                                            @click="isActive.value = false"
                                        ></VBtn>
                                    </v-card-actions>
                                </v-card>
                            </template>
                        </v-dialog>
                    </td>
                    <td><v-dialog
                            max-width="800"
                            v-if="JSON.parse(record.response || '').length > 0"
                        >
                            <template v-slot:activator="{ props: activatorProps }">
                                <VBtn
                                    v-bind="activatorProps"
                                    :text="`View JSON (${record.response.length} chars)`"
                                    :color="global.name.value === 'dark' ? 'secondary' : 'primary'"
                                    variant="tonal"
                                    density="comfortable"
                                ></VBtn>
                            </template>
                            <template v-slot:default="{ isActive }">
                                <v-card title="Response">
                                    <v-card-text>
                                        <pre>{{ JSON.stringify(JSON.parse(record.response || ''), null, 2) }}</pre>
                                    </v-card-text>
                                    <v-card-actions>
                                        <v-spacer></v-spacer>
                                        <VBtn
                                            text="Close"
                                            :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                                            variant="tonal"
                                            density="comfortable"
                                            @click="isActive.value = false"
                                        ></VBtn>
                                    </v-card-actions>
                                </v-card>
                            </template>
                        </v-dialog>
                    </td>
                </tr>
            </tbody>
        </VTable>
        <VAlert
            v-else
            color="primary"
            icon="pixelarticons-mood-sad"
            text="No log data to display"
            variant="tonal"
        />
        <VDivider />
    </VCard>
</template>

<style lang="scss" scoped>
.v-table {
    th {
        text-align: start !important;
    }
}
</style>
