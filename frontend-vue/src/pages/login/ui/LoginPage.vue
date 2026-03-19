<script setup lang="ts">
  import { LoginForm } from '@/features/auth-login'
</script>

<template>
  <q-page class="login-page flex flex-center">
    <q-card class="login-card">
      <q-card-section class="q-pa-xl">
        <LoginForm />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped lang="scss">
.login-page {
  background-color: $primary;
  min-height: 100vh;
}

.login-card {
  width: 100%;
  max-width: 500px;
  border-radius: $radius-xl;
}
</style>
