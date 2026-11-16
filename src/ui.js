// TYPO CAM's on-screen UI: the right-hand toolbar and its sheets, the text editor, the shutter and
// photo/video switch, the capture result viewer, and the recipe sheet. Pure DOM -- it knows
// nothing about 8th Wall or three.js; app.js connects its callbacks to the AR scene.
import {FONTS, findFont} from './fonts'
import {COLORS, findColor} from './colors'
import {STYLES, findStyle} from './styles'

const $ = (id) => document.getElementById(id)

const FONT_SAMPLE = 'あア字Aa'
const sampleOf = (text, fallback, length = 6) => (text ? Array.from(text).slice(0, length).join('') : fallback)

// Shows `el` in a font, squeezing it horizontally for the condensed face the same way the 3D
// geometry is squeezed.
const applyFont = (el, fontId) => {
  const font = findFont(fontId)
  el.style.fontFamily = `'${font.cssFamily}', sans-serif`
  el.style.display = 'inline-block'
  el.style.transform = font.scaleX === 1 ? '' : `scaleX(${font.scaleX})`
}

// Black text is unreadable on the dark glass, so give it a light halo in previews.
const applyColor = (el, colorId) => {
  const {hex} = findColor(colorId)
  el.style.color = hex
  el.style.textShadow = colorId === 'black' ? '0 0 6px rgba(255,255,255,0.85)' : ''
}

