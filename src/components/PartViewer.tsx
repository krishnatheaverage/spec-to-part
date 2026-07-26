import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Grid3X3,
  RotateCcw,
  ScanLine,
} from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createPartGroup } from '../cad'
import type { PartParameters } from '../types'

interface PartViewerProps {
  params: PartParameters
  generating: boolean
}

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry?.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material?.dispose())
    }
  })
}

export function PartViewer({ params, generating }: PartViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const controlsRef = useRef<OrbitControls>()
  const partRef = useRef<THREE.Group>()
  const gridRef = useRef<THREE.GridHelper>()
  const resetRef = useRef<() => void>(() => undefined)
  const [wireframe, setWireframe] = useState(false)
  const [gridVisible, setGridVisible] = useState(true)
  const [triangles, setTriangles] = useState(0)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 2000)
    camera.up.set(0, 0, 1)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minPolarAngle = 0.15
    controls.maxPolarAngle = Math.PI * 0.92
    controlsRef.current = controls

    scene.add(new THREE.HemisphereLight('#eef6ff', '#26312f', 2.4))
    const key = new THREE.DirectionalLight('#ffffff', 4.6)
    key.position.set(-80, -90, 140)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const rim = new THREE.DirectionalLight('#75a7ff', 2.8)
    rim.position.set(100, 40, 50)
    scene.add(rim)

    const grid = new THREE.GridHelper(400, 40, '#46524e', '#29332f')
    grid.rotation.x = Math.PI / 2
    grid.material.transparent = true
    grid.material.opacity = 0.42
    gridRef.current = grid
    scene.add(grid)

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.ShadowMaterial({ color: '#000000', opacity: 0.28 }),
    )
    shadowPlane.receiveShadow = true
    shadowPlane.position.z = -4
    scene.add(shadowPlane)

    const resize = () => {
      const { clientWidth, clientHeight } = mount
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / Math.max(clientHeight, 1)
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    let frame = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      scene.clear()
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls) return

    if (partRef.current) {
      scene.remove(partRef.current)
      disposeObject(partRef.current)
    }

    const part = createPartGroup(params)
    partRef.current = part
    scene.add(part)

    let triangleCount = 0
    part.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const index = child.geometry.getIndex()
        triangleCount += index
          ? Math.round(index.count / 3)
          : Math.round(child.geometry.getAttribute('position').count / 3)
        ;(child.material as THREE.MeshStandardMaterial).wireframe = wireframe
      }
    })
    setTriangles(triangleCount)

    const size = Math.max(params.width, params.height, params.flangeHeight, 40)
    const resetCamera = () => {
      camera.position.set(size * 0.83, -size * 1.02, size * 0.78)
      controls.target.set(0, 0, params.kind === 'bracket' ? params.flangeHeight * 0.24 : 0)
      controls.update()
    }
    resetRef.current = resetCamera
    resetCamera()

    if (gridRef.current) {
      gridRef.current.position.z = -params.thickness / 2 - 1.2
    }
  }, [params, wireframe])

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = gridVisible
  }, [gridVisible])

  return (
    <div className={`viewer-shell ${generating ? 'is-generating' : ''}`}>
      <div ref={mountRef} className="viewer-canvas" aria-label="Interactive generated CAD model" />
      <div className="viewer-vignette" />

      <div className="viewer-topbar">
        <div className="model-badge">
          <span className="status-dot" />
          <span>MODEL / 001</span>
        </div>
        <div className="viewer-stats">
          <span>{triangles.toLocaleString()} TRI</span>
          <span>MM</span>
        </div>
      </div>

      <div className="axis-gizmo" aria-hidden="true">
        <span className="axis axis-z">Z</span>
        <span className="axis axis-y">Y</span>
        <span className="axis axis-x">X</span>
        <i />
      </div>

      <div className="viewer-toolbar" aria-label="Viewer controls">
        <button
          type="button"
          title="Reset view"
          onClick={() => resetRef.current()}
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          title="Toggle grid"
          className={gridVisible ? 'active' : ''}
          onClick={() => setGridVisible((visible) => !visible)}
        >
          <Grid3X3 size={16} />
        </button>
        <button
          type="button"
          title="Toggle wireframe"
          className={wireframe ? 'active' : ''}
          onClick={() => setWireframe((visible) => !visible)}
        >
          <ScanLine size={16} />
        </button>
      </div>

      <div className="viewer-caption">
        <Box size={15} />
        <span>
          {params.width} × {params.height} × {params.thickness} mm
        </span>
      </div>

      {generating && (
        <div className="generation-overlay">
          <div className="scan-line" />
          <div className="generation-mark">
            <span />
            REBUILDING SOLID
          </div>
        </div>
      )}
    </div>
  )
}
