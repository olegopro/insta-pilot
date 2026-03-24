<script setup lang="ts">
  import { LoginForm } from '@/features/auth-login'
  import { CardComponent, CardSectionComponent } from '@/shared/ui/card-component'
  import RobotIcon from '@/shared/ui/icons/RobotIcon.vue'
</script>

<template>
  <q-page class="login-page flex flex-center">
    <div class="watermark" aria-hidden="true">
      <div v-for="n in 500" :key="n" class="watermark-unit">
        <RobotIcon :size="36" />
        <span>INSTA PILOT</span>
      </div>
    </div>
    <CardComponent class="login-card">
      <CardSectionComponent class="q-pa-xl">
        <LoginForm />
      </CardSectionComponent>
    </CardComponent>
  </q-page>
</template>

<style scoped lang="scss">
.login-page {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg,  $primary 90%, $action-search 200%, $surface-primary 20%);
  min-height: 100vh;
}

.watermark {
  position: absolute;
  inset: -50%;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 40px 72px;
  transform: rotate(-24deg);
  opacity: 0.12;
  pointer-events: none;
  color: white;
}

.watermark-unit {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: 4px;
  font-size: 22px;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 500px;
  border-radius: $radius-xl;
  backdrop-filter: blur(6px);
}
</style>
