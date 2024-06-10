<script setup>
import IconTrivialSecurity from '@images/IconTrivialSecurity.vue'
import { useVuelidate } from '@vuelidate/core'
import { email, required } from '@vuelidate/validators'
import { PBKDF2 } from 'crypto-es/lib/pbkdf2'
import { WordArray } from 'crypto-es/lib/core'
import { reactive } from 'vue'
import router from "../router"

const initialState = {
  org: '',
  email: localStorage.getItem('/member/email') || '',
  password: '',
  privacyPolicies: false,
}

const state = reactive({
  ...initialState,
})

const rules = {
  org: { required },
  email: { required, email },
  password: { required },
  privacyPolicies: { required },
}

const v$ = useVuelidate(rules, state)
const isPasswordVisible = ref(false)

const register = () => {
  if (state.org && state.email && state.password && state.privacyPolicies) {
    // Do register
    // axios.get("http://local.getusers.com)
    //   .then(response => {
    //       this.users = response.data;
    //   })
    //   .catch(error => {
    //       console.log(error)
    //   })
    const salt = WordArray.random(128/8)
    const passwordHash = PBKDF2(state.password, salt, { keySize: 512/32, iterations: 1000 })
    localStorage.setItem('/account/name', state.org)
    localStorage.setItem('/member/email', state.email)
    localStorage.setItem('/member/password', passwordHash)
    localStorage.setItem('/session/token', "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmlhZ2UiLCJuYmYiOjE3MTgwMjQzNTgsImlhdCI6MTcxODAyNDM1OCwiZXhwIjoxNzE4MTEwNzU4LCJhdWQiOiJ1cm46dXVpZDowMGQwYzI3ZC1lNjA5LTRiMWMtYjIxMS02NzFjOGFjZDVhYWEiLCJpc3MiOiJ1cm46dXVpZDowMGQwYzI3ZC1lNjA5LTRiMWMtYjIxMS02NzFjOGFjZDVhYWEiLCJraWQiOiJ1cm46dXVpZDo0MjUwNWE1My05YzRiLTQ1OTgtYTcxYy03ZmQzMzI0ZGZhYTIiLCJuYW1lIjoiRGVtbyBVc2VyIiwicm9sZSI6InVybjp1dWlkOjdhZGE1YWNkLWQxOGYtNGZmNC04NDA5LTEzMjk3MmJhYmEyOCJ9.2bLuGpY9APA8qbPp73tk-7sDWO4IoLpC3ifRLWzs_O5jZG9b0kFtQhAo2DiBr_CRBsBYuMMb0zsxaW8Maa2uXQ")
    router.push('/dashboard')
  } else {
    console.log('Form is invalid', state.email, state.password)
  }
}
</script>

<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <VCard
      class="auth-card pa-4 pt-7"
      max-width="448"
    >
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
          Make vulnerability management easy and fun!
        </p>
      </VCardText>

      <VCardText>
        <VForm @submit.prevent="register">
          <VRow>
            <!-- Org -->
            <VCol cols="12">
              <VTextField
                required
                v-model="state.org"
                autofocus
                label="Organization"
                placeholder="ACME Corp."
              />
            </VCol>
            <!-- email -->
            <VCol cols="12">
              <VTextField
                required
                v-model="state.email"
                label="Email"
                placeholder="johndoe@email.com"
                type="email"
              />
            </VCol>

            <!-- password -->
            <VCol cols="12">
              <VTextField
                required
                v-model="state.password"
                label="Password"
                placeholder="············"
                :type="isPasswordVisible ? 'text' : 'password'"
                :append-inner-icon="isPasswordVisible ? 'bx-hide' : 'bx-show'"
                @click:append-inner="isPasswordVisible = !isPasswordVisible"
              />
              <div class="d-flex align-center mt-1 mb-4">
                <VCheckbox
                  required
                  id="privacy-policy"
                  v-model="state.privacyPolicies"
                  inline
                />
                <VLabel
                  for="privacy-policy"
                  style="opacity: 1;"
                >
                  <span class="me-1">I agree to</span>
                  <a
                    href="javascript:void(0)"
                    class="text-primary"
                  >privacy policy & terms</a>
                </VLabel>
              </div>

              <VBtn
                @click="v$.$validate"
                block
                text="Sign up"
                type="submit"
              />
            </VCol>

            <!-- login instead -->
            <VCol
              cols="12"
              class="text-center text-base"
            >
              <span>Already have an account?</span>
              <RouterLink
                class="text-primary ms-2"
                to="/login"
              >
                Sign in instead
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
