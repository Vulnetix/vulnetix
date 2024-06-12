<script setup>
import IconTrivialSecurity from '@images/IconTrivialSecurity.vue'
import { useVuelidate } from '@vuelidate/core'
import { email, required } from '@vuelidate/validators'
import axios from 'axios'
import { SHA1 } from 'crypto-es/lib/sha1'
import { reactive } from 'vue'
import router from "../router"

const initialState = {
  email: localStorage.getItem('/member/email') || '',
  password: '',
}

const state = reactive({
  ...initialState,
})

const rules = {
  email: { required, email },
  password: { required },
}

const v$ = useVuelidate(rules, state)
const isPasswordVisible = ref(false)

const login = async () => {
  if (state.email && state.password) {
    const data = await axios.get(`/login/${state.email}/${SHA1(state.password)}`)
    console.log('axios data', data)
    localStorage.setItem('/member/email', state.email)
    localStorage.setItem('/session/token', data.token)
    router.push('/dashboard')
  }
}
</script>

<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <VCard class="auth-card pa-4 pt-7" max-width="448">
      <VCardItem class="justify-center">
        <template #prepend>
          <div class="d-flex">
            <IconTrivialSecurity class="d-flex text-primary" width="150" />
          </div>
        </template>
      </VCardItem>

      <VCardText class="pt-2">
        <h5 class="text-h5 mb-0 text-center">
          Triage
        </h5>
        <div class="subheading mb-2 mt-0 text-center">
          By, Trivial Security
        </div>
        <p class="mb-0">
          Your Comprehensive Vulnerability Management Tool to automate decision and resolution reporting
        </p>
      </VCardText>

      <VCardText>
        <VForm @submit.prevent="login">
          <VRow>
            <!-- email -->
            <VCol cols="12">
              <VTextField v-model="state.email" autofocus placeholder="johndoe@email.com" label="Email" type="email" />
            </VCol>

            <!-- password -->
            <VCol cols="12">
              <VTextField required v-model="state.password" label="Password" placeholder="············"
                :type="isPasswordVisible ? 'text' : 'password'"
                :append-inner-icon="isPasswordVisible ? 'bx-hide' : 'bx-show'"
                @click:append-inner="isPasswordVisible = !isPasswordVisible" />
            </VCol>

            <!-- login button -->
            <VCol cols="12">
              <VBtn @click="v$.$validate" block text="Login" type="submit" />
            </VCol>

            <!-- create account -->
            <VCol cols="12" class="text-center text-base">
              <span>New on our platform?</span>
              <RouterLink class="text-primary ms-2" to="/register">
                Create an account
              </RouterLink>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
@use "@core/scss/template/pages/page-auth.scss";

.v-btn {
  text-transform: none;
}

.subheading {
  font-size: 0.8em;
}
</style>
