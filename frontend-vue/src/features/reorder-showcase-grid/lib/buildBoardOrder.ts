import type { ShowcaseMedia, ShowcaseBoardOrderItem } from '@/entities/showcase-media'

/**
 * Преобразует визуальный порядок плиток доски в payload для reorderBoard.
 * Позиция — индекс в массиве (0-based), порядок локальный и в Instagram не уходит.
 */
export const buildBoardOrder = (posts: ShowcaseMedia[]): ShowcaseBoardOrderItem[] =>
  posts.map((media, index) => ({ mediaPk: media.post.pk, position: index }))
