<script setup lang="ts">
  import { computed } from 'vue'

  export interface CaptionTextProps {
    text: string
    accountId?: number | undefined
  }

  const props = defineProps<CaptionTextProps>()

  const HASHTAG_REGEX = /#([\w\u0400-\u04FF]+)/g

  type TextSegment =
    | { type: 'text'; value: string }
    | { type: 'hashtag'; value: string; tag: string }

  const segments = computed<TextSegment[]>(() => {
    const result: TextSegment[] = []
    let lastIndex = 0

    for (const match of props.text.matchAll(HASHTAG_REGEX)) {
      const tag = match[1]
      if (tag === undefined) continue
      const offset = match.index
      if (offset > lastIndex) {
        result.push({ type: 'text', value: props.text.slice(lastIndex, offset) })
      }
      result.push({ type: 'hashtag', value: match[0], tag })
      lastIndex = offset + match[0].length
    }

    if (lastIndex < props.text.length) {
      result.push({ type: 'text', value: props.text.slice(lastIndex) })
    }

    return result
  })

  const buildHashtagUrl = (tag: string): string => {
    const params = new URLSearchParams({ mode: 'hashtag', tag })
    props.accountId && params.set('account', String(props.accountId))
    return `/search?${params.toString()}`
  }
</script>

<template>
  <p class="caption-text">
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="segment.type === 'text'">{{ segment.value }}</span>
      <a
        v-else
        :href="buildHashtagUrl(segment.tag)"
        class="hashtag-link"
        target="_blank"
        rel="noopener noreferrer"
      >{{ segment.value }}</a>
    </template>
  </p>
</template>

<style scoped lang="scss">
  .caption-text {
    margin: 0;
    font-size: $font-size-base;
    line-height: $line-height-normal;
    white-space: pre-wrap;
    word-break: break-word;

    .hashtag-link {
      color: $primary;
      text-decoration: none;
      cursor: pointer;

      &:hover {
        color: darken($primary, 15%);
      }
    }
  }
</style>
