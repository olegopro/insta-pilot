<script setup lang="ts">
  import type { LoginRequest } from 'src/models/AccountModel'
  import { useAccountStore } from 'src/stores/AccountsStore'
  import { ref } from 'vue'
  const store = useAccountStore()

  const form = ref<LoginRequest>({
    instagram_login: '',
    instagram_password: ''
  })

  const submitHandler = async () => await store.login.execute(form.value)
</script>

<template>
  <q-page class="flex flex-center">
    <q-form
      style="width: 360px"
      @submit="submitHandler"
    >
      <q-input
        v-model="form.instagram_login"
        label="Логин"
      />
      <q-input
        v-model="form.instagram_password"
        label="Пароль"
        type="password"
      />

      <!-- ошибка если success = false -->
      <q-banner
        v-if="store.login.data?.success === false"
        class="text-negative"
      >
        <!-- {{ store.login.data.error }} -->
      </q-banner>

      <q-btn type="submit" label="Войти" />
    </q-form>
  </q-page>
</template>
