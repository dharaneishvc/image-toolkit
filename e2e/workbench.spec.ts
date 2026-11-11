import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { imageTools } from '../src/engine'

test('sample preview, resizing, undo, redo, and real PNG export', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load sample', exact: true }).click()
  await expect(page.locator('.asset-row')).toHaveCount(1)
  await page.getByLabel('Width (0 = source)', { exact: true }).fill('320')
  await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(320)
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click(); await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).not.toBe(320)
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click(); await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(320)
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export image', exact: true }).click(); const file = await downloaded; expect(file.suggestedFilename()).toMatch(/\.png$/)
  const bytes = await readFile((await file.path())!); expect(bytes.readUInt32BE(16)).toBe(320)
  expect(await page.locator('canvas').evaluate(canvas => { const context = (canvas as HTMLCanvasElement).getContext('2d')!; return context.getImageData(0, 0, 100, 100).data.some((value, index) => index % 4 !== 3 && value > 0) })).toBe(true)
})
test('each image tool presents a usable workspace', async ({ page }, testInfo) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(1)
  for (const tool of imageTools) {
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await page.getByRole('button', { name: tool.name, exact: true }).click(); await expect(page.getByRole('heading', { name: tool.name, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
})
test('known pixels: flip, rotation, crop, grayscale, and JPEG export', async ({ page }) => {
  await page.goto('/#flip')
  const encoded = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 50; const context = canvas.getContext('2d')!; context.fillStyle = '#ff0000'; context.fillRect(0, 0, 50, 50); context.fillStyle = '#0000ff'; context.fillRect(50, 0, 50, 50); return canvas.toDataURL().split(',')[1] })
  await page.locator('input[type=file]').setInputFiles({ name: 'pixels.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') })
  await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(100)
  await page.getByRole('button', { name: 'Flip horizontally', exact: true }).click()
  await expect.poll(() => page.locator('canvas').evaluate(canvas => [...(canvas as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data])).toEqual([0, 0, 255, 255])
  await page.evaluate(() => { location.hash = 'rotate' }); await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
  await expect.poll(() => page.locator('canvas').evaluate(canvas => [(canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height])).toEqual([50, 100])
  await page.getByRole('button', { name: 'Reset edits', exact: true }).click(); await page.evaluate(() => { location.hash = 'crop' })
  await page.getByLabel('Crop width (0 = remaining)', { exact: true }).fill('50'); await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(50)
  await page.evaluate(() => { location.hash = 'grayscale' }); await page.getByRole('slider', { name: 'Grayscale', exact: false }).fill('100')
  await expect.poll(() => page.locator('canvas').evaluate(canvas => { const data = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data; return data[0] === data[1] && data[1] === data[2] })).toBe(true)
  await page.getByLabel('Format', { exact: true }).selectOption('image/jpeg'); const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export image', exact: true }).click(); const bytes = await readFile((await (await downloaded).path())!); expect([...bytes.subarray(0, 2)]).toEqual([255, 216])
})
test('batch ZIP and contact sheet contain real files', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(1); await page.getByRole('button', { name: 'Load sample image', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(2)
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export all as ZIP', exact: true }).click(); const zip = await JSZip.loadAsync(await readFile((await (await downloaded).path())!)); expect(Object.keys(zip.files)).toHaveLength(2)
  await page.evaluate(() => { location.hash = 'contact-sheet' }); const sheet = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export sheet', exact: true }).click(); const bytes = await readFile((await (await sheet).path())!); expect(bytes.readUInt32BE(16)).toBe(768)
})
test('rejects SVG and invalid crops, and passes accessibility checks', async ({ page }) => {
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }); await expect(page.getByRole('alert')).toContainText('SVG')
  await page.getByRole('button', { name: 'Load sample', exact: true }).click(); await expect(page.locator('.asset-row')).toHaveCount(1); await page.evaluate(() => { location.hash = 'crop' }); await page.getByLabel('Crop X', { exact: true }).fill('9000'); await expect(page.getByRole('alert')).toContainText('Crop')
  await page.getByRole('button', { name: 'Reset edits', exact: true }).click(); await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/image-${await page.evaluate(() => window.innerWidth)}.png`, fullPage: true })
})