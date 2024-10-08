<script setup>
import { useMemberStore } from '@/stores/member';
import { Client, isCDX, isJSON, isSARIF, isSPDX, timeAgo } from '@/utils';
import { reactive, ref } from 'vue';
import { useTheme } from 'vuetify';
import { VTreeview } from 'vuetify/labs/VTreeview';

const { global } = useTheme()
const client = new Client()
const Member = useMemberStore()

const initialState = {
    uploadError: "",
    uploadSuccess: "",
    error: "",
    warning: "",
    success: "",
    info: "",
    loading: false,
    uploading: false,
    files: [],
    openedDirs: [],
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
    state.uploadError = ''
    state.uploadSuccess = ''
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
                                const file = { title: `${uuid}.${suffix}`, ext: suffix, lastModified: artifact.date, uuid, url }
                                if (group.title === "SARIF" && contentType?.includes("sarif")) {
                                    if (!group.children.some(f => f.uuid === file.uuid)) {
                                        group.children.push(file)
                                    }
                                    break
                                } else if (group.title === "VEX" && type === "VEX") {
                                    if (!group.children.some(f => f.uuid === file.uuid)) {
                                        group.children.push(file)
                                    }
                                    break
                                } else if (group.title === "VDR" && type === "VDR") {
                                    if (!group.children.some(f => f.uuid === file.uuid)) {
                                        group.children.push(file)
                                    }
                                    break
                                } else if (group.title === bomFormat) {
                                    if (!group.children.some(f => f.uuid === file.uuid)) {
                                        group.children.push(file)
                                    }
                                    break
                                }
                            }
                        }
                        for (const group of state.artifacts) {
                            if (group.children.length === 0) {
                                group.children.push({ isEmpty: true })
                            }
                            if (state.openedDirs.length === 0) {
                                state.openedDirs.push(group.title)
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
                    setTimeout(() => router.push('/logout'), 2000)
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
            state.loading = false
        } catch (e) {
            console.error(e)
            state.error = `${e.code} ${e.message}`
            state.loading = false
        }
    }
    async upload() {
        clearAlerts()
        const sarif = []
        const spdx = []
        const cdx = []
        try {
            for (const blob of state.files) {
                const text = await blob.text()
                if (isJSON(text)) {
                    const json = JSON.parse(text)
                    try {
                        if (isSARIF(json)) {
                            sarif.push(json)
                        }
                    } catch (e) { }
                    try {
                        if (isSPDX(json)) {
                            spdx.push(json)
                        }
                    } catch (e) { }
                    try {
                        if (isCDX(json)) {
                            cdx.push(json)
                        }
                    } catch (e) { }
                }
            }
            let success = false
            if (sarif.length) {
                const data = await controller._handleUpload(`/sarif/upload`, sarif)
                if (data?.sarif?.length !== sarif.length) {
                    state.uploadError = "SARIF data upload failed."
                } else {
                    success = true
                }
            }
            if (spdx.length) {
                const data = await controller._handleUpload(`/spdx/upload`, spdx)
                if (data?.files?.length !== spdx.length) {
                    state.uploadError = "SPDX data upload failed."
                } else {
                    success = true
                }
            }
            if (cdx.length) {
                const data = await controller._handleUpload(`/cdx/upload`, cdx)
                if (data?.files?.length !== cdx.length) {
                    state.uploadError = "CDX data upload failed."
                } else {
                    success = true
                }
            }
            if (success) {
                await controller.refresh()
                state.uploadSuccess = "Upload succeded, you may close this dialogue now."
            }

            return
        } catch (e) {
            console.error(e)
            state.uploadError = typeof e === "string" ? e : `${e.code} ${e.message}`
            state.loading = false
        }
    }
    async _handleUpload(uri, files) {
        state.uploading = true
        const { data } = await client.post(uri, files)
        state.uploading = false
        if (typeof data === "string" && !isJSON(data)) {
            state.uploadError = "Artifact could not be uploaded, please try again later."

            return
        }
        if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
            state.uploadError = data.result

            // return setTimeout(() => router.push('/logout'), 2000)
        }
        if (data?.error?.message) {
            state.uploadError = data?.error?.message

            return
        }
        return data
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
        <VSheet class="d-flex flex-wrap">
            <VSheet class="flex-1-0 ms-4 pt-2">
                <VDialog
                    width="50%"
                    persistent
                >
                    <template v-slot:activator="{ props: activatorProps }">
                        <VBtn
                            prepend-icon="simple-line-icons:plus"
                            text="Upload"
                            variant="plain"
                            :color="global.name.value === 'dark' ? '#fff' : '#272727'"
                            v-bind="activatorProps"
                        />
                    </template>
                    <template v-slot:default="{ isActive }">
                        <VCard title="Select Artifact files">
                            <VProgressLinear
                                :active="state.uploading"
                                :indeterminate="state.uploading"
                                color="primary"
                                absolute
                                bottom
                            ></VProgressLinear>
                            <VAlert
                                v-if="state.uploadError"
                                color="error"
                                icon="$error"
                                title="Error"
                                :text="state.uploadError"
                                border="start"
                                variant="tonal"
                            />
                            <VAlert
                                v-if="state.uploadSuccess"
                                color="success"
                                icon="$success"
                                title="Success"
                                :text="state.uploadSuccess"
                                border="start"
                                variant="tonal"
                            />
                            <VDivider class="mt-3"></VDivider>
                            <VCardText class="px-4">
                                <VFileInput
                                    v-model="state.files"
                                    :show-size="1000"
                                    accept="application/json"
                                    label="File input"
                                    placeholder="Select your files"
                                    prepend-icon="mdi-paperclip"
                                    variant="outlined"
                                    counter
                                    multiple
                                >
                                    <template v-slot:selection="{ fileNames }">
                                        <template
                                            v-for="(fileName, index) in fileNames"
                                            :key="fileName"
                                        >
                                            <VChip
                                                v-if="index < 2"
                                                class="me-2"
                                                size="small"
                                                label
                                            >
                                                {{ fileName }}
                                            </VChip>

                                            <span
                                                v-else-if="index === 2"
                                                class="text-overline text-grey-darken-3 mx-2"
                                            >
                                                +{{ state.files.length - 2 }} File(s)
                                            </span>
                                        </template>
                                    </template>
                                </VFileInput>
                            </VCardText>
                            <VDivider></VDivider>
                            <VCardActions class="mt-3">
                                <VBtn
                                    text="Close"
                                    @click="isActive.value = false"
                                />
                                <VSpacer></VSpacer>
                                <VBtn
                                    text="Upload"
                                    variant="flat"
                                    @click="controller.upload"
                                />
                            </VCardActions>
                        </VCard>
                    </template>
                </VDialog>
            </VSheet>
            <VSheet class="me-4 mt-4 pt-2 text-overline">
                Last Modified
            </VSheet>
            <VSheet class="me-4 mt-4 pt-2 ps-4 text-overline">
                Actions
            </VSheet>
        </VSheet>
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
            :opened="state.openedDirs"
            item-value="title"
            open-on-click
            slim
            activatable
            active-strategy="leaf"
            variant="flat"
        >
            <template v-slot:append="{ item }">
                <span
                    class="mr-4"
                    v-if="item?.lastModified"
                >
                    <time :datetime="(new Date(item.lastModified)).toISOString()">
                        {{ timeAgo(new Date(item.lastModified)) }}
                    </time>
                    <VTooltip
                        activator="parent"
                        location="left"
                    >Last Modified {{ new Date(item.lastModified).toISOString() }}</VTooltip>
                </span>
                <VTooltip
                    v-if="item?.url"
                    text="Download Original"
                    location="top"
                >
                    <template v-slot:activator="{ props }">
                        <VBtn
                            v-bind="props"
                            variant="plain"
                            icon="line-md:cloud-alt-download-filled-loop"
                            density="comfortable"
                            color="secondary"
                            target="_blank"
                            :title="item.url"
                            :href="item.url"
                        >
                        </VBtn>
                    </template>
                </VTooltip>
                <VDialog
                    v-if="item?.uuid"
                    persistent
                    :activator="`#uuid${item.uuid.replaceAll('-', '_')}`"
                    max-width="340"
                >
                    <template v-slot:default="{ isActive }">
                        <VCard
                            prepend-icon="weui:delete-on-filled"
                            text="This will delete the SARIF Artifact permanantly, it cannot be undone."
                            title="Delete Artifact?"
                        >
                            <template v-slot:actions>
                                <VBtn
                                    class="ml-auto"
                                    text="Close"
                                    @click="isActive.value = false"
                                ></VBtn>
                                <VBtn
                                    color="error"
                                    variant="tonal"
                                    text="Delete"
                                    @click="controller.deleteArtifact(result, isActive)"
                                ></VBtn>
                            </template>
                        </VCard>
                    </template>
                </VDialog>
                <VTooltip
                    v-if="item?.uuid"
                    text="Delete"
                    location="top"
                >
                    <template v-slot:activator="{ props }">
                        <VBtn
                            v-bind="props"
                            :id="`uuid${item.uuid.replaceAll('-', '_')}`"
                            variant="plain"
                            icon="weui:delete-on-filled"
                            density="comfortable"
                            color="error"
                        >
                        </VBtn>
                    </template>
                </VTooltip>
            </template>
            <template v-slot:prepend="{ item, isOpen }">
                <template v-if="item?.isEmpty">
                    <VIcon
                        icon="iconoir:empty-page"
                        class="me-4"
                        @click.native.stop
                    />
                    <VAlert
                        border="start"
                        color="secondary"
                        title="No Files"
                        variant="tonal"
                        @click.native.stop
                    ></VAlert>
                </template>
                <template v-else-if="!item?.ext">
                    <VIcon>
                        {{ isOpen ? 'mdi-folder-open' : 'mdi-folder' }}
                    </VIcon>
                </template>
                <VIcon v-else>
                    {{ files[item.ext] }}
                </VIcon>
            </template>
        </VTreeview>
    </VCard>
</template>
