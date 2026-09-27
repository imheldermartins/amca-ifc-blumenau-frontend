export const IMAGE_COMPRESSION_PRESETS = {
  light: {
    id: 'light',
    labelKey: 'pages.block-editor.block-library.compression.light.label',
    descriptionKey: 'pages.block-editor.block-library.compression.light.description',
    maxDimension: 2_560,
    quality: 0.86,
    mimeType: 'image/webp',
  },
  balanced: {
    id: 'balanced',
    labelKey: 'pages.block-editor.block-library.compression.balanced.label',
    descriptionKey: 'pages.block-editor.block-library.compression.balanced.description',
    maxDimension: 1_920,
    quality: 0.78,
    mimeType: 'image/webp',
  },
  compact: {
    id: 'compact',
    labelKey: 'pages.block-editor.block-library.compression.compact.label',
    descriptionKey: 'pages.block-editor.block-library.compression.compact.description',
    maxDimension: 1_280,
    quality: 0.64,
    mimeType: 'image/webp',
  },
  aggressive: {
    id: 'aggressive',
    labelKey: 'pages.block-editor.block-library.compression.aggressive.label',
    descriptionKey: 'pages.block-editor.block-library.compression.aggressive.description',
    maxDimension: 960,
    quality: 0.48,
    mimeType: 'image/webp',
  },
} as const

export type ImageCompressionPresetId = keyof typeof IMAGE_COMPRESSION_PRESETS

export const DEFAULT_IMAGE_COMPRESSION_PRESET: ImageCompressionPresetId = 'aggressive'

export interface CompressedImage {
  dataUrl: string
  height: number
  mimeType: string
  originalBytes: number
  outputBytes: number
  width: number
}

interface ImageDimensions {
  height: number
  width: number
}

interface DecodedImage extends ImageDimensions {
  drawSource: CanvasImageSource
  release: () => void
}

export function compressedImageDimensions(
  width: number,
  height: number,
  maxDimension: number,
): ImageDimensions {
  if (width <= 0 || height <= 0 || maxDimension <= 0) {
    throw new RangeError('Image dimensions must be positive.')
  }

  const ratio = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

export function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.split(',', 2)[1] ?? ''
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new TypeError('The compressed image could not be encoded.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Image encoding failed.'))
    reader.readAsDataURL(blob)
  })
}

function canvasAsBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new TypeError('The browser could not compress this image.'))
      },
      mimeType,
      quality,
    )
  })
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return {
      drawSource: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  }

  const source = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = source
  await image.decode()
  return {
    drawSource: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(source),
  }
}

export async function compressImageBlob(
  blob: Blob,
  presetId: ImageCompressionPresetId = DEFAULT_IMAGE_COMPRESSION_PRESET,
): Promise<CompressedImage> {
  if (!blob.type.startsWith('image/')) {
    throw new TypeError('The selected file is not an image.')
  }

  const preset = IMAGE_COMPRESSION_PRESETS[presetId]
  const decoded = await decodeImage(blob)

  try {
    const dimensions = compressedImageDimensions(
      decoded.width,
      decoded.height,
      preset.maxDimension,
    )
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new TypeError('Canvas is unavailable for image compression.')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.drawSource, 0, 0, dimensions.width, dimensions.height)

    const compressed = await canvasAsBlob(canvas, preset.mimeType, preset.quality)
    return {
      dataUrl: await blobAsDataUrl(compressed),
      width: dimensions.width,
      height: dimensions.height,
      mimeType: compressed.type || preset.mimeType,
      originalBytes: blob.size,
      outputBytes: compressed.size,
    }
  } finally {
    decoded.release()
  }
}

export function compressImageFile(
  file: File,
  presetId: ImageCompressionPresetId = DEFAULT_IMAGE_COMPRESSION_PRESET,
): Promise<CompressedImage> {
  return compressImageBlob(file, presetId)
}

export async function compressImageDataUrl(
  dataUrl: string,
  presetId: ImageCompressionPresetId = DEFAULT_IMAGE_COMPRESSION_PRESET,
): Promise<CompressedImage> {
  if (!dataUrl.startsWith('data:image/')) {
    throw new TypeError('The pasted content is not an image data URL.')
  }
  const response = await fetch(dataUrl)
  return compressImageBlob(await response.blob(), presetId)
}
