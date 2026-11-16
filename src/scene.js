// 8th Wall XR Camera Pipeline Module: lets the user tap the ground to fix text in real space,
// select a placed text to drag-reposition or resize it, and grab a still frame of the composited
// camera + AR scene for the photo gallery.
// XR8.XrController provides real 6DoF SLAM tracking, so text placed here stays anchored to the
// physical location it was tapped on, including depth (distance from the camera) — unlike a
// DeviceOrientation-only approach, which can only react to tilt, not real-world position.
import * as THREE from 'three'

import {createTextMesh} from './text-plane'

const SELECTION_RING_COLOR = 0x2979ff

// A thin flat ring, sized to the selected text's footprint, added as a child of its group so it
// automatically follows that group's position, rotation, and (importantly, for the resize slider)
// scale without any extra transform math.
const createSelectionRing = (group) => {
  const mesh = group.children[0]
  if (!mesh) {
    return null // e.g. blank input, which produced an empty group
  }
  const bounds = mesh.geometry.boundingBox
  const outerRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.65 + 0.04
  const geometry = new THREE.RingGeometry(outerRadius * 0.85, outerRadius, 40)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.MeshBasicMaterial({
    color: SELECTION_RING_COLOR,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(geometry, material)
  ring.position.y = 0.003 // just above the ground text sits on, to avoid z-fighting
  ring.renderOrder = 1
  return ring
}

// `getPlacementOptions` is called at the moment of each tap so the currently selected text/font
// /color/size always apply to the next placed object, without this module needing to know about
// the UI that manages those choices. `onSelectionChange` is called with the selected group (or
// null) whenever selection changes, so the UI can show/hide the position/size controls.
export const createScenePipeline = ({getPlacementOptions, onSelectionChange}) => {
  // Plane used both as the raycast target for tap placement/dragging and as a shadow-catcher:
  // it's invisible except where a placed text object blocks the light, so text reads as sitting
  // on the ground rather than floating.
  const groundGeometry = new THREE.PlaneGeometry(2000, 2000)
  groundGeometry.rotateX(-Math.PI / 2)
  const groundMaterial = new THREE.ShadowMaterial()
  groundMaterial.opacity = 0.35
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.receiveShadow = true

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const placedTexts = [] // groups currently placed in the scene, for tap-to-select

  let liveScene = null
  let selectedGroup = null
  let dragTouchId = null // touch identifier currently dragging selectedGroup, or null

  const placeTextAt = async ({scene, camera}, point) => {
    const {text, fontId, color, worldHeight} = getPlacementOptions()
    const group = await createTextMesh(text, {fontId, color, worldHeight})
    group.position.copy(point)
    group.quaternion.copy(camera.quaternion) // face the viewer at the moment it's placed
    scene.add(group)
    placedTexts.push(group)
  }

  const removeGroup = (scene, group) => {
    scene.remove(group)
    placedTexts.splice(placedTexts.indexOf(group), 1)
  }

  const deselect = () => {
    if (!selectedGroup) {
      return
    }
    const ring = selectedGroup.userData.selectionRing
    if (ring) {
      selectedGroup.remove(ring)
      ring.geometry.dispose()
      ring.material.dispose()
      delete selectedGroup.userData.selectionRing
    }
    selectedGroup = null
    dragTouchId = null
    onSelectionChange(null)
  }

  const select = (group) => {
    if (group === selectedGroup) {
      return
    }
    deselect()
    selectedGroup = group
    const ring = createSelectionRing(group)
    if (ring) {
      group.add(ring)
      group.userData.selectionRing = ring
    }
    onSelectionChange(group)
  }

  const setSelectedScale = (scale) => {
    if (selectedGroup) {
      selectedGroup.scale.setScalar(scale)
    }
  }

  const deleteSelected = () => {
    if (!selectedGroup || !liveScene) {
      return
    }
    const group = selectedGroup
    deselect()
    removeGroup(liveScene, group)
  }

  const initXrScene = ({scene, camera, renderer}) => {
    renderer.shadowMap.enabled = true
    scene.add(ground)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(3, 6, 4)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.set(2048, 2048)
    const shadowCam = directionalLight.shadow.camera
    shadowCam.left = -10
    shadowCam.right = 10
    shadowCam.top = 10
    shadowCam.bottom = -10
    shadowCam.far = 30
    shadowCam.updateProjectionMatrix()
    scene.add(directionalLight)
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    camera.position.set(0, 1.6, 2)
  }

  // Photo capture: resolved from onRender (see below), which -- because this module is added to
  // the camera pipeline after XR8.Threejs's own module -- always runs right after that frame's
  // camera + AR scene have already been drawn into the canvas. Reading the canvas synchronously
  // at that point captures exactly what was just drawn, without needing a costly
  // `preserveDrawingBuffer: true` context (the backbuffer isn't swapped/cleared until control
  // returns to the browser after this synchronous call finishes).
  let pendingCaptures = []
  const requestCapture = () => new Promise((resolve) => {
    pendingCaptures.push(resolve)
  })

  return {
    requestCapture,
    setSelectedScale,
    deleteSelected,
    deselect,
    pipelineModule: {
      name: 'font-photo-ar',

      onStart: ({canvas}) => {
        const {scene, camera, renderer} = XR8.Threejs.xrScene()
        liveScene = scene

        initXrScene({scene, camera, renderer})

        XR8.XrController.updateCameraProjectionMatrix(
          {origin: camera.position, facing: camera.quaternion}
        )

        const setPointerFromTouch = (touch) => {
          pointer.x = (touch.clientX / window.innerWidth) * 2 - 1
          pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1
        }

        canvas.addEventListener('touchstart', async (event) => {
          if (event.touches.length !== 1) {
            return
          }

          const touch = event.touches[0]
          setPointerFromTouch(touch)
          raycaster.setFromCamera(pointer, camera)

          // Tapping an already-placed text selects it (or, if it's already selected, starts
          // dragging it); tapping empty ground either deselects, or -- if nothing is selected --
          // places a new text using whatever text/font/color/size are currently chosen in the UI.
          const [textHit] = raycaster.intersectObjects(placedTexts, true)
          if (textHit) {
            const hitGroup = textHit.object.parent
            if (hitGroup === selectedGroup) {
              dragTouchId = touch.identifier
            } else {
              select(hitGroup)
            }
            return
          }

          if (selectedGroup) {
            deselect()
            return
          }

          const [groundHit] = raycaster.intersectObject(ground)
          if (groundHit) {
            await placeTextAt({scene, camera}, groundHit.point)
          }
        }, true)

        canvas.addEventListener('touchmove', (event) => {
          event.preventDefault()

          if (dragTouchId === null) {
            return
          }
          const touch = Array.from(event.touches).find((t) => t.identifier === dragTouchId)
          if (!touch) {
            return
          }
          setPointerFromTouch(touch)
          raycaster.setFromCamera(pointer, camera)
          const [groundHit] = raycaster.intersectObject(ground)
          if (groundHit) {
            selectedGroup.position.copy(groundHit.point)
          }
        }, true)

        const endDrag = () => {
          dragTouchId = null
        }
        canvas.addEventListener('touchend', endDrag, true)
        canvas.addEventListener('touchcancel', endDrag, true)
      },

      onRender: () => {
        if (pendingCaptures.length === 0) {
          return
        }
        const canvas = document.getElementById('camerafeed')
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const resolvers = pendingCaptures
        pendingCaptures = []
        resolvers.forEach((resolve) => resolve(dataUrl))
      },
    },
  }
}
