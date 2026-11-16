// Central registry of selectable fonts. Each entry pairs the raw font file (loaded by
// text-plane.js via opentype.js to build 3D glyph geometry) with a CSS @font-face name
// (declared in index.css) so the chip buttons in the UI can preview each font live.
import gothicUrl from './assets/fonts/NotoSansJP-subset.otf?url'
import minchoUrl from './assets/fonts/NotoSerifJP-subset.ttf?url'
import markerUrl from './assets/fonts/YuseiMagic-subset.ttf?url'
import popUrl from './assets/fonts/HachiMaruPop-subset.ttf?url'

export const FONTS = [
  {id: 'gothic', label: 'ゴシック', url: gothicUrl, cssFamily: 'FPAR-Gothic'},
  {id: 'mincho', label: '明朝', url: minchoUrl, cssFamily: 'FPAR-Mincho'},
  {id: 'marker', label: '手書き風', url: markerUrl, cssFamily: 'FPAR-Marker'},
  {id: 'pop', label: 'ポップ', url: popUrl, cssFamily: 'FPAR-Pop'},
]

export const DEFAULT_FONT_ID = FONTS[0].id
