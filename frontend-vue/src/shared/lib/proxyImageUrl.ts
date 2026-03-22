import type { Nullable } from './types'

export const proxyImageUrl = (url: Nullable<string>): Nullable<string> =>
  url ? `/api/proxy/image?url=${encodeURIComponent(url)}` : null
