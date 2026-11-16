// 8th Wall XR Camera Pipeline Module: lets the user tap the ground to fix text in real space,
// drag a placed text to move it, pinch to resize it, twist to rotate it, and grab a still frame
// (or a per-frame hook, for video) of the composited camera + AR scene.
// XR8.XrController provides real 6DoF SLAM tracking, so text placed here stays anchored to the
// physical location it was tapped on, including depth (distance from the camera) — unlike a
// DeviceOrientation-only approach, which can only react to tilt, not real-world position.
import * as THREE from 'three'

import {createTextMesh} from './text-plane'

const SELECTION_RING_COLOR = 0xffffff
const MIN_SCALE = 0.2
const MAX_SCALE = 6

// A thin flat ring, sized to the selected text's footprint, added as a child of its group so it
// automatically follows that group's position, rotation, and (importantly, for pinch resizing)
// scale without any extra transform math.
const createSelectionRing = (group) => {
  const mesh = group.userData.textMesh
  if (!mesh) {
    return null // e.g. a glyph outside the bundled font, which produced an empty group
  }
  const bounds = mesh.geometry.boundingBox
  const outerRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.65 + 0.04
  const geometry = new THREE.RingGeometry(outerRadius * 0.9, outerRadius, 48)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.MeshBasicMaterial({
    color: SELECTION_RING_COLOR,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(geometry, material)
  ring.position.y = 0.003 // just above the ground text sits on, to avoid z-fighting
  ring.renderOrder = 1
  return ring
}

const disposeMesh = (mesh) => {
  mesh.geometry.dispose()
  mesh.material.dispose()
}

// `getPlacementOptions` is called at the moment of each tap so the current text settings always
// apply to the next placed object, without this module needing to know about the UI that manages
// them; it returns null when there's no text yet, in which case `onNeedText` is called instead of
// placing. `onSelectionChange` is called with the selected group's options (or null) whenever
// selection changes, `onPlaced` after a new text lands, and `onScaleChange` with the selected
// text's scale after a pinch. `onFrameRendered` is called once per frame right after the AR scene
// has been drawn (used to feed the video recorder).
export const createScenePipeline = ({
  getPlacementOptions,
  onNeedText,
  onPlaced,
  onSelectionChange,
  onScaleChange,
  onFrameRendered,
}) => {
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
  let helpersVisible = true
  let drag = null // {touchId, offset} while one finger drags selectedGroup
  let pinch = null // {distance, angle, scale, rotationY} at the start of a two-finger gesture

  // Each placed text is a group holding the text mesh (plus, while selected, the ring). The group
  // carries the transform; the mesh can be swapped out when the text/font/color/style change.
  const buildTextMesh = async (options) => {
    const built = await createTextMesh(options.text, {
      fontId: options.fontId,
      color: options.color,
      look: options.look,
    })
    const [mesh] = built.children
    return mesh || null
  }

  const setTextMesh = (group, mesh) => {
    const previous = group.userData.textMesh
    if (previous) {
      group.remove(previous)
      disposeMesh(previous)
    }
    group.userData.textMesh = mesh
    if (mesh) {
      group.add(mesh)
    }
  }

  const removeRing = (group) => {
    const ring = group.userData.selectionRing
    if (ring) {
      group.remove(ring)
      disposeMesh(ring)
      delete group.userData.selectionRing
    }
  }

  const addRing = (group) => {
    const ring = createSelectionRing(group)
    if (ring) {
      ring.visible = helpersVisible
      group.add(ring)
      group.userData.selectionRing = ring
    }
  }

  const placeTextAt = async ({scene, camera}, point) => {
    const options = getPlacementOptions()
    if (!options) {
      onNeedText()
      return
    }
    const group = new THREE.Group()
    setTextMesh(group, await buildTextMesh(options))
    group.userData.options = options
    group.position.copy(point)
    group.scale.setScalar(options.size)
    // Stand upright facing the viewer: only the camera's heading is used, so text never tilts
    // into the ground when the phone is pointed down at the spot it's placed on.
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    group.rotation.set(0, Math.atan2(-forward.x, -forward.z), 0)
    scene.add(group)
    placedTexts.push(group)
    select(group)
    onPlaced()
  }

  const deselect = () => {
    if (!selectedGroup) {
      return
    }
    removeRing(selectedGroup)
    selectedGroup = null
    drag = null
    pinch = null
    onSelectionChange(null)
  }

  const select = (group) => {
    if (group === selectedGroup) {
      return
    }
    deselect()
    selectedGroup = group
    addRing(group)
    onSelectionChange({...group.userData.options, size: group.scale.x})
  }

  // Rebuilds the selected text with new settings (text/font/color/look), keeping where it is,
  // how it's turned, and how big it was pinched to.
  const updateSelected = async (options) => {
    const group = selectedGroup
    if (!group) {
      return
    }
    group.userData.options = options
    const token = Symbol('rebuild')
    group.userData.rebuildToken = token
    const mesh = await buildTextMesh(options)
    if (group.userData.rebuildToken !== token) {
      if (mesh) disposeMesh(mesh) // a newer change already superseded this one
      return
    }
    removeRing(group)
    setTextMesh(group, mesh)
    if (group === selectedGroup) {
      addRing(group)
    }
  }

  const deleteSelected = () => {
    if (!selectedGroup || !liveScene) {
      return
    }
    const group = selectedGroup
    deselect()
    liveScene.remove(group)
    placedTexts.splice(placedTexts.indexOf(group), 1)
    setTextMesh(group, null)
  }

  // Hides scene-side UI (the selection ring) so photos and videos show only the camera and text.
  const setHelpersVisible = (visible) => {
    helpersVisible = visible
    const ring = selectedGroup && selectedGroup.userData.selectionRing
    if (ring) {
      ring.visible = visible
    }
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
    updateSelected,
    deleteSelected,
    deselect,
    setHelpersVisible,
    pipelineModule: {
      name: 'typocam',

      onStart: ({canvas}) => {
        const {scene, camera, renderer} = XR8.Threejs.xrScene()
        liveScene = scene

        initXrScene({scene, camera, renderer})

        XR8.XrController.updateCameraProjectionMatrix(
          {origin: camera.position, facing: camera.quaternion}
        )

        const groundPointFromTouch = (touch) => {
          pointer.x = (touch.clientX / window.innerWidth) * 2 - 1
          pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1
          raycaster.setFromCamera(pointer, camera)
          const [groundHit] = raycaster.intersectObject(ground)
          return groundHit ? groundHit.point : null
        }

        const twoFingerMetrics = (touches) => {
          const dx = touches[1].clientX - touches[0].clientX
          const dy = touches[1].clientY - touches[0].clientY
          return {distance: Math.hypot(dx, dy), angle: Math.atan2(dy, dx)}
        }

        const startPinch = (touches) => {
          drag = null
          pinch = {
            ...twoFingerMetrics(touches),
            scale: selectedGroup.scale.x,
            rotationY: selectedGroup.rotation.y,
          }
        }

        canvas.addEventListener('touchstart', async (event) => {
          if (event.touches.length === 2 && selectedGroup) {
            startPinch(event.touches)
            return
          }
          if (event.touches.length !== 1) {
            return
          }

          const touch = event.touches[0]
          pointer.x = (touch.clientX / window.innerWidth) * 2 - 1
          pointer.y = -(touch.clientY / window.innerHeight) * 2 + 1
          raycaster.setFromCamera(pointer, camera)

          // Touching a placed text selects it and starts dragging it straight away; touching
          // empty ground either deselects, or -- if nothing is selected -- places a new text with
          // the current settings.
          const [textHit] = raycaster.intersectObjects(placedTexts, true)
          if (textHit) {
            let hitGroup = textHit.object
            while (hitGroup.parent && !placedTexts.includes(hitGroup)) {
              hitGroup = hitGroup.parent
            }
            select(hitGroup)
            const point = groundPointFromTouch(touch)
            drag = {
              touchId: touch.identifier,
              offset: point ? hitGroup.position.clone().sub(point) : new THREE.Vector3(),
            }
            return
          }

          if (selectedGroup) {
            deselect()
            return
          }

          const point = groundPointFromTouch(touch)
          if (point) {
            await placeTextAt({scene, camera}, point)
          }
        }, true)

        canvas.addEventListener('touchmove', (event) => {
          event.preventDefault()

          if (!selectedGroup) {
            return
          }
          if (event.touches.length >= 2) {
            if (!pinch) {
              startPinch(event.touches) // second finger landed mid-drag
            }
            const {distance, angle} = twoFingerMetrics(event.touches)
            const scale = THREE.MathUtils.clamp(pinch.scale * (distance / pinch.distance), MIN_SCALE, MAX_SCALE)
            selectedGroup.scale.setScalar(scale)
            // Twisting the fingers clockwise on screen turns the text clockwise seen from above.
            selectedGroup.rotation.y = pinch.rotationY - (angle - pinch.angle)
            return
          }
          if (!drag) {
            return
          }
          const touch = Array.from(event.touches).find((t) => t.identifier === drag.touchId)
          if (!touch) {
            return
          }
          const point = groundPointFromTouch(touch)
          if (point) {
            selectedGroup.position.copy(point.add(drag.offset))
          }
        }, true)

        const endGesture = (event) => {
          if (pinch && event.touches.length < 2) {
            pinch = null
            if (selectedGroup) {
              selectedGroup.userData.options.size = selectedGroup.scale.x
              onScaleChange(selectedGroup.scale.x)
            }
          }
          // Lifting one finger of a pinch shouldn't turn the other into a drag (it would jump).
          if (event.touches.length === 0 || (drag && !Array.from(event.touches).some((t) => t.identifier === drag.touchId))) {
            drag = null
          }
        }
        canvas.addEventListener('touchend', endGesture, true)
        canvas.addEventListener('touchcancel', endGesture, true)
      },

      onRender: () => {
        onFrameRendered()
        if (pendingCaptures.length === 0) {
          return
        }
        const canvas = document.getElementById('camerafeed')
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        const resolvers = pendingCaptures
        pendingCaptures = []
        resolvers.forEach((resolve) => resolve(dataUrl))
      },
    },
  }
}
