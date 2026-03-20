<script setup lang="ts">
  import { ButtonComponent } from '@/shared/ui/button-component'
</script>

<template>
  <div class="fullscreen bg-blue text-white text-center q-pa-md flex flex-center">
    <div>
      <div style="font-size: 30vh">
        404
      </div>

      <div
        style="opacity: 0.4"
        class="text-h2"
      >
        Oops. Nothing here...
      </div>

      <ButtonComponent
        color="white"
        text-color="blue"
        unelevated
        class="q-mt-xl"
        to="/"
        label="Go Home"
        no-caps
      />
    </div>
  </div>
</template>
