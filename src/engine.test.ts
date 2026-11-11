import { describe, expect, it } from 'vitest'
import { defaults, dimensions, imageTools, paletteFromPixels } from './engine'
describe('image geometry', () => {
  it('has unique tool IDs', () => expect(new Set(imageTools.map(tool => tool.id)).size).toBe(imageTools.length))
  it('keeps source dimensions by default', () => expect(dimensions(800, 600, defaults)).toMatchObject({ outputWidth: 800, outputHeight: 600 }))
  it('preserves aspect ratio from width', () => expect(dimensions(800, 600, { ...defaults, width: 400 })).toMatchObject({ width: 400, height: 300 }))
  it('preserves aspect ratio from height', () => expect(dimensions(800, 600, { ...defaults, height: 300 })).toMatchObject({ width: 400, height: 300 }))
  it('supports exact dimensions', () => expect(dimensions(800, 600, { ...defaults, width: 500, height: 500, aspect: false })).toMatchObject({ width: 500, height: 500 }))
  it('swaps dimensions for quarter turns', () => expect(dimensions(800, 600, { ...defaults, rotation: 90 })).toMatchObject({ outputWidth: 600, outputHeight: 800 }))
  it('uses cropped ratio for resizing', () => expect(dimensions(800, 600, { ...defaults, cropWidth: 400, cropHeight: 400, width: 100 })).toMatchObject({ width: 100, height: 100 }))
  it('uses remaining dimensions for zero crop size', () => expect(dimensions(800, 600, { ...defaults, cropX: 100, cropY: 100 })).toMatchObject({ cropWidth: 700, cropHeight: 500 }))
  it.each([{ cropX: 900 }, { cropWidth: 900 }, { cropY: -1 }, { width: 0.5 }, { width: 10000 }, { rotation: 45 }, { width: NaN }])('rejects invalid geometry %j', edit => expect(() => dimensions(800, 600, { ...defaults, ...edit })).toThrow())
  it('rejects excessive decoded pixels', () => expect(() => dimensions(10000, 10000, defaults)).toThrow('megapixels'))
})
describe('palette quantization', () => {
  it('ranks colors by frequency', () => expect(paletteFromPixels(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255]))).toEqual(['#ff0000', '#0000ff']))
  it('ignores transparent pixels', () => expect(paletteFromPixels(new Uint8ClampedArray([255, 0, 0, 0]))).toEqual([]))
  it('limits the number of returned swatches', () => expect(paletteFromPixels(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]), 1)).toHaveLength(1))
})