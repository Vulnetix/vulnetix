<script setup>
import { useMemberStore } from '@/stores/member';
import { Client, isJSON, timeAgo } from '@/utils';
import { reactive, ref } from 'vue';
import { VTreeview } from 'vuetify/labs/VTreeview';

const client = new Client()
const Member = useMemberStore()

const initiallyOpen = ref(['CycloneDX'])
const initialState = {
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    artifacts: [
        { title: 'CycloneDX', children: [] },
        { title: 'SPDX', children: [] },
        { title: 'SARIF', children: [] },
        { title: 'VEX', children: [] },
        { title: 'VDR', children: [] },
    ],
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
            const pageSize = 50
            let hasMore = true
            let skip = 0
            while (hasMore) {
                const { data } = await client.get(`/artifact/files?take=${pageSize}&skip=${skip}`)
                if (data.ok) {
                    if (data?.artifacts) {
                        for (const artifact of data.artifacts) {
                            const { uuid, downloadLinks, type, bomFormat } = artifact
                            const { contentType, url } = downloadLinks.sort((a, b) => b.id - a.id).pop()
                            for (const group of state.artifacts) {
                                const suffix = contentType?.includes("json") ? 'json' : 'txt'
                                const file = { title: `${uuid}.${suffix}`, file: suffix, lastModified: artifact.date, uuid, url }
                                if (group.title === "SARIF" && contentType?.includes("sarif")) {
                                    group.children.push(file)
                                    break
                                } else if (group.title === "VEX" && type === "VEX") {
                                    group.children.push(file)
                                    break
                                } else if (group.title === "VDR" && type === "VDR") {
                                    group.children.push(file)
                                    break
                                } else if (group.title === bomFormat) {
                                    group.children.push(file)
                                    break
                                }
                            }
                        }
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
                    // setTimeout(() => router.push('/logout'), 2000)
                    return
                } else {
                    break
                }
                if (data.artifacts.length < pageSize) {
                    hasMore = false
                } else {
                    skip += pageSize
                }
            }
            // rekey index
            // state.artifacts.forEach((file, index) => {
            //   state.artifacts.splice(index, 1, file)
            // })
            state.loading = false
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
}

const controller = reactive(new Controller())
onMounted(() => Member.ensureSession().then(controller.refresh))

const files = ref({
    html: 'mdi-language-html5',
    js: 'mdi-nodejs',
    json: 'mdi-code-json',
    md: 'mdi-language-markdown',
    pdf: 'mdi-file-pdf-box',
    png: 'mdi-file-image',
    txt: 'mdi-file-document-outline',
    xls: 'mdi-file-excel',
})
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
        <VProgressLinear
            :active="state.loading"
            :indeterminate="state.loading"
            color="primary"
            absolute
            bottom
        ></VProgressLinear>
        <VSkeletonLoader
            v-if="state.loading"
            class=""
            max-width="380"
            type="avatar, heading@3, avatar, heading@2, avatar, heading@4, avatar, heading@2, avatar, heading@6, avatar, heading@3"
            tile
        ></VSkeletonLoader>
        <VTreeview
            v-else
            :items="state.artifacts"
            :opened="initiallyOpen"
            item-value="title"
            open-on-click
            slim
            activatable
            active-strategy="leaf"
            variant="flat"
        >
            <template v-slot:append="{ item, isOpen }">
                <time v-if="item?.lastModified">
                    <time :datetime="(new Date(item.lastModified)).toISOString()">
                        {{ timeAgo(new Date(item.lastModified)) }}
                    </time>
                    <VTooltip
                        activator="parent"
                        location="left"
                    >Last Modified {{ new Date(item.lastModified).toISOString() }}</VTooltip>
                </time>
                <!-- <span v-if="item?.children?.length">({{ item.children.length }} files)</span> -->
            </template>
            <template v-slot:prepend="{ item, isOpen }">
                <VIcon v-if="!item.file">
                    {{ isOpen ? 'mdi-folder-open' : 'mdi-folder' }}
                </VIcon>
                <VIcon v-else>
                    {{ files[item.file] }}
                </VIcon>
            </template>
        </VTreeview>

    </VCard>
</template>
