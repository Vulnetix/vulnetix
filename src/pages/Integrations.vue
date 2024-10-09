<script setup>
import { Client, isJSON } from '@/utils';
import { reactive } from 'vue';
import { useTheme } from 'vuetify';

const client = new Client()
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
            const limit = 150
            const pageSize = 20
            let hasMore = true
            let skip = 0
            while (hasMore && skip <= limit) {
                const { data } = await client.get(`/osv/log?take=${pageSize}&skip=${skip}`)
                if (data.ok) {
                    if (data?.results) {
                        data.results.map(r => state.log.push(r))
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
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
        }
        state.loading = false
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
    <VCard>
        <VSheet class="d-flex flex-wrap">
            <VSkeletonLoader
                class="ma-2"
                :loading="state.loading"
                width="400"
                height="250"
                type="image, list-item-two-line"
            >
                <VCard
                    class="mx-auto bg-light-primary"
                    width="400"
                    height="250"
                >
                    <template v-slot:title>
                        <span class="font-weight-black">GitHub</span>
                    </template>
                    <template v-slot:subtitle>
                        Developer platform
                    </template>
                    <template v-slot:prepend>
                        <VIcon size="50">mdi-github</VIcon>
                    </template>
                    <template v-slot:append>
                        <VSwitch
                            color="success"
                            value="github"
                        ></VSwitch>
                    </template>
                    <VCardText class="pt-2">
                        Provides SPDX via Dependency Graph, SARIF via CodeQL, and Repository source code for remediation
                        activities including reachability analysis, pull requests, and prioritization information
                        utilizing
                        Catalog configurations.
                    </VCardText>
                </VCard>
            </VSkeletonLoader>
            <VSkeletonLoader
                class="ma-2"
                :loading="state.loading"
                width="400"
                height="250"
                type="image, list-item-two-line"
            >
                <VCard
                    class="mx-auto bg-light-primary"
                    width="400"
                    height="250"
                >
                    <template v-slot:title>
                        <span class="font-weight-black">OSV.dev</span>
                    </template>
                    <template v-slot:subtitle>
                        Open Source Vulnerabilities
                    </template>
                    <template v-slot:prepend>
                        <VImg
                            src="/osv-logo.png"
                            width="50"
                        ></VImg>
                    </template>
                    <template v-slot:append>
                        <VSwitch
                            color="success"
                            :model-value="true"
                            readonly
                        ></VSwitch>
                    </template>
                    <VCardText class="pt-2">
                        This infrastructure serves as an aggregator of vulnerability databases that have adopted the OSV
                        schema,
                        including GitHub Security Advisories, PyPA, RustSec, and Global Security Database, and more.
                    </VCardText>
                </VCard>
            </VSkeletonLoader>
            <VSkeletonLoader
                class="ma-2"
                :loading="state.loading"
                width="400"
                height="250"
                type="image, list-item-two-line"
            >
                <VCard
                    class="mx-auto bg-light-primary"
                    width="400"
                    height="250"
                >
                    <template v-slot:title>
                        <span class="font-weight-black">FIRST.org</span>
                    </template>
                    <template v-slot:subtitle>
                        Standards body for CVSS and EPSS
                    </template>
                    <template v-slot:prepend>
                        <VImg
                            src="/1st-logo.png"
                            width="50"
                        ></VImg>
                    </template>
                    <template v-slot:append>
                        <VSwitch
                            color="success"
                            :model-value="true"
                            readonly
                        ></VSwitch>
                    </template>
                    <VCardText class="pt-2">
                        Exploit Prediction Scoring System (EPSS) is estimating daily the probability of any exploitation
                        attempts against a CVE in the next 30 days.
                        Common Vulnerability Scoring System (CVSS) is “severity” of a vulnerability.
                    </VCardText>
                </VCard>
            </VSkeletonLoader>
        </VSheet>
    </VCard>
</template>

<style lang="scss" scoped>
.v-table {
    th {
        text-align: start !important;
    }
}
</style>
