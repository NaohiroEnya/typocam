// Builds real 3D solid text (not a flat texture) by parsing actual glyph outlines from a
// selectable, bundled font file and extruding them with three.js. A vector outline gives crisp
// edges at any size and a single continuous volume, unlike a canvas-texture approach. Each
// bundled font is subset to the same character set as the original (ASCII, kana, and the ~3000
// Jouyou/Kyoiku-use kanji) to keep downloads small while covering ordinary Japanese input; a
// character outside that set won't render.
import * as THREE from 'three'
import opentype from 'opentype.js'

import {FONTS, DEFAULT_FONT_ID} from './fonts'

export const TEXT_WORLD_HEIGHT = 0.4 // meters
const TEXT_THICKNESS_RATIO = 0.12 // extrusion depth, as a fraction of worldHeight

const fontPromises = new Map()
export const loadFont = (fontId = DEFAULT_FONT_ID) => {
  if (!fontPromises.has(fontId)) {
    const font = FONTS.find((f) => f.id === fontId) || FONTS[0]
    const promise = fetch(font.url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => opentype.parse(buffer))
    fontPromises.set(fontId, promise)
  }
  return fontPromises.get(fontId)
}

// Splits an opentype.js path into its individual closed contours, converting each to a
// three.js Path so its point-based signed area can be measured. In these fonts' outlines, a
// negative signed area is a solid (fillable) contour and a positive one is a hole -- empirically
// verified against a character with a nested hole (回), which produced alternating signs at each
// nesting level.
const contoursOf = (otPath) => {
  const contours = []
  let current = null
  otPath.commands.forEach((cmd) => {
    if (cmd.type === 'M') {
      current = new THREE.Path()
      contours.push(current)
    }
    if (!current) {
      return
    }
    if (cmd.type === 'M') current.moveTo(cmd.x, cmd.y)
    else if (cmd.type === 'L') current.lineTo(cmd.x, cmd.y)
    else if (cmd.type === 'C') current.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)
    else if (cmd.type === 'Q') current.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y)
  })
  return contours.map((path) => {
    const points = path.getPoints()
    let area = 0
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      area += a.x * b.y - b.x * a.y
    }
    return {points, area: area / 2}
  })
}

const pointInPolygon = (point, polygon) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = a.y > point.y !== b.y > point.y
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

// Converts a run of text's glyph outlines into extrudable shapes, attaching each hole contour to
// whichever solid contour geometrically contains it (so e.g. 回's inner solid square sits inside
// its outer frame's hole as its own shape, rather than being merged into one).
const pathToShapes = (otPath) => {
  const contours = contoursOf(otPath)
  const solids = contours.filter((c) => c.area < 0).map((c) => ({shape: new THREE.Shape(c.points), points: c.points}))
  contours
    .filter((c) => c.area >= 0)
    .forEach((hole) => {
      const owner = solids.find((s) => pointInPolygon(hole.points[0], s.points))
      if (owner) {
        owner.shape.holes.push(new THREE.Path(hole.points))
      }
    })
  return solids.map((s) => s.shape)
}

// Builds a group showing `text` as a solid, shadow-casting 3D object sized so its world-space
// height is `worldHeight` meters, in the requested font and color. The group is centered on X/Z
// with its bottom at local y=0, so placing it at a ground hit point sits it directly on the
// ground.
export const createTextMesh = async (text, {fontId = DEFAULT_FONT_ID, worldHeight = TEXT_WORLD_HEIGHT, color = '#ff3b30'} = {}) => {
  const font = await loadFont(fontId)
  const otPath = font.getPath(text, 0, 0, 1) // fontSize=1 -> coordinates are fractions of an em
  const shapes = pathToShapes(otPath)

  const group = new THREE.Group()
  if (shapes.length === 0) {
    return group // e.g. blank input, or a glyph outside the bundled font's coverage
  }

  const box = otPath.getBoundingBox()
  const emHeight = box.y2 - box.y1
  const scale = worldHeight / emHeight

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: emHeight * TEXT_THICKNESS_RATIO,
    bevelEnabled: false,
  })
  // opentype.js paths are Y-down (like a canvas); flipping Y here both corrects that and applies
  // the em-units-to-meters scale in one step.
  geometry.scale(scale, -scale, scale)
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  geometry.translate(
    -(bounds.min.x + bounds.max.x) / 2,
    -bounds.min.y,
    -(bounds.min.z + bounds.max.z) / 2
  )

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.05,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  return group
}
