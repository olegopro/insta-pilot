<script setup lang="ts">
  import { LoginForm } from '@/features/auth-login'
</script>

<template>
  <q-page class="flex flex-center">
    <q-card class="login-card">
      <q-card-section>
        <LoginForm />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
}
</style>
