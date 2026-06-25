<script setup lang="ts">
  import { ref, watch } from 'vue'
  import draggable from 'vuedraggable'
  import { useShowcaseStore, ShowcaseTile } from '@/entities/showcase-media'
  import type { ShowcaseMedia } from '@/entities/showcase-media'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { buildBoardOrder } from '@/features/reorder-showcase-grid/lib/buildBoardOrder'

  const props = defineProps<{
    posts: ShowcaseMedia[]
    accountId: number
    selectedPk?: string
  }>()

  defineEmits<{
    open: [media: ShowcaseMedia]
    select: [media: ShowcaseMedia]
  }>()

  const showcaseStore = useShowcaseStore()
  const localPosts = ref<ShowcaseMedia[]>([...props.posts])

  const itemKey = (media: ShowcaseMedia) => media.post.pk

  const dragEndHandler = () => showcaseStore.reorderBoard(props.accountId, buildBoardOrder(localPosts.value))

  watch(() => props.posts, (posts) => localPosts.value = [...posts])
</script>

<template>
  <div class="board-editor">
    <div class="board-hint">
      <BadgeComponent
        icon="info"
        color="warning"
        size="sm"
        label="Порядок локальный — в Instagram не меняется"
      />
      <q-spinner v-if="showcaseStore.reorderBoardLoading" size="16px" color="primary" />
    </div>

    <draggable
      v-model="localPosts"
      :item-key="itemKey"
      class="showcase-grid"
      :animation="150"
      ghost-class="tile-ghost"
      @end="dragEndHandler"
    >
      <template #item="{ element }">
        <div
          class="grid-cell"
          @click="$emit('select', element)"
          @dblclick="$emit('open', element)"
        >
          <ShowcaseTile :media="element" :selected="element.post.pk === selectedPk" />
        </div>
      </template>
    </draggable>
  </div>
</template>

<style scoped lang="scss">
  .board-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-inline-gap;
    padding: $indent-sm;
  }

  .showcase-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .grid-cell {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  .tile-ghost {
    opacity: 0.4;
  }
</style>
