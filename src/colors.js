export const COLORS = [
  {id: 'white', label: '白', hex: '#ffffff'},
  {id: 'black', label: '黒', hex: '#1c1c1e'},
  {id: 'red', label: '赤', hex: '#ff3b30'},
  {id: 'orange', label: 'オレンジ', hex: '#ff9500'},
  {id: 'yellow', label: '黄', hex: '#ffd60a'},
  {id: 'green', label: '緑', hex: '#34c759'},
  {id: 'blue', label: '青', hex: '#0a84ff'},
  {id: 'pink', label: 'ピンク', hex: '#ff6fae'},
]

export const DEFAULT_COLOR_ID = 'white'

export const findColor = (colorId) => COLORS.find((c) => c.id === colorId) || COLORS.find((c) => c.id === DEFAULT_COLOR_ID)
