<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAuthStore } from '@/entities/user'
  import { notifyError } from '@/shared/lib'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

  const router = useRouter()
  const authStore = useAuthStore()

  const email = ref('')
  const password = ref('')

  const submitHandler = async () => {
    await authStore.login({ email: email.value, password: password.value })
      .then(() => router.push('/'))
      .catch(() => notifyError(authStore.loginError ?? 'Ошибка входа'))
  }
</script>

<template>
  <q-form class="login-form" @submit="submitHandler">
    <div class="text-h5 q-mb-lg">Вход в систему</div>

    <InputComponent
      v-model="email"
      label-text="Email"
      type="email"
      autocomplete="email"
      :rules="[(v: string) => !!v || 'Обязательное поле']"
    />

    <InputComponent
      v-model="password"
      label-text="Пароль"
      type="password"
      autocomplete="current-password"
      class="q-mt-md"
      :rules="[(v: string) => !!v || 'Обязательное поле']"
    />

    <ButtonComponent
      type="submit"
      color="primary"
      class="full-width q-mt-lg"
      :loading="authStore.loginLoading"
    >
      Войти
    </ButtonComponent>
  </q-form>
</template>
