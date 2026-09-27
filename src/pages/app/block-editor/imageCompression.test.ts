import { describe, expect, it } from 'vitest'

import {
  DEFAULT_IMAGE_COMPRESSION_PRESET,
  IMAGE_COMPRESSION_PRESETS,
  compressedImageDimensions,
  dataUrlByteLength,
} from './imageCompression'

describe('image compression presets', () => {
  it('usa duas camadas configuradas pelo preset mais agressivo', () => {
    expect(DEFAULT_IMAGE_COMPRESSION_PRESET).toBe('aggressive')
    expect(IMAGE_COMPRESSION_PRESETS.aggressive).toMatchObject({
      maxDimension: 960,
      mimeType: 'image/webp',
      quality: 0.48,
    })
  })

  it('reduz a maior dimensão e preserva a proporção', () => {
    expect(compressedImageDimensions(4_000, 3_000, 2_000)).toEqual({
      width: 2_000,
      height: 1_500,
    })
    expect(compressedImageDimensions(800, 600, 1_920)).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('calcula o tamanho binário aproximado do payload base64', () => {
    expect(dataUrlByteLength('data:image/png;base64,AQIDBA==')).toBe(4)
  })
})
