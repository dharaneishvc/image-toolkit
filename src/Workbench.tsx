import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, FileImage, FlaskConical, FlipHorizontal2, FlipVertical2, ImagePlus, Redo2, RotateCcw, RotateCw, Trash2, Undo2, Eye, EyeOff, Archive, Grid2X2 } from 'lucide-react'
import JSZip from 'jszip'
import { parse as readExif } from 'exifr'
import { Shell, IconButton } from './Shell'
import { defaults, dimensions, decode, render, encode, download, contactSheet, imageTools, paletteFromPixels } from './engine'
import type { Edit } from './engine'
import { recordHistory } from './storage'
import './ui.css'
import './theme.css'

type Asset = { id: string; file: File; bitmap: ImageBitmap; url: string }
function initialTool() { return imageTools.find(tool => tool.id === location.hash.slice(1))?.id ?? 'resize' }
export default function App() {
  const [active, setActive] = useState(initialTool)
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [timeline, setTimeline] = useState<{ past: Edit[]; present: Edit; future: Edit[] }>({ past: [], present: { ...defaults }, future: [] })
  const edit = timeline.present
  const [original, setOriginal] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState('')
  const [metadata, setMetadata] = useState('')
  const [palette, setPalette] = useState<string[]>([])
  const [columns, setColumns] = useState(3)
  const [tileSize, setTileSize] = useState(256)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const owned = useRef<Asset[]>([])
  const alive = useRef(true)
  const selected = assets.find(asset => asset.id === selectedId) ?? assets[0]
  useEffect(() => {
    alive.current = true
    const hash = () => setActive(initialTool()); window.addEventListener('hashchange', hash)
    return () => { alive.current = false; window.removeEventListener('hashchange', hash); for (const asset of owned.current) { asset.bitmap.close(); URL.revokeObjectURL(asset.url) } }
  }, [])
  useEffect(() => {
    if (!selected || !canvas.current) return
    const timer = setTimeout(() => { try { render(selected.bitmap, original ? defaults : edit, canvas.current!); setError(''); if (active === 'palette') { const small = document.createElement('canvas'); small.width = 64; small.height = 64; const context = small.getContext('2d')!; context.drawImage(canvas.current!, 0, 0, 64, 64); setPalette(paletteFromPixels(context.getImageData(0, 0, 64, 64).data)) } } catch (caught) { setError(caught instanceof Error ? caught.message : 'Preview failed.') } }, 100)
    return () => clearTimeout(timer)
  }, [selected, edit, original, active])
  useEffect(() => {
    if (!selected || active !== 'metadata') return
    let cancelled = false
    setMetadata('Reading...')
    readExif(selected.file).then(exif => { if (!cancelled) setMetadata(JSON.stringify({ name: selected.file.name, type: selected.file.type, bytes: selected.file.size, width: selected.bitmap.width, height: selected.bitmap.height, exif: exif ?? null }, null, 2)) }).catch(() => { if (!cancelled) setMetadata(JSON.stringify({ name: selected.file.name, type: selected.file.type, bytes: selected.file.size, width: selected.bitmap.width, height: selected.bitmap.height, exif: null }, null, 2)) })
    return () => { cancelled = true }
  }, [selected, active])
  function update(patch: Partial<Edit>) { setTimeline(state => ({ past: [...state.past.slice(-49), state.present], present: { ...state.present, ...patch }, future: [] })); setResult('') }
  function undo() { setTimeline(state => state.past.length ? { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] } : state) }
  function redo() { setTimeline(state => state.future.length ? { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) } : state) }
  async function add(files: File[]) {
    if (!files.length || busy) return
    setBusy(true); setError(''); const additions: Asset[] = []
    try {
      if (assets.length + files.length > 24 || [...assets.map(asset => asset.file), ...files].reduce((sum, file) => sum + file.size, 0) > 150_000_000) throw new Error('A session is limited to 24 images and 150 MB of files.')
      for (const file of files) additions.push({ id: crypto.randomUUID(), file, bitmap: await decode(file), url: URL.createObjectURL(file) })
      if (!alive.current) { for (const asset of additions) { asset.bitmap.close(); URL.revokeObjectURL(asset.url) }; return }
      owned.current = [...owned.current, ...additions]; setAssets(previous => [...previous, ...additions]); setSelectedId(additions[0].id); setResult('')
    } catch (caught) { for (const asset of additions) { asset.bitmap.close(); URL.revokeObjectURL(asset.url) }; setError(caught instanceof Error ? caught.message : 'Could not import images.') }
    finally { if (alive.current) setBusy(false) }
  }
  async function sample() { try { const response = await fetch(`${import.meta.env.BASE_URL}sample.jpg`); if (!response.ok) throw new Error('Sample unavailable.'); await add([new File([await response.blob()], 'botanical-sample.jpg', { type: 'image/jpeg' })]) } catch { setError('Could not load the bundled sample.') } }
  function remove(asset: Asset) { asset.bitmap.close(); URL.revokeObjectURL(asset.url); owned.current = owned.current.filter(item => item.id !== asset.id); setAssets(previous => previous.filter(item => item.id !== asset.id)); setResult('') }
  async function exportImages(batch = false) {
    if (!selected || busy) return
    setBusy(true); setError(''); setResult('')
    try {
      const extension = edit.format.split('/')[1].replace('jpeg', 'jpg')
      let blob: Blob; let name: string
      if (active === 'contact-sheet') { blob = await contactSheet(assets.map(asset => asset.bitmap), columns, tileSize, edit.background); name = 'contact-sheet.png' }
      else if (batch) {
        const zip = new JSZip()
        for (const [index, asset] of assets.entries()) { const output = await encode(render(asset.bitmap, edit), edit.format, edit.quality); zip.file(`${String(index + 1).padStart(2, '0')}-${asset.file.name.replace(/\.[^.]+$/, '')}.${extension}`, output) }
        blob = await zip.generateAsync({ type: 'blob' }); name = 'edited-images.zip'
      } else { blob = await encode(render(selected.bitmap, edit), edit.format, edit.quality); name = `${selected.file.name.replace(/\.[^.]+$/, '')}-edited.${extension}` }
      download(blob, name); setResult(`${name} / ${(blob.size / 1024).toFixed(1)} KB`)
      await recordHistory(active, imageTools.find(tool => tool.id === active)!.name)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Export failed.') }
    finally { setBusy(false) }
  }
  function numeric(key: keyof Edit, label: string, max = 8192) { return <label>{label}<input type="number" min="0" max={max} step="1" value={Number(edit[key])} onChange={event => { const value = Number(event.target.value); update(key === 'height' && edit.aspect ? { height: value, width: 0 } : { [key]: value }) }} /></label> }
  function slider(key: keyof Edit, label: string, min: number, max: number, unit = '%') { return <label>{label} <span className="value-label">{String(edit[key])}{unit}</span><input type="range" min={min} max={max} value={Number(edit[key])} onChange={event => update({ [key]: Number(event.target.value) })} /></label> }
  const adjustments: Record<string, [keyof Edit, string, number, number, string?]> = { brightness: ['brightness', 'Brightness', 0, 200], contrast: ['contrast', 'Contrast', 0, 200], saturation: ['saturation', 'Saturation', 0, 200], grayscale: ['grayscale', 'Grayscale', 0, 100], sepia: ['sepia', 'Sepia', 0, 100], invert: ['invert', 'Invert', 0, 100], blur: ['blur', 'Blur radius', 0, 30, 'px'], pixelate: ['pixelate', 'Block size', 1, 64, 'px'] }
  let size = ''
  if (selected) { try { const value = dimensions(selected.bitmap.width, selected.bitmap.height, edit); size = `${value.outputWidth} x ${value.outputHeight} px` } catch { size = 'Invalid dimensions' } }
  return <Shell title="Image Toolkit" tools={imageTools} active={active} onSelect={setActive}><div className="workbench">
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif" multiple hidden onChange={event => { void add(Array.from(event.target.files ?? [])); event.target.value = '' }} />
    <div className="section-toolbar image-toolbar"><div className="actions"><button className="secondary-button" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={16} />Add images</button><IconButton label="Load sample image" disabled={busy} onClick={() => { void sample() }}><FlaskConical size={18} /></IconButton></div><div className="actions"><IconButton label="Undo edit" disabled={!timeline.past.length} onClick={undo}><Undo2 size={18} /></IconButton><IconButton label="Redo edit" disabled={!timeline.future.length} onClick={redo}><Redo2 size={18} /></IconButton><IconButton label="Reset edits" onClick={() => update(defaults)}><RotateCcw size={18} /></IconButton><IconButton label={original ? 'Show edited image' : 'Show original image'} onClick={() => setOriginal(!original)}>{original ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></div></div>
    <div className="workspace-grid"><section>
      {selected ? <><div className="section-toolbar"><h3>{original ? 'Original' : 'Edited'}</h3><span className="dimension-label">{original ? `${selected.bitmap.width} x ${selected.bitmap.height} px` : size}</span></div><div className="preview-stage"><canvas ref={canvas} aria-label="Image preview" /></div></> : <div className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void add(Array.from(event.dataTransfer.files)) }}><FileImage size={42} /><button className="primary-button" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={16} />Open images</button><button className="secondary-button" disabled={busy} onClick={() => { void sample() }}><FlaskConical size={16} />Load sample</button></div>}
      <div className="asset-list">{assets.map(asset => <div key={asset.id} className={`asset-row ${selected?.id === asset.id ? 'selected' : ''}`}><img src={asset.url} alt="" /><button className="asset-name" onClick={() => setSelectedId(asset.id)}><strong>{asset.file.name}</strong><small>{asset.bitmap.width} x {asset.bitmap.height} / {(asset.file.size / 1024).toFixed(1)} KB</small></button><IconButton label={`Remove ${asset.file.name}`} disabled={busy} onClick={() => remove(asset)}><Trash2 size={15} /></IconButton></div>)}</div>
      {active === 'metadata' && selected && <pre className="metadata" aria-label="Image metadata">{metadata}</pre>}
      {active === 'palette' && selected && <div className="palette">{palette.map(color => <button className="swatch" style={{ background: color }} title={`Copy ${color}`} aria-label={`Copy ${color}`} key={color} onClick={() => { navigator.clipboard.writeText(color).then(() => setResult(`${color} copied`)).catch(() => setError('Clipboard unavailable.')) }} />)}</div>}
    </section><aside className="control-panel" aria-label="Image adjustments">
      {active === 'resize' && <><div className="control-row">{numeric('width', 'Width (0 = source)')}{numeric('height', 'Height (0 = source)')}</div><label className="checkbox-label"><input type="checkbox" checked={edit.aspect} onChange={event => update({ aspect: event.target.checked })} />Lock aspect ratio</label></>}
      {active === 'crop' && <><div className="control-row">{numeric('cropX', 'Crop X')}{numeric('cropY', 'Crop Y')}</div><div className="control-row">{numeric('cropWidth', 'Crop width (0 = remaining)')}{numeric('cropHeight', 'Crop height (0 = remaining)')}</div></>}
      {active === 'rotate' && <div className="segmented"><button title="Rotate left" aria-label="Rotate left" onClick={() => update({ rotation: (edit.rotation + 270) % 360 })}><RotateCcw size={18} /></button><button title="Rotate right" aria-label="Rotate right" onClick={() => update({ rotation: (edit.rotation + 90) % 360 })}><RotateCw size={18} /></button></div>}
      {active === 'flip' && <div className="segmented"><button aria-label="Flip horizontally" title="Flip horizontally" aria-pressed={edit.flipX} onClick={() => update({ flipX: !edit.flipX })}><FlipHorizontal2 size={18} /></button><button aria-label="Flip vertically" title="Flip vertically" aria-pressed={edit.flipY} onClick={() => update({ flipY: !edit.flipY })}><FlipVertical2 size={18} /></button></div>}
      {adjustments[active] && slider(...adjustments[active])}
      {active === 'watermark' && <><label>Watermark text<input value={edit.watermark} maxLength={200} onChange={event => update({ watermark: event.target.value })} /></label>{slider('watermarkSize', 'Font size', 8, 200, 'px')}{slider('watermarkOpacity', 'Opacity', 0, 100)}<label>Text color<input type="color" value={edit.watermarkColor} onChange={event => update({ watermarkColor: event.target.value })} /></label><label>Position<select value={edit.position} onChange={event => update({ position: event.target.value })}>{['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'].map(position => <option key={position}>{position}</option>)}</select></label></>}
      {active === 'contact-sheet' && <><label>Columns<input type="number" min="1" max="8" value={columns} onChange={event => setColumns(Number(event.target.value))} /></label><label>Tile size<input type="number" min="64" max="1024" value={tileSize} onChange={event => setTileSize(Number(event.target.value))} /></label></>}
      <h3>Export</h3><label>Format<select aria-label="Format" value={edit.format} onChange={event => update({ format: event.target.value })}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>{edit.format !== 'image/png' && slider('quality', 'Quality', 1, 100)}<label>Background color<input type="color" value={edit.background} onChange={event => update({ background: event.target.value })} /></label><label className="checkbox-label"><input type="checkbox" checked={edit.transparent} disabled={edit.format === 'image/jpeg'} onChange={event => update({ transparent: event.target.checked })} />Transparent background</label>
      <button className="primary-button" disabled={!selected || busy} onClick={() => { void exportImages(active === 'batch') }}>{active === 'contact-sheet' ? <Grid2X2 size={16} /> : <ArrowDownToLine size={16} />}{active === 'contact-sheet' ? 'Export sheet' : active === 'batch' ? 'Export ZIP' : 'Export image'}</button>{active !== 'contact-sheet' && active !== 'batch' && <button className="secondary-button" disabled={!selected || busy} onClick={() => { void exportImages(true) }}><Archive size={16} />Export all as ZIP</button>}
    </aside></div>
    <div className="result-bar"><span role="status">{busy ? 'Processing...' : result || (assets.length ? `${assets.length} images / ${size}` : 'Ready')}</span>{error && <p role="alert" className="error">{error}</p>}</div>
  </div></Shell>
}