import { describe, it, expect } from 'vitest'
import { proxyImageUrl } from '@/shared/lib/proxyImageUrl'

describe('proxyImageUrl', () => {
  it('преобразует Instagram CDN URL в proxy URL', () => {
    const result = proxyImageUrl('https://cdninstagram.com/avatar.jpg')
    expect(result).toBe('/api/proxy/image?url=https%3A%2F%2Fcdninstagram.com%2Favatar.jpg')
  })

  it('возвращает null при null', () => expect(proxyImageUrl(null)).toBeNull())

  it('корректно URL-кодирует специальные символы', () => {
    const url = 'https://cdn.example.com/path/file?x=1&y=2'
    const result = proxyImageUrl(url)
    expect(result).toBe(`/api/proxy/image?url=${encodeURIComponent(url)}`)
    expect(result).toContain('%3F')
    expect(result).toContain('%26')
  })
})
