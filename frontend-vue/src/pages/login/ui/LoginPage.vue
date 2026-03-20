<script setup lang="ts">
  import { LoginForm } from '@/features/auth-login'
  import { CardComponent, CardSectionComponent } from '@/shared/ui/card-component'
</script>

<template>
  <q-page class="login-page flex flex-center">
    <CardComponent class="login-card">
      <CardSectionComponent class="q-pa-xl">
        <LoginForm />
      </CardSectionComponent>
    </CardComponent>
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
