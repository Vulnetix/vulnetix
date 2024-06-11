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

const login = () => {
  if (state.email && state.password) {
    axios.get(`/login/${state.email}/${SHA1(state.password)}`)
      .then(console.log)
      .catch(console.log)

    localStorage.setItem('/member/email', state.email)
    localStorage.setItem('/session/token', "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmlhZ2UiLCJuYmYiOjE3MTgwMjQzNTgsImlhdCI6MTcxODAyNDM1OCwiZXhwIjoxNzE4MTEwNzU4LCJhdWQiOiJ1cm46dXVpZDowMGQwYzI3ZC1lNjA5LTRiMWMtYjIxMS02NzFjOGFjZDVhYWEiLCJpc3MiOiJ1cm46dXVpZDowMGQwYzI3ZC1lNjA5LTRiMWMtYjIxMS02NzFjOGFjZDVhYWEiLCJraWQiOiJ1cm46dXVpZDo0MjUwNWE1My05YzRiLTQ1OTgtYTcxYy03ZmQzMzI0ZGZhYTIiLCJuYW1lIjoiRGVtbyBVc2VyIiwicm9sZSI6InVybjp1dWlkOjdhZGE1YWNkLWQxOGYtNGZmNC04NDA5LTEzMjk3MmJhYmEyOCJ9.2bLuGpY9APA8qbPp73tk-7sDWO4IoLpC3ifRLWzs_O5jZG9b0kFtQhAo2DiBr_CRBsBYuMMb0zsxaW8Maa2uXQ")
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
        <h5 class="text-h5 mb-1 text-center">
          Trivial Triage
        </h5>
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
</style>
