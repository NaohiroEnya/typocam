// Style presets: picking one switches the font, the color, and the 3D text's look (extrusion
// depth and material) together. The font and color can still be changed individually afterwards;
// the look stays with the style. A little `emissive` keeps light colors from reading as grey
// under the scene's lighting.
export const STYLES = [
  {
    id: 'travel',
    label: '旅ログ',
    fontId: 'hand',
    colorId: 'white',
    look: {depthRatio: 0.14, roughness: 0.85, metalness: 0, emissive: 0.3},
  },
  {
    id: 'holiday',
    label: '休日',
    fontId: 'maru',
    colorId: 'yellow',
    look: {depthRatio: 0.3, roughness: 0.45, metalness: 0, emissive: 0.35},
  },
  {
    id: 'emo',
    label: 'エモい',
    fontId: 'mincho',
    colorId: 'pink',
    // Thin and softly self-lit so it reads like a glowing sign even in shade.
    look: {depthRatio: 0.05, roughness: 0.3, metalness: 0, emissive: 0.55},
  },
  {
    id: 'cool',
    label: 'クール',
    fontId: 'condensed',
    colorId: 'black',
    look: {depthRatio: 0.12, roughness: 0.25, metalness: 0.6, emissive: 0},
  },
]

export const DEFAULT_STYLE_ID = 'travel'

export const findStyle = (styleId) => STYLES.find((s) => s.id === styleId) || STYLES.find((s) => s.id === DEFAULT_STYLE_ID)
