// A "recipe" is the shareable part of a text's settings: what it says and how it looks and moves,
// but not where it was placed -- whoever opens a shared recipe places the same text in their own
// space. It travels as plain URL query parameters so a shared link is readable and needs no
// backend.
import {FONTS} from './fonts'
import {COLORS} from './colors'
import {PRESETS, PLACES, MOTIONS, DEFAULT_PRESET_ID, findPreset} from './presets'

export const MAX_TEXT_LENGTH = 20
export const MIN_SIZE = 0.2
export const MAX_SIZE = 6

const clampSize = (size) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
const validId = (list, id, fallback) => (list.some((item) => item.id === id) ? id : fallback)

export const recipeToUrl = ({text, fontId, colorId, presetId, place, motion, size}, baseUrl = window.location.href) => {
  const url = new URL(baseUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set('text', text)
  url.searchParams.set('preset', presetId)
  url.searchParams.set('font', fontId)
  url.searchParams.set('color', colorId)
  url.searchParams.set('place', place)
  url.searchParams.set('motion', motion)
  url.searchParams.set('size', String(Math.round(size * 100) / 100))
  return url.toString()
}

// Returns a full recipe if the URL carries one (identified by its `text` param), else null.
// Unknown ids and out-of-range sizes fall back to the preset's (or the defaults') values rather
// than failing.
export const recipeFromUrl = (href = window.location.href) => {
  const params = new URL(href).searchParams
  const text = (params.get('text') || '').trim().slice(0, MAX_TEXT_LENGTH)
  if (!text) {
    return null
  }
  const preset = findPreset(validId(PRESETS, params.get('preset'), DEFAULT_PRESET_ID))
  const size = Number(params.get('size'))
  return {
    text,
    presetId: preset.id,
    fontId: validId(FONTS, params.get('font'), preset.fontId),
    colorId: validId(COLORS, params.get('color'), preset.colorId),
    place: validId(PLACES, params.get('place'), preset.place),
    motion: validId(MOTIONS, params.get('motion'), preset.motion),
    size: Number.isFinite(size) && size > 0 ? clampSize(size) : 1,
  }
}

export {clampSize}
