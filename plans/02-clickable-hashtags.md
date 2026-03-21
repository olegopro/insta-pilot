# Задача 2: Кликабельные хэштеги в PostDetailModal

## Цель

В описании поста (captionText) в модальном окне PostDetailModal хэштеги (`#travel`, `#москва`) должны отображаться как кликабельные ссылки. Клик → открытие `/search?mode=hashtag&tag=NAME&account=ID` в новой вкладке.

## Текущее состояние

**Файл:** `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue:116`

Описание поста выводится как plain text:
```html
<p v-if="post.captionText">{{ post.captionText }}</p>
```

Хэштеги не парсятся, не кликабельны.

**Контекст аккаунта:** `accountId` уже передаётся как проп в PostDetailModal.

## Реализация

### Шаг 1: Компонент CaptionText

Создать shared-компонент для рендеринга текста с кликабельными хэштегами.

**Файл:** `frontend-vue/src/shared/ui/caption-text/CaptionText.vue`

Компонент парсит текст, находит `#hashtag` и заменяет их на `<router-link>` или `<a>`.

```typescript
// Props
interface CaptionTextProps {
  text: string
  accountId?: number
}
```

**Логика парсинга:**
- Регулярное выражение: `/#([\w\u0400-\u04FFа-яА-ЯёЁ]+)/g` — поддержка латиницы, кириллицы, цифр, подчёркивания
- Разбить текст на сегменты: plain text + hashtag links
- Каждый хэштег рендерится как `<a>` с `href` вида `/search?mode=hashtag&tag=NAME&account=ID` и `target="_blank"`
- Стилизация: цвет primary, без подчёркивания, hover — подчёркивание

```typescript
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const HASHTAG_REGEX = /#([\w\u0400-\u04FFа-яА-ЯёЁ]+)/g

interface TextSegment {
  type: 'text' | 'hashtag'
  value: string
  tag?: string  // имя хэштега без #
}

const segments = computed<TextSegment[]>(() => {
  const result: TextSegment[] = []
  let lastIndex = 0

  props.text.replace(HASHTAG_REGEX, (match, tag, offset) => {
    if (offset > lastIndex) {
      result.push({ type: 'text', value: props.text.slice(lastIndex, offset) })
    }
    result.push({ type: 'hashtag', value: match, tag })
    lastIndex = offset + match.length
    return match
  })

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
```

**Шаблон:**
```html
<template>
  <p class="caption-text">
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="segment.type === 'text'">{{ segment.value }}</span>
      <a
        v-else
        :href="buildHashtagUrl(segment.tag!)"
        class="hashtag-link"
        target="_blank"
        @click.prevent="navigateToHashtag(segment.tag!)"
      >{{ segment.value }}</a>
    </template>
  </p>
</template>
```

**Обработка клика:**
- Обычный клик (ЛКМ) — `@click.prevent` + `window.open()` для открытия в новой вкладке
- Ctrl+Click / Cmd+Click — стандартное поведение `<a>` с `target="_blank"`
- Средняя кнопка мыши — стандартное поведение `<a>` с `href`

```typescript
const navigateToHashtag = (tag: string) => {
  window.open(buildHashtagUrl(tag), '_blank')
}
```

### Шаг 2: Индекс компонента

**Файл:** `frontend-vue/src/shared/ui/caption-text/index.ts`
```typescript
export { default as CaptionText } from './CaptionText.vue'
```

### Шаг 3: Использование в PostDetailModal

**Файл:** `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue`

Заменить:
```html
<p v-if="post.captionText">{{ post.captionText }}</p>
```

На:
```html
<CaptionText v-if="post.captionText" :text="post.captionText" :account-id="accountId" />
```

### Шаг 4: Стили

```scss
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
      text-decoration: underline;
    }
  }
}
```

## Где используется PostDetailModal

PostDetailModal используется в двух местах:
1. **SearchPage.vue** — поиск (accountId берётся из `selectedAccount.id`)
2. **FeedPage.vue** — лента (accountId берётся из `selectedAccount.id`)

В обоих случаях `accountId` уже передаётся как проп — дополнительных изменений не требуется.

## Файлы для создания

| Файл | Описание |
|------|----------|
| `frontend-vue/src/shared/ui/caption-text/CaptionText.vue` | Компонент рендеринга текста с хэштегами |
| `frontend-vue/src/shared/ui/caption-text/index.ts` | Реэкспорт |

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `frontend-vue/src/features/post-detail/ui/PostDetailModal.vue` | Заменить `<p>` на `<CaptionText>` |

## Зависимости

- **Задача 1** должна быть выполнена первой — чтобы URL `/search?mode=hashtag&tag=...` корректно обрабатывался роутером

## Тестирование

1. Открыть пост с хэштегами в описании → хэштеги выделены цветом
2. Навести на хэштег → появляется подчёркивание, курсор pointer
3. Клик по хэштегу → новая вкладка с поиском по этому хэштегу
4. Пост без хэштегов → текст отображается как раньше
5. Кириллические хэштеги (`#москва`) → корректно парсятся
6. Хэштег в начале/конце/середине текста → корректно парсится
7. Несколько хэштегов подряд (`#a #b #c`) → все кликабельные
