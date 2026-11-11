# Image Toolkit

A free, local-first image studio with non-destructive edits, real previews, and batch export. Images are never uploaded, and source files are never overwritten.

## Supported catalog: 20 tools

| Category | Implemented tools |
| --- | --- |
| Geometry | Aspect-locked/exact resize, numeric pixel crop, 90-degree rotation, horizontal/vertical mirror |
| Export | PNG/JPEG/WebP conversion, lossy quality control, solid-background/transparency handling, batch ZIP |
| Adjustments | Grayscale, sepia, brightness, contrast, saturation, blur, inversion, pixelation |
| Composition | Text watermark with size/color/opacity/placement, grid contact sheets |
| Analysis | Source metadata/EXIF inspection, quantized dominant palette with copyable swatches |

Multi-file import, drag/drop, bundled sample photograph, source selection/removal, original/edited preview, 50-step undo/redo, reset, favorites, search, hash links, and metadata-only history are included. Edits compose across tools. Batch settings use the same source-pixel coordinates for every image; incompatible crops fail explicitly. Contact sheets fit original sources, not edited previews.

## Run and test

Requires Node.js 24, npm, and a current browser. Chromium is the tested baseline.

```sh
npm ci
npm run dev -- --port 5174
npm run check
npx playwright install chromium
npm run test:e2e
```

The build is static `dist/`. Unit tests cover geometry/limits/palettes. Browser tests inspect actual red/blue fixture pixels, mirror/grayscale effects, rotation/crop/resize dimensions, PNG/JPEG bytes, undo/redo, ZIP members, contact-sheet dimensions, all tool navigation, axe accessibility, and mobile overflow.

## Verification

The recorded verification run passed 27 unit tests and 10 desktop/mobile browser cases for this repository. Builds and dependency audits passed. See [Verification](VERIFICATION.md) for coverage, advisory warnings, reproduction commands, and external deployment requirements. All documentation, dependencies, and CI configuration live in this repository; no parent workspace files are required.

## Formats and limitations

Input: PNG, JPEG, WebP, BMP, GIF (first frame only), browser-supported AVIF. SVG/HEIC/RAW are unsupported. Output: PNG, JPEG, WebP where supported. Encoder MIME is checked; unsupported formats fail rather than return mislabeled files. PNG is lossless with no lossy quality slider; file-size reduction is not guaranteed. JPEG has no alpha and uses the chosen background.

Limits: 30 MB per file, 24 files/150 MB per session, 16 megapixels per decoded/output image, 8192 pixels per output side. Contact sheets use 1-8 columns and 64-1024 pixel tiles. Canvas exports strip source EXIF, but are not a forensic sanitizer. Browser color handling is not a CMYK/ICC print workflow. Cropping is numeric, not a drag-resizable crop box. Blur/pixelation are not secure redaction. Animated editing, layers, vector editing, AI background removal, OCR, RAW development, and unlimited format parity are not implemented.

The local botanical sample came from `images.unsplash.com/photo-1497250681960-ef046c08a56e`; see the [Unsplash license](https://unsplash.com/license). No runtime third-party sample or font request is needed. Upstream library/font licenses remain applicable.

See [Architecture](docs/ARCHITECTURE.md), [Operations](docs/OPERATIONS.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md). This folder is independently deployable to Pages; GitHub publication and Jenkins execution require external account/runner setup.