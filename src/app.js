// app.js is the main entry point for TYPO CAM: it boots the 8th Wall camera pipeline (unchanged
// from Font Photo AR), holds the current text settings, and connects the DOM UI (ui.js) to the
// AR scene (scene.js) and the video recorder (run-recorder.js, from Font AR).
import * as THREE from 'three'

import {createScenePipeline} from './scene'
import {createRunRecorder} from './run-recorder'
import {createUI} from './ui'
import {findColor} from './colors'
import {DEFAULT_PRESET_ID, findPreset} from './presets'
import {recipeFromUrl, recipeToUrl, clampSize} from './recipe'

window.THREE = THREE

const MAX_VIDEO_SECONDS = 60
const CAPTURE_TIMEOUT_MS = 3000

// The settings the next placed text gets -- and, while a text is selected, that text's settings.
const presetSettings = ({id, fontId, colorId, place, motion}) => ({presetId: id, fontId, colorId, place, motion})
const sharedRecipe = recipeFromUrl()
const state = sharedRecipe || {
  text: '',
  ...presetSettings(findPreset(DEFAULT_PRESET_ID)),
  size: 1,
}

let selected = false
let placedCount = 0

const getPlacementOptions = () => {
  if (!state.text) {
    return null
  }
  return {
    ...state,
    color: findColor(state.colorId).hex,
    look: findPreset(state.presetId).look,
  }
}

const updateGuide = () => {
  if (placedCount > 0) {
    ui.setGuide(null)
  } else {
    ui.setGuide(state.text ? 'タップして文字を置く' : '空間に文字を置く')
  }
}

// Called after any settings change: refreshes the UI and, if a text is selected, rebuilds it.
const applyChange = () => {
  ui.render(state)
  updateGuide()
  if (selected) {
    scene.updateSelected(getPlacementOptions())
  }
}

const dataUrlToFile = (dataUrl, name) => {
  const [header, base64] = dataUrl.split(',')
  const type = header.match(/data:(.*?);/)[1]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new File([bytes], name, {type})
}

const timestamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

// ---------- Capture ----------

const recorder = createRunRecorder({
  getSourceCanvas: () => document.getElementById('camerafeed'),
  filePrefix: 'typocam',
})
let recording = null // {startedAt, interval} while a video is being recorded

const takePhoto = async () => {
  ui.setCapturing(true)
  scene.setHelpersVisible(false)
  let timeout = null
  try {
    const dataUrl = await Promise.race([
      scene.requestCapture(),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS)
      }),
    ])
    if (!dataUrl) {
      ui.toast('カメラが起動していないため撮影できません')
      return
    }
    ui.flash()
    ui.showResult(dataUrlToFile(dataUrl, `typocam-${timestamp()}.jpg`))
  } finally {
    clearTimeout(timeout)
    scene.setHelpersVisible(true)
    ui.setCapturing(false)
  }
}

const stopRecording = async () => {
  if (!recording) {
    return
  }
  clearInterval(recording.interval)
  recording = null
  const file = await recorder.finish()
  scene.setHelpersVisible(true)
  ui.setRecording(false)
  if (file) {
    ui.showResult(file)
  } else {
    ui.toast('録画できませんでした')
  }
}

const startRecording = () => {
  if (!recorder.supported) {
    ui.toast('このブラウザは動画の録画に対応していません')
    return
  }
  scene.setHelpersVisible(false)
  recorder.start()
  const startedAt = performance.now()
  recording = {
    startedAt,
    interval: setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000
      ui.setRecordingTime(seconds)
      if (seconds >= MAX_VIDEO_SECONDS) {
        stopRecording()
      }
    }, 250),
  }
  ui.setRecording(true)
}

// ---------- Recipe ----------

const shareRecipe = async () => {
  const url = recipeToUrl(state)
  if (navigator.share) {
    try {
      await navigator.share({title: 'TYPO CAM', text: `「${state.text}」を空間に置いて撮ろう`, url})
      ui.closeRecipe()
      return
    } catch (error) {
      if (error.name === 'AbortError') {
        return
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    ui.toast('レシピのリンクをコピーしました')
  } catch {
    window.prompt('このリンクをコピーして共有してください', url)
  }
  ui.closeRecipe()
}

// ---------- Wiring ----------

const ui = createUI({
  onText: (text) => {
    if (!text && selected) {
      return // keep the selected text rather than blanking it
    }
    state.text = text
    applyChange()
  },
  onPreset: (presetId) => {
    Object.assign(state, presetSettings(findPreset(presetId)))
    applyChange()
  },
  onFont: (fontId) => {
    state.fontId = fontId
    applyChange()
  },
  onColor: (colorId) => {
    state.colorId = colorId
    applyChange()
  },
  onPlace: (place) => {
    state.place = place
    applyChange()
  },
  onMotion: (motion) => {
    state.motion = motion
    applyChange()
  },
  onDelete: () => scene.deleteSelected(),
  onDeselect: () => scene.deselect(),
  onShutter: (mode) => {
    if (mode === 'photo') {
      takePhoto()
    } else if (recording) {
      stopRecording()
    } else {
      startRecording()
    }
  },
  onShareRecipe: shareRecipe,
})

const scene = createScenePipeline({
  getPlacementOptions,
  onNeedText: () => ui.openTextEditor(),
  onPlaced: () => {
    placedCount += 1
    updateGuide()
  },
  onSelectionChange: (options) => {
    selected = !!options
    ui.setSelectionVisible(selected)
    if (options) {
      // Selecting a placed text loads its settings, so the tools edit that text.
      const {text, presetId, fontId, colorId, place, motion, size} = options
      Object.assign(state, {text, presetId, fontId, colorId, place, motion, size})
      ui.render(state)
    }
  },
  onScaleChange: (scale) => {
    state.size = clampSize(scale)
  },
  onFrameRendered: () => recorder.captureFrame(),
})

ui.render(state)
updateGuide()
if (sharedRecipe) {
  ui.toast(`レシピ「${sharedRecipe.text}」を読み込みました。空間をタップして置いてください`, 4000)
}

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
    // Custom pipeline module: text placement + photo/video capture. Added last so its onRender
    // runs after the Threejs module has already drawn the camera + AR scene for this frame.
    scene.pipelineModule,
  ])

  const canvas = document.getElementById('camerafeed')
  // Open the camera and start running the camera run loop.
  XR8.run({canvas})
}

window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)
