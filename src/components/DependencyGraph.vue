<script setup>
import { getPastelColor } from '@/utils';
import IconVulnetix from '@images/IconVulnetix.vue';
import { computed } from 'vue';
import { VTreeview } from 'vuetify/labs/VTreeview';

const props = defineProps({
    dependencies: {
        type: Array,
        required: true,
    },
})

const active = ref([])
const open = ref([])
const selected = ref(null)

const roots = computed(() => {
    return props.dependencies.filter(dep => dep.isDirect).map(item => {
        item.children = props.dependencies.filter(d => {
            return d.childOfKey === item.key
        })
        if (!item.children) {
            delete item.children
        }
        return item
    })
})

const openItem = ({ id }) => {
    selected.value = props.dependencies.find(item => item.key === id)
}

const activatedItem = activated => {
    const key = activated.pop()
    selected.value = props.dependencies.find(item => item.key === key)
}

const colours = {
    npm: 'rgb(249, 185, 193)',
    pypi: 'rgb(232, 225, 186)',
    golang: 'rgb(184, 245, 239)',
    githubactions: 'rgb(189, 193, 189)',
    cargo: 'rgb(254, 182, 180)',
    generic: 'rgb(213, 228, 230)',
}
const getEcosystemColor = ecosystem => (colours[ecosystem.toLowerCase()] || getPastelColor());
</script>

<template>
    <v-container
        fluid
        class="pa-0"
    >
        <v-card>
            <v-card-title>Dependency Tree</v-card-title>
            <VEmptyState
                v-if="!props.dependencies"
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
            </VEmptyState>
            <v-row
                class="pa-4"
                justify="space-between"
            >
                <v-col cols="5">
                    <VTreeview
                        v-model:activated="active"
                        v-model:opened="open"
                        :items="roots"
                        color="rgb(184, 242, 197)"
                        density="compact"
                        item-title="key"
                        item-value="key"
                        active-strategy="independent"
                        activatable
                        open-on-click
                        transition
                        @click:open="openItem"
                        @update:activated="activatedItem"
                    >
                        <template v-slot:prepend="{ item, isOpen }">
                            <VIcon
                                icon="mage:package-box-fill"
                                v-if="!isOpen"
                            />
                            <VIcon
                                icon="lucide:package-open"
                                v-else
                            />
                        </template>
                        <template v-slot:title="{ item }">
                            {{ [item.name, item.version].filter(i => !!i).join('@') }}
                        </template>
                        <template v-slot:append="{ item }">
                            <VChip
                                :color="getEcosystemColor(item.packageEcosystem)"
                                size="small"
                                class="mr-2"
                            >{{ item.packageEcosystem }}</VChip>
                        </template>
                    </VTreeview>
                </v-col>

                <v-divider vertical></v-divider>

                <v-col
                    class="d-flex text-center"
                    v-if="selected"
                >
                    <v-scroll-y-transition mode="out-in">
                        <v-card
                            :key="selected.key"
                            class="pt-6 mx-auto"
                            max-width="400"
                            flat
                        >
                            <v-card-text>
                                <!-- <v-avatar
                                    v-if="avatar"
                                    size="88"
                                >
                                    <v-img
                                        :src="`https://avataaars.io/${avatar}`"
                                        class="mb-6"
                                    ></v-img>
                                </v-avatar> -->
                                <h3 class="text-h5 mb-2">
                                    {{ selected.name }}
                                </h3>
                                <div class="text-blue mb-2">
                                    {{ selected.version }}
                                </div>
                                <div class="text-blue subheading font-weight-bold">
                                    {{ selected.purl }}
                                </div>
                            </v-card-text>
                            <v-divider></v-divider>
                            <v-row
                                class="text-left"
                                tag="v-card-text"
                            >
                                <v-col
                                    class="text-right me-4 mb-2"
                                    cols="5"
                                    tag="strong"
                                >
                                    License:
                                </v-col>
                                <v-col>{{ selected.license }}</v-col>
                                <v-col
                                    class="text-right me-4 mb-2"
                                    cols="5"
                                    tag="strong"
                                >
                                    Ecosystem:
                                </v-col>
                                <v-col>{{ selected.packageEcosystem }}</v-col>
                            </v-row>
                        </v-card>
                    </v-scroll-y-transition>
                </v-col>
            </v-row>
        </v-card>
    </v-container>
</template>

<style scoped></style>
