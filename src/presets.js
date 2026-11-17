// Presets set the font, color, PLACE, and MOTION together, plus the 3D text's look (extrusion
// depth and material). Each of font/color/place/motion can still be changed individually
// afterwards; the look stays with the preset. `emissive` only lights the front face (the sides
// stay shaded so the depth reads), and metalness stays modest because the scene's environment
// map is a generic room, not the real surroundings, so strong reflections would look pasted on.
export const PLACES = [
  {id: 'ground', label: 'GROUND', caption: '地面に置く'},
  {id: 'air', label: 'AIR', caption: '空中に浮かべる'},
]

export const MOTIONS = [
  {id: 'static', label: 'STATIC', caption: '止まる'},
  {id: 'float', label: 'FLOAT', caption: 'ふわふわ'},
  {id: 'pop', label: 'POP', caption: '弾む'},
  {id: 'draw', label: 'DRAW', caption: '書き出す'},
]

export const PRESETS = [
  {
    id: 'pop',
    label: 'Pop',
    fontId: 'bold',
    colorId: 'orange',
    place: 'air',
    motion: 'pop',
    look: {depthRatio: 0.25, roughness: 0.4, metalness: 0, emissive: 0.35},
  },
  {
    id: 'cute',
    label: 'Cute',
    fontId: 'maru',
    colorId: 'pink',
    place: 'air',
    motion: 'float',
    look: {depthRatio: 0.3, roughness: 0.5, metalness: 0, emissive: 0.35},
  },
  {
    id: 'cool',
    label: 'Cool',
    fontId: 'condensed',
    colorId: 'white',
    place: 'ground',
    motion: 'static',
    look: {depthRatio: 0.1, roughness: 0.3, metalness: 0.25, emissive: 0.25},
  },
  {
    id: 'elegant',
    label: 'Elegant',
    fontId: 'mincho',
    colorId: 'gold',
    place: 'air',
    motion: 'float',
    look: {depthRatio: 0.06, roughness: 0.3, metalness: 0.35, emissive: 0.35},
  },
  {
    id: 'emotional',
    label: 'Emotional',
    fontId: 'mincho',
    colorId: 'orange',
    place: 'air',
    motion: 'draw',
    // Thin and softly self-lit so it reads like a glowing sign even in shade.
    look: {depthRatio: 0.05, roughness: 0.3, metalness: 0, emissive: 0.55},
  },
  {
    id: 'natural',
    label: 'Natural',
    fontId: 'maru',
    colorId: 'green',
    place: 'ground',
    motion: 'float',
    look: {depthRatio: 0.18, roughness: 0.85, metalness: 0, emissive: 0.25},
  },
  {
    id: 'bold',
    label: 'Bold',
    fontId: 'bold',
    colorId: 'red',
    place: 'ground',
    motion: 'pop',
    look: {depthRatio: 0.4, roughness: 0.45, metalness: 0, emissive: 0.15},
  },
  {
    id: 'retro',
    label: 'Retro',
    fontId: 'retro',
    colorId: 'cream',
    place: 'ground',
    motion: 'draw',
    look: {depthRatio: 0.14, roughness: 0.8, metalness: 0, emissive: 0.3},
  },
]

export const DEFAULT_PRESET_ID = 'pop'

export const findPreset = (presetId) => PRESETS.find((p) => p.id === presetId) || PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)
