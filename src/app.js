// app.js is the main entry point for the Font Photo AR app: it wires up the 8th Wall camera
// pipeline, the font/color selection chips, and the photo capture + gallery UI.
import * as THREE from 'three'

import {createScenePipeline} from './scene'
import {initGallery, addPhoto} from './gallery'
import {FONTS, DEFAULT_FONT_ID} from './fonts'
import {COLORS, DEFAULT_COLOR_ID} from './colors'
import {SIZES, DEFAULT_SIZE_ID} from './sizes'

window.THREE = THREE

const state = {
  fontId: DEFAULT_FONT_ID,
  colorId: DEFAULT_COLOR_ID,
  sizeId: DEFAULT_SIZE_ID,
}

const getPlacementOptions = () => ({
  text: document.getElementById('text-input').value.trim() || 'AR',
  fontId: state.fontId,
  color: COLORS.find((c) => c.id === state.colorId).hex,
  worldHeight: SIZES.find((s) => s.id === state.sizeId).worldHeight,
})

const PLACEMENT_INSTRUCTIONS = '文字を入力し、フォント・色・サイズを選んで地面をタップすると設置されます(設置済みの文字をタップすると選択できます)'
const SELECTION_INSTRUCTIONS = '選択中の文字をドラッグすると位置を移動できます。スライダーでサイズも調整できます'

const instructionsEl = document.getElementById('instructions')
const placementPanel = document.getElementById('placement-panel')
const selectionPanel = document.getElementById('selection-panel')
const selectionSizeInput = document.getElementById('selection-size')

const handleSelectionChange = (group) => {
  const selected = !!group
  placementPanel.hidden = selected
  selectionPanel.hidden = !selected
  instructionsEl.textContent = selected ? SELECTION_INSTRUCTIONS : PLACEMENT_INSTRUCTIONS
  if (selected) {
    selectionSizeInput.value = '1'
  }
}

const {pipelineModule, requestCapture, setSelectedScale, deleteSelected, deselect} =
  createScenePipeline({getPlacementOptions, onSelectionChange: handleSelectionChange})

selectionSizeInput.addEventListener('input', (event) => {
  setSelectedScale(Number(event.target.value))
})
document.getElementById('selection-delete').addEventListener('click', () => {
  deleteSelected()
})
document.getElementById('selection-done').addEventListener('click', () => {
  deselect()
})

// Renders a row of selectable "chip" buttons and keeps exactly one marked `.selected`.
const buildChipRow = (container, items, {selectedId, onSelect, decorate}) => {
  items.forEach((item) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    if (item.id === selectedId) {
      button.classList.add('selected')
    }
    decorate(button, item)
    button.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach((el) => el.classList.remove('selected'))
      button.classList.add('selected')
      onSelect(item)
    })
    container.appendChild(button)
  })
}

buildChipRow(document.getElementById('font-row'), FONTS, {
  selectedId: state.fontId,
  onSelect: (font) => {
    state.fontId = font.id
  },
  decorate: (button, font) => {
    button.textContent = font.label
    button.style.fontFamily = `'${font.cssFamily}', sans-serif`
  },
})

buildChipRow(document.getElementById('color-row'), COLORS, {
  selectedId: state.colorId,
  onSelect: (color) => {
    state.colorId = color.id
  },
  decorate: (button, color) => {
    button.classList.add('chip-color')
    button.style.backgroundColor = color.hex
    button.setAttribute('aria-label', color.label)
    button.title = color.label
  },
})

buildChipRow(document.getElementById('size-row'), SIZES, {
  selectedId: state.sizeId,
  onSelect: (size) => {
    state.sizeId = size.id
  },
  decorate: (button, size) => {
    button.textContent = size.label
  },
})

initGallery()

const flashEl = document.getElementById('flash')
const flash = () => {
  flashEl.classList.add('active')
  setTimeout(() => flashEl.classList.remove('active'), 180)
}

const shutterButton = document.getElementById('shutter')
shutterButton.addEventListener('click', async () => {
  shutterButton.disabled = true
  try {
    const dataUrl = await requestCapture()
    flash()
    addPhoto(dataUrl)
  } finally {
    shutterButton.disabled = false
  }
})

const onxrloaded = () => {
  XR8.addCameraPipelineModules([  // Add camera pipeline modules.
    // Existing pipeline modules.
    XR8.GlTextureRenderer.pipelineModule(),      // Draws the camera feed.
    XR8.Threejs.pipelineModule(),                // Creates a ThreeJS AR Scene.
    XR8.XrController.pipelineModule(),           // Enables SLAM tracking.
    LandingPage.pipelineModule(),         // Detects unsupported browsers and gives hints.
    XRExtras.FullWindowCanvas.pipelineModule(),  // Modifies the canvas to fill the window.
    XRExtras.Loading.pipelineModule(),           // Manages the loading screen on startup.
    XRExtras.RuntimeError.pipelineModule(),      // Shows an error image on runtime error.
    // Custom pipeline module: text placement + photo capture. Added last so its onRender runs
    // after the Threejs module has already drawn the camera + AR scene for this frame.
    pipelineModule,
  ])

  const canvas = document.getElementById('camerafeed')
  // Open the camera and start running the camera run loop.
  XR8.run({canvas})
}

window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)
