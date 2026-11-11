export type Edit = {
  width: number; height: number; aspect: boolean; cropX: number; cropY: number; cropWidth: number; cropHeight: number;
  rotation: number; flipX: boolean; flipY: boolean; brightness: number; contrast: number; saturation: number;
  grayscale: number; sepia: number; invert: number; blur: number; pixelate: number; watermark: string;
  watermarkSize: number; watermarkColor: string; watermarkOpacity: number; position: string;
  format: string; quality: number; background: string; transparent: boolean;
}
export const defaults: Edit = { width: 0, height: 0, aspect: true, cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0, rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, invert: 0, blur: 0, pixelate: 1, watermark: '', watermarkSize: 32, watermarkColor: '#ffffff', watermarkOpacity: 65, position: 'bottom-right', format: 'image/png', quality: 85, background: '#ffffff', transparent: true }
export const imageTools = [
  { id: 'resize', name: 'Resize', category: 'Geometry' }, { id: 'crop', name: 'Crop', category: 'Geometry' },
  { id: 'rotate', name: 'Rotate', category: 'Geometry' }, { id: 'flip', name: 'Flip / mirror', category: 'Geometry' },
  { id: 'convert', name: 'Format converter', category: 'Export' }, { id: 'compress', name: 'Compress', category: 'Export' },
  { id: 'background', name: 'Background / transparency', category: 'Export' }, { id: 'batch', name: 'Batch export', category: 'Export' },
  { id: 'grayscale', name: 'Grayscale', category: 'Adjustments' }, { id: 'sepia', name: 'Sepia', category: 'Adjustments' },
  { id: 'brightness', name: 'Brightness', category: 'Adjustments' }, { id: 'contrast', name: 'Contrast', category: 'Adjustments' },
  { id: 'saturation', name: 'Saturation', category: 'Adjustments' }, { id: 'blur', name: 'Blur', category: 'Adjustments' },
  { id: 'invert', name: 'Invert', category: 'Adjustments' }, { id: 'pixelate', name: 'Pixelate', category: 'Adjustments' },
  { id: 'watermark', name: 'Text watermark', category: 'Composition' }, { id: 'contact-sheet', name: 'Contact sheet', category: 'Composition' },
  { id: 'metadata', name: 'Metadata inspector', category: 'Analysis' }, { id: 'palette', name: 'Color palette', category: 'Analysis' },
]
export function dimensions(sourceWidth: number, sourceHeight: number, edit: Edit) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth < 1 || sourceHeight < 1 || sourceWidth * sourceHeight > 16_000_000) throw new Error('Images are limited to 16 megapixels.')
  for (const value of [edit.width, edit.height, edit.cropX, edit.cropY, edit.cropWidth, edit.cropHeight]) if (!Number.isInteger(value) || value < 0) throw new Error('Dimensions and crop coordinates must be non-negative integers.')
  const cropWidth = edit.cropWidth || sourceWidth - edit.cropX
  const cropHeight = edit.cropHeight || sourceHeight - edit.cropY
  if (cropWidth < 1 || cropHeight < 1 || edit.cropX + cropWidth > sourceWidth || edit.cropY + cropHeight > sourceHeight) throw new Error('Crop rectangle must be inside the source image.')
  let width = edit.width || cropWidth
  let height = edit.height || cropHeight
  if (edit.aspect) { if (edit.width) height = Math.round(width * cropHeight / cropWidth); else if (edit.height) width = Math.round(height * cropWidth / cropHeight) }
  if (![0, 90, 180, 270].includes(edit.rotation)) throw new Error('Rotation must be 0, 90, 180, or 270 degrees.')
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16_000_000) throw new Error('Output must be at most 8192 pixels per side and 16 megapixels.')
  return { width, height, cropWidth, cropHeight, outputWidth: edit.rotation % 180 ? height : width, outputHeight: edit.rotation % 180 ? width : height }
}
export function paletteFromPixels(data: Uint8ClampedArray, count = 8) {
  const bins = new Map<string, number>()
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 128) continue
    const key = [data[offset], data[offset + 1], data[offset + 2]].map(channel => Math.min(255, Math.round(channel / 32) * 32).toString(16).padStart(2, '0')).join('')
    bins.set(key, (bins.get(key) ?? 0) + 1)
  }
  return [...bins.entries()].sort((first, second) => second[1] - first[1]).slice(0, count).map(([color]) => '#' + color)
}
export async function decode(file: File) {
  if (file.size > 30_000_000) throw new Error('Each image must be under 30 MB.')
  if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type)) throw new Error('Supported input: PNG, JPEG, WebP, GIF (first frame), BMP, and browser-supported AVIF. SVG is not accepted.')
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error(`Cannot decode ${file.name}. The file may be corrupt or unsupported by this browser.`) }
  try { dimensions(bitmap.width, bitmap.height, defaults) } catch (error) { bitmap.close(); throw error }
  return bitmap
}
export function render(source: ImageBitmap, edit: Edit, target = document.createElement('canvas')) {
  const geometry = dimensions(source.width, source.height, edit)
  for (const [value, min, max] of [[edit.brightness, 0, 200], [edit.contrast, 0, 200], [edit.saturation, 0, 200], [edit.grayscale, 0, 100], [edit.sepia, 0, 100], [edit.invert, 0, 100], [edit.blur, 0, 30], [edit.pixelate, 1, 64], [edit.quality, 1, 100], [edit.watermarkOpacity, 0, 100], [edit.watermarkSize, 8, 200]]) if (!Number.isFinite(value) || value < min || value > max) throw new Error('An adjustment is outside its supported range.')
  target.width = geometry.outputWidth; target.height = geometry.outputHeight
  const context = target.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable.')
  if (!edit.transparent || edit.format === 'image/jpeg') { context.fillStyle = edit.background; context.fillRect(0, 0, target.width, target.height) }
  context.save()
  context.translate(target.width / 2, target.height / 2)
  context.rotate(edit.rotation * Math.PI / 180)
  context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1)
  context.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%) grayscale(${edit.grayscale}%) sepia(${edit.sepia}%) invert(${edit.invert}%) blur(${edit.blur}px)`
  if (edit.pixelate > 1) {
    const small = document.createElement('canvas'); small.width = Math.max(1, Math.round(geometry.width / edit.pixelate)); small.height = Math.max(1, Math.round(geometry.height / edit.pixelate))
    small.getContext('2d')!.drawImage(source, edit.cropX, edit.cropY, geometry.cropWidth, geometry.cropHeight, 0, 0, small.width, small.height)
    context.imageSmoothingEnabled = false
    context.drawImage(small, -geometry.width / 2, -geometry.height / 2, geometry.width, geometry.height)
  } else context.drawImage(source, edit.cropX, edit.cropY, geometry.cropWidth, geometry.cropHeight, -geometry.width / 2, -geometry.height / 2, geometry.width, geometry.height)
  context.restore()
  if (edit.watermark) {
    context.globalAlpha = edit.watermarkOpacity / 100; context.fillStyle = edit.watermarkColor; context.font = `${edit.watermarkSize}px sans-serif`; context.textBaseline = 'middle'
    const right = edit.position.includes('right'); const center = edit.position === 'center'
    context.textAlign = center ? 'center' : right ? 'right' : 'left'
    const padding = Math.min(24, target.width / 10, target.height / 10)
    context.fillText(edit.watermark, center ? target.width / 2 : right ? target.width - padding : padding, center ? target.height / 2 : edit.position.includes('top') ? padding + edit.watermarkSize / 2 : target.height - padding - edit.watermarkSize / 2, Math.max(1, target.width - padding * 2))
    context.globalAlpha = 1
  }
  return target
}
export function encode(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => { if (!blob) reject(new Error('Image encoding failed.')); else if (blob.type !== format) reject(new Error('This browser cannot export the selected format.')); else resolve(blob) }, format, quality / 100))
}
export function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export async function contactSheet(sources: ImageBitmap[], columns: number, tileSize: number, background: string) {
  if (!sources.length || !Number.isInteger(columns) || columns < 1 || columns > 8 || !Number.isInteger(tileSize) || tileSize < 64 || tileSize > 1024) throw new Error('Contact sheet requires 1-8 columns and tile size 64-1024 pixels.')
  const canvas = document.createElement('canvas'); canvas.width = columns * tileSize; canvas.height = Math.ceil(sources.length / columns) * tileSize
  if (canvas.width * canvas.height > 16_000_000) throw new Error('Contact sheet exceeds 16 megapixels.')
  const context = canvas.getContext('2d')!; context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height)
  sources.forEach((source, index) => { const scale = Math.min((tileSize - 16) / source.width, (tileSize - 16) / source.height); const width = source.width * scale; const height = source.height * scale; context.drawImage(source, index % columns * tileSize + (tileSize - width) / 2, Math.floor(index / columns) * tileSize + (tileSize - height) / 2, width, height) })
  return encode(canvas, 'image/png', 100)
}