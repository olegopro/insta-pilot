<script setup lang="ts">
  import { ref } from 'vue'
  import { useAccountStore } from 'src/entities/instagram-account/model/accountStore'
  import type { LoginRequest } from 'src/entities/instagram-account/model/types'
  import { InputComponent } from 'src/shared/ui/input-component'

  const store = useAccountStore()

  const form = ref<LoginRequest>({
    instagram_login: '',
    instagram_password: ''
  })

  const submitHandler = async () => await store.login.execute(form.value)
</script>

<template>
  <q-page class="flex flex-center">
    <q-form @submit="submitHandler">
      <InputComponent
        v-model="form.instagram_login"
        label-text="Логин"
      />
      <InputComponent
        v-model="form.instagram_password"
        label-text="Пароль"
        type="password"
      />

      <q-banner
        v-if="store.login.data?.success === false"
        class="text-negative"
      >
        <!-- {{ store.login.data.error }} -->
      </q-banner>

      <q-btn
        type="submit"
        label="Войти"
      />
    </q-form>
  </q-page>
</template>
