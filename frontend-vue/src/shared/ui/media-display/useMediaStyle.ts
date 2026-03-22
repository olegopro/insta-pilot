import { computed } from 'vue'
import { MEDIA_TYPE } from '@/entities/media-post'
import type { MediaPost } from '@/entities/media-post'

/**
 * Возвращает CSS-строку `"W / H"` для свойства aspect-ratio.
 */
function buildAspectRatio(width: number, height: number): string {
  return `${String(width)} / ${String(height)}`
}

/**
 * Возвращает CSS-выражение `min(maxWidth, calc(maxHeight * ratio))`.
 *
 * Используется как `min-width` на медиа-элементе, чтобы браузер резервировал
 * правильный размер контейнера ещё до загрузки метаданных (предотвращает layout flash).
 */
function buildMinWidth(ratio: number, maxWidth: string, maxHeight: string): string {
  return `min(${maxWidth}, calc(${maxHeight} * ${String(ratio)}))`
}

/**
 * Вычисляет реактивные CSS-стили для медиа-элементов (видео, изображение, карусель).
 *
 * Все размеры определяются через `max-width`/`max-height`/`aspect-ratio` без фиксированных px,
 * что позволяет контейнеру адаптироваться к пропорциям контента.
 */
export function useMediaStyle(
  getPost: () => MediaPost,
  getMaxWidth: () => string,
  getMaxHeight: () => string
) {
  /**
   * CSS `aspect-ratio` для `<video>`.
   * Берётся из `videoWidth`/`videoHeight`; при отсутствии данных — `9 / 16` (портретный Reel).
   */
  const videoAspectRatio = computed(() => {
    const { videoWidth, videoHeight } = getPost()
    return videoWidth && videoHeight ? buildAspectRatio(videoWidth, videoHeight) : '9 / 16'
  })

  /**
   * CSS `min-width` для `<video>`.
   * Рассчитывается заранее из известного aspect-ratio, чтобы элемент сразу
   * занял правильную ширину до загрузки метаданных видео.
   */
  const videoMinWidth = computed(() => {
    const { videoWidth, videoHeight } = getPost()
    const ratio = videoWidth && videoHeight ? videoWidth / videoHeight : 9 / 16
    return buildMinWidth(ratio, getMaxWidth(), getMaxHeight())
  })

  /**
   * CSS `aspect-ratio` для `<img>`.
   * Берётся из `thumbnailWidth`/`thumbnailHeight`; `undefined` если данных нет
   * (браузер использует intrinsic ratio загруженного изображения).
   */
  const imageAspectRatio = computed((): string | undefined => {
    const { thumbnailWidth, thumbnailHeight } = getPost()
    return thumbnailWidth && thumbnailHeight
      ? buildAspectRatio(thumbnailWidth, thumbnailHeight)
      : undefined
  })

  /**
   * CSS `min-width` для `<img>`.
   * Аналогично `videoMinWidth` — предотвращает коллапс контейнера до загрузки изображения.
   */
  const imageMinWidth = computed(() => {
    const { thumbnailWidth, thumbnailHeight } = getPost()
    if (!thumbnailWidth || !thumbnailHeight) return '0px'
    return buildMinWidth(thumbnailWidth / thumbnailHeight, getMaxWidth(), getMaxHeight())
  })

  /**
   * Объект стилей для Swiper-карусели.
   * Если у первого ресурса известны размеры — карусель получает `aspect-ratio` и `min-width`
   * (те же принципы, что для видео/фото). Иначе — fallback на явную ширину.
   */
  const carouselStyle = computed(() => {
    const first = getPost().resources.at(0)
    if (first?.width && first.height) {
      const ratio = first.width / first.height
      return {
        width: 'auto',
        height: 'auto',
        minWidth: buildMinWidth(ratio, getMaxWidth(), getMaxHeight()),
        maxWidth: getMaxWidth(),
        maxHeight: getMaxHeight(),
        aspectRatio: buildAspectRatio(first.width, first.height)
      }
    }
    return { width: getMaxWidth(), height: 'auto', maxHeight: getMaxHeight() }
  })

  /**
   * Список URL изображений для отображения.
   * Для карусели — URL превью каждого слайда; для фото/видео — одиночный thumbnail.
   */
  const displayImages = computed(() => {
    const post = getPost()
    if (post.mediaType === MEDIA_TYPE.CAROUSEL && post.resources.length > 0) {
      return post.resources.map((resource) => resource.thumbnailUrl ?? '').filter(Boolean)
    }
    return post.thumbnailUrl ? [post.thumbnailUrl] : []
  })

  return { videoAspectRatio, videoMinWidth, imageAspectRatio, imageMinWidth, carouselStyle, displayImages }
}
