import type { Nullable } from './types'

export const proxyMediaUrl = (url: Nullable<string>, accountId: number): Nullable<string> =>
  url ? `/api/proxy/media/${String(accountId)}?url=${encodeURIComponent(url)}` : null

export const proxyAvatarUrl = (url: Nullable<string>): Nullable<string> =>
  url ? `/api/proxy/avatar?url=${encodeURIComponent(url)}` : null
