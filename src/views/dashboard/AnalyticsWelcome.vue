<script setup>
import pixImg from '@/assets/images/pix.png';
import { useMemberStore } from '@/stores/member';
import { default as axios } from 'axios';
import { reactive } from 'vue';

const Member = useMemberStore()

axios.defaults.headers.common = {
    'X-Vulnetix': Member.session?.token,
}
class Controller {
    constructor() {
        this.refresh()
    }

    async refresh() {
        try {
            const { data } = await axios.get(`/analytics`)
            if (data?.error?.message) {
                state.error = data?.error?.message
            }
            if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
                return router.push('/logout')
            }

        } catch (e) {
            console.error(e)
        }
    }
}

const controller = reactive(new Controller())
</script>

<template>
    <VCard class="text-center text-sm-start">
        <VRow no-gutters>
            <VCol
                cols="12"
                sm="8"
                order="2"
                order-sm="1"
            >
                <VCardItem>
                    <VCardTitle class="text-md-h5 text-primary">
                        Welcome {{ Member.firstName }}!
                    </VCardTitle>
                </VCardItem>

                <VCardText>
                    <span>
                        You have done 72% 🤩 more sales today.
                        <br>
                        Check your new raising badge in your profile.
                    </span>
                    <br>
                    <VBtn
                        variant="tonal"
                        class="mt-4"
                        size="small"
                    >
                        View Badges
                    </VBtn>
                </VCardText>
            </VCol>

            <VCol
                cols="12"
                sm="4"
                order="1"
                order-sm="2"
                class="text-center"
            >
                <img
                    :src="pixImg"
                    :height="$vuetify.display.xs ? '150' : '175'"
                    :class="$vuetify.display.xs ? 'mt-6 mb-n2' : 'position-absolute'"
                    class="john-illustration flip-in-rtl"
                >
            </VCol>
        </VRow>
    </VCard>
</template>

<style lang="scss" scoped>
.john-illustration {
    inset-block-end: -0.0625rem;
    inset-inline-end: 3rem;
}
</style>