export const createUI = (handlers) => {
  const body = document.body
  const guide = $('guide')
  const toolButtons = Array.from(document.querySelectorAll('.tool'))
  const sheets = Array.from(document.querySelectorAll('.sheet'))
  let openSheet = null
  let latestState = null

  // ---------- Tool sheets ----------

  const setOpenSheet = (name) => {
    openSheet = name
    sheets.forEach((sheet) => {
      sheet.hidden = sheet.dataset.sheet !== name
    })
    toolButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.tool === name)
    })
  }

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const {tool} = button.dataset
      if (tool === 'text') {
        setOpenSheet(null)
        openTextEditor()
        return
      }
      setOpenSheet(openSheet === tool ? null : tool)
    })
  })

  const buildOptionRow = (container, items, {className, decorate, onSelect}) => {
    const buttons = items.map((item) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = className
      button.dataset.id = item.id
      decorate(button, item)
      button.addEventListener('click', () => onSelect(item))
      container.appendChild(button)
      return button
    })
    return (selectedId) => {
      buttons.forEach((button) => button.classList.toggle('selected', button.dataset.id === selectedId))
    }
  }

  const optionCard = (button, label) => {
    const sample = document.createElement('span')
    sample.className = 'option-sample'
    const caption = document.createElement('span')
    caption.className = 'option-label'
    caption.textContent = label
    button.append(sample, caption)
    return sample
  }

  const styleSamples = []
  const markStyle = buildOptionRow($('style-row'), STYLES, {
    className: 'option-card',
    decorate: (button, style) => {
      const sample = optionCard(button, style.label)
      applyFont(sample, style.fontId)
      applyColor(sample, style.colorId)
      styleSamples.push(sample)
    },
    onSelect: (style) => handlers.onStyle(style.id),
  })

  const fontSamples = []
  const markFont = buildOptionRow($('font-row'), FONTS, {
    className: 'option-card',
    decorate: (button, font) => {
      const sample = optionCard(button, font.label)
      applyFont(sample, font.id)
      fontSamples.push(sample)
    },
    onSelect: (font) => handlers.onFont(font.id),
  })

  const markColor = buildOptionRow($('color-row'), COLORS, {
    className: 'color-swatch',
    decorate: (button, color) => {
      button.style.backgroundColor = color.hex
      button.setAttribute('aria-label', color.label)
      button.title = color.label
    },
    onSelect: (color) => handlers.onColor(color.id),
  })

  // Reflects the current text settings everywhere they show: the selected option in each sheet,
  // the previews (which use the actual text being edited), and the toolbar's font/color icons.
  const render = (state) => {
    latestState = state
    markStyle(state.styleId)
    markFont(state.fontId)
    markColor(state.colorId)
    styleSamples.forEach((el) => {
      el.textContent = sampleOf(state.text, 'TYPO', 3)
    })
    fontSamples.forEach((el) => {
      el.textContent = sampleOf(state.text, FONT_SAMPLE, 4)
      applyColor(el, state.colorId)
    })
    applyFont($('tool-font-preview'), state.fontId)
    $('tool-color-dot').style.backgroundColor = findColor(state.colorId).hex
  }

  // ---------- Text editor ----------

  const editor = $('text-editor')
  const input = $('text-input')

  const openTextEditor = () => {
    input.value = latestState.text
    applyFont(input, latestState.fontId)
    input.style.display = ''
    input.style.transform = ''
    applyColor(input, latestState.colorId)
    editor.hidden = false
    input.focus()
  }

  const closeTextEditor = () => {
    input.blur()
    editor.hidden = true
  }

  editor.addEventListener('submit', (event) => {
    event.preventDefault()
    closeTextEditor()
    handlers.onText(input.value.trim())
  })
  $('text-editor-cancel').addEventListener('click', closeTextEditor)

  // ---------- Selection ----------

  $('selection-delete').addEventListener('click', handlers.onDelete)
  $('selection-done').addEventListener('click', handlers.onDeselect)

  const setSelectionVisible = (visible) => {
    $('selection-bar').hidden = !visible
  }

  // ---------- Guide / feedback ----------

  const setGuide = (text) => {
    guide.textContent = text || ''
    guide.style.opacity = text ? '' : '0'
  }

  const toastEl = $('toast')
  let toastTimer = null
  const toast = (message, duration = 2400) => {
    toastEl.textContent = message
    toastEl.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastEl.hidden = true
    }, duration)
  }

  const flash = () => {
    const el = $('flash')
    el.classList.add('active')
    setTimeout(() => el.classList.remove('active'), 180)
  }

  // ---------- Shutter / mode ----------

  let mode = 'photo'
  const modeButtons = Array.from(document.querySelectorAll('#mode-switch button'))
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode
      modeButtons.forEach((b) => b.setAttribute('aria-checked', String(b === button)))
      body.classList.toggle('mode-video', mode === 'video')
      $('shutter').setAttribute('aria-label', mode === 'video' ? '録画を開始' : '写真を撮る')
    })
  })

  const shutter = $('shutter')
  shutter.addEventListener('click', () => handlers.onShutter(mode))

  // Hides the overlay for an instant while a photo is taken (it isn't in the photo either way --
  // the canvas has no DOM in it -- but this is the cue that the shot happened).
  const setCapturing = (capturing) => {
    body.classList.toggle('is-capturing', capturing)
    shutter.disabled = capturing
  }

  const timer = $('record-timer')
  const setRecording = (recording) => {
    body.classList.toggle('is-recording', recording)
    timer.hidden = !recording
    timer.textContent = '0:00'
    shutter.setAttribute('aria-label', recording ? '録画を停止' : '録画を開始')
    if (recording) {
      setOpenSheet(null)
    }
  }
  const setRecordingTime = (seconds) => {
    timer.textContent = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  }

  // ---------- Capture result ----------

  const result = $('result')
  const resultMedia = $('result-media')
  let resultFile = null
  let resultUrl = null

  const closeResult = () => {
    result.hidden = true
    resultMedia.innerHTML = ''
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl)
    }
    resultFile = null
    resultUrl = null
  }

  const showResult = (file) => {
    closeResult()
    resultFile = file
    resultUrl = URL.createObjectURL(file)
    let media
    if (file.type.startsWith('video/')) {
      media = document.createElement('video')
      media.src = resultUrl
      media.controls = true
      media.autoplay = true
      media.loop = true
      media.muted = true
      media.playsInline = true
    } else {
      media = document.createElement('img')
      media.src = resultUrl
      media.alt = '撮影した写真'
    }
    resultMedia.appendChild(media)
    result.hidden = false
  }

  // Saves via the share sheet where it can take files (on iOS that's how a photo/video reaches the
  // camera roll: 「画像を保存」/「ビデオを保存」), otherwise as a download.
  $('result-save').addEventListener('click', async () => {
    if (!resultFile) {
      return
    }
    if (navigator.canShare && navigator.canShare({files: [resultFile]})) {
      try {
        await navigator.share({files: [resultFile]})
        return
      } catch (error) {
        if (error.name === 'AbortError') {
          return // user closed the share sheet
        }
      }
    }
    const link = $('result-download')
    link.href = resultUrl
    link.download = resultFile.name
    link.click()
  })
  $('result-close').addEventListener('click', closeResult)

  // ---------- Recipe ----------

  const recipe = $('recipe')
  $('recipe-open').addEventListener('click', () => {
    if (!latestState.text) {
      toast('まず「文字」で言葉を入力してください')
      return
    }
    const preview = $('recipe-preview')
    preview.textContent = latestState.text
    applyFont(preview, latestState.fontId)
    applyColor(preview, latestState.colorId)
    $('recipe-meta').textContent = [
      findStyle(latestState.styleId).label,
      findFont(latestState.fontId).label,
      findColor(latestState.colorId).label,
      `サイズ ×${latestState.size.toFixed(1)}`,
    ].join(' · ')
    setOpenSheet(null)
    recipe.hidden = false
  })
  $('recipe-close').addEventListener('click', () => {
    recipe.hidden = true
  })
  recipe.addEventListener('click', (event) => {
    if (event.target === recipe) {
      recipe.hidden = true
    }
  })
  $('recipe-share').addEventListener('click', handlers.onShareRecipe)

  return {
    render,
    openTextEditor,
    closeSheets: () => setOpenSheet(null),
    setSelectionVisible,
    setGuide,
    toast,
    flash,
    setCapturing,
    setRecording,
    setRecordingTime,
    showResult,
    closeRecipe: () => {
      recipe.hidden = true
    },
  }
}
