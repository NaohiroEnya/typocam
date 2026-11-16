// A "recipe" is the shareable part of a text's settings: what it says and how it looks, but not
// where it was placed -- whoever opens a shared recipe places the same text in their own space.
// It travels as plain URL query parameters so a shared link is readable and needs no backend.
import {FONTS, DEFAULT_FONT_ID} from './fonts'
import {COLORS, DEFAULT_COLOR_ID} from './colors'
import {STYLES, DEFAULT_STYLE_ID} from './styles'

export const MAX_TEXT_LENGTH = 20
export const MIN_SIZE = 0.2
export const MAX_SIZE = 6

const clampSize = (size) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
const validId = (list, id, fallback) => (list.some((item) => item.id === id) ? id : fallback)

export const recipeToUrl = ({text, fontId, colorId, styleId, size}, baseUrl = window.location.href) => {
  const url = new URL(baseUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set('text', text)
  url.searchParams.set('font', fontId)
  url.searchParams.set('color', colorId)
  url.searchParams.set('style', styleId)
  url.searchParams.set('size', String(Math.round(size * 100) / 100))
  return url.toString()
}

// Returns a full recipe if the URL carries one (identified by its `text` param), else null.
// Unknown ids and out-of-range sizes fall back to defaults rather than failing.
export const recipeFromUrl = (href = window.location.href) => {
  const params = new URL(href).searchParams
  const text = (params.get('text') || '').trim().slice(0, MAX_TEXT_LENGTH)
  if (!text) {
    return null
  }
  const size = Number(params.get('size'))
  return {
    text,
    fontId: validId(FONTS, params.get('font'), DEFAULT_FONT_ID),
    colorId: validId(COLORS, params.get('color'), DEFAULT_COLOR_ID),
    styleId: validId(STYLES, params.get('style'), DEFAULT_STYLE_ID),
    size: Number.isFinite(size) && size > 0 ? clampSize(size) : 1,
  }
}

export {clampSize}
