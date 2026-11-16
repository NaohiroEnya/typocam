// Accumulates captured photos in the UI, persisted to localStorage so they survive a reload.
// Each photo is a JPEG data URL, capped both in count and quality to stay well under browsers'
// per-origin localStorage quota (~5-10MB).
const STORAGE_KEY = 'font-photo-ar:photos'
const MAX_PHOTOS = 24

let photos = []
let els = null

const readStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos))
  } catch (err) {
    // e.g. QuotaExceededError -- the photo still shows for this session, it just won't persist.
    console.warn('写真の保存に失敗しました(ストレージ容量の可能性があります)', err)
  }
}

const closeViewer = () => {
  els.viewer.hidden = true
}

const openViewer = (photo) => {
  els.viewer.dataset.photoId = photo.id
  els.viewerImg.src = photo.dataUrl
  els.download.href = photo.dataUrl
  els.download.download = `font-photo-ar-${photo.id}.jpg`
  els.viewer.hidden = false
}

const render = () => {
  els.grid.innerHTML = ''
  els.empty.hidden = photos.length > 0
  els.badge.hidden = photos.length === 0
  els.badge.textContent = String(photos.length)
  els.overlayCount.textContent = String(photos.length)

  photos.slice().reverse().forEach((photo) => {
    const img = document.createElement('img')
    img.src = photo.dataUrl
    img.className = 'gallery-thumb'
    img.alt = '撮影した写真'
    img.addEventListener('click', () => openViewer(photo))
    els.grid.appendChild(img)
  })
}

export const addPhoto = (dataUrl) => {
  photos.push({id: `${Date.now()}`, dataUrl})
  if (photos.length > MAX_PHOTOS) {
    photos = photos.slice(photos.length - MAX_PHOTOS)
  }
  writeStorage()
  render()
}

export const initGallery = () => {
  els = {
    openButton: document.getElementById('gallery-open'),
    badge: document.getElementById('gallery-count'),
    overlay: document.getElementById('gallery-overlay'),
    overlayCount: document.getElementById('gallery-overlay-count'),
    grid: document.getElementById('gallery-grid'),
    empty: document.getElementById('gallery-empty'),
    closeButton: document.getElementById('gallery-close'),
    viewer: document.getElementById('photo-viewer'),
    viewerImg: document.getElementById('photo-viewer-img'),
    download: document.getElementById('photo-download'),
    deleteButton: document.getElementById('photo-delete'),
    viewerClose: document.getElementById('photo-viewer-close'),
  }

  photos = readStorage()
  render()

  els.openButton.addEventListener('click', () => {
    els.overlay.hidden = false
  })
  els.closeButton.addEventListener('click', () => {
    els.overlay.hidden = true
  })
  els.viewerClose.addEventListener('click', closeViewer)
  els.deleteButton.addEventListener('click', () => {
    const id = els.viewer.dataset.photoId
    photos = photos.filter((photo) => photo.id !== id)
    writeStorage()
    render()
    closeViewer()
  })
}
