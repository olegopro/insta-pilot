<script setup lang="ts">
  export interface BadgeComponentProps {
    label?: string
    color?: string
    size?: 'sm' | 'md' | 'lg'
    icon?: string
    outline?: boolean
  }

  const props = withDefaults(defineProps<BadgeComponentProps>(), {
    color: 'primary',
    size: 'md'
  })
</script>

<template>
  <span
    :class="[
      'badge-component',
      `badge-component--${props.size}`,
      props.outline
        ? [`badge-component--outline`, `badge-component--outline-${props.color}`]
        : `bg-${props.color}`
    ]"
  >
    <q-icon v-if="props.icon" :name="props.icon" class="badge-icon" />
    <slot>{{ props.label }}</slot>
  </span>
</template>

<style scoped lang="scss">
  .badge-component {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $indent-2xs;
    font-weight: $font-weight-semibold;
    color: #fff;
    line-height: 1;
    white-space: nowrap;

    &--sm {
      font-size: $font-size-2xs;
      padding: $indent-2xs $indent-s;
      border-radius: $radius-xs;
    }

    &--md {
      font-size: $font-size-xs;
      padding: $indent-xs $spacing-inline-gap;
      border-radius: $radius-sm;
    }

    &--lg {
      font-size: $font-size-sm;
      padding: $indent-xs $spacing-stack-gap;
      border-radius: $radius-md;
    }

    .badge-icon {
      font-size: inherit;
    }

    &--outline {
      background: transparent;
      border: $border-width-default $border-style-default currentColor;

      &-primary   { color: $primary; }
      &-positive  { color: $positive; }
      &-negative  { color: $negative; }
      &-warning   { color: $warning; }
      &-grey      { color: $content-secondary; border-color: $border-default; }
    }
  }
</style>
