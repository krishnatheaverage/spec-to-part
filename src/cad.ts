import * as THREE from 'three'
import type {
  GeneratedPart,
  ManufacturingSummary,
  PartParameters,
  Preset,
} from './types'

export const presets: Preset[] = [
  {
    id: 'mounting-plate',
    label: 'Mounting plate',
    eyebrow: '01 / CNC',
    spec: 'Mounting plate, 80mm x 40mm x 3mm aluminum, 4 mounting holes 3mm diameter positioned 5mm from each corner, one 10mm center cutout.',
  },
  {
    id: 'enclosure-panel',
    label: 'Enclosure panel',
    eyebrow: '02 / SHEET',
    spec: 'Enclosure panel, 120mm x 80mm x 2mm steel, 6 mounting holes 4mm diameter positioned 8mm from each edge, with a 60mm x 28mm rectangular center cutout.',
  },
  {
    id: 'motor-bracket',
    label: 'Motor bracket',
    eyebrow: '03 / BENT',
    spec: 'L bracket, 70mm x 50mm x 4mm steel, flange 36mm high, 4 mounting holes 5mm diameter positioned 8mm from each corner, one 22mm center cutout.',
  },
]

const defaults: PartParameters = {
  kind: 'plate',
  width: 80,
  height: 40,
  thickness: 3,
  holeCount: 4,
  holeDiameter: 3,
  edgeOffset: 5,
  centerCutoutDiameter: 10,
  flangeHeight: 35,
  material: '6061 aluminum',
}

const numberFrom = (value: string | undefined, fallback: number) =>
  value ? Number.parseFloat(value) : fallback

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function parseSpecification(spec: string): {
  params: PartParameters
  assumptions: string[]
  usedDefaultEnvelope: boolean
} {
  const normalized = spec.toLowerCase().replaceAll('×', 'x').replaceAll('ø', ' diameter ')
  const assumptions: string[] = []
  const dimensions = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?/,
  )

  const labeledValue = (labels: string[], suffixes: string[] = []) => {
    const labelPattern = labels.join('|')
    const suffixPattern = suffixes.join('|')
    const before = normalized.match(
      new RegExp(`(?:${labelPattern})\\s*(?:of|=|:|is)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:mm)?\\b`),
    )
    if (before) return Number.parseFloat(before[1])
    if (suffixPattern) {
      const after = normalized.match(
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:mm)?\\s*(?:${suffixPattern})\\b`),
      )
      if (after) return Number.parseFloat(after[1])
    }
    return undefined
  }

  const labeledWidth = labeledValue(['width', 'length'], ['wide', 'long', 'width'])
  const labeledDepth = labeledValue(['base depth', 'depth'], ['deep', 'depth'])
  const labeledHeight = labeledValue(['height'], ['high', 'height'])
  const labeledThickness = labeledValue(['thickness'], ['thick', 'thickness'])
  const hasLabeledEnvelope =
    labeledWidth !== undefined &&
    (labeledDepth !== undefined || labeledHeight !== undefined) &&
    labeledThickness !== undefined
  const usedDefaultEnvelope = !dimensions && !hasLabeledEnvelope

  if (usedDefaultEnvelope) {
    assumptions.push('Envelope defaulted to 80 × 40 × 3 mm.')
  }

  const width = numberFrom(dimensions?.[1], labeledWidth ?? defaults.width)
  const height = numberFrom(
    dimensions?.[2],
    labeledDepth ?? labeledHeight ?? defaults.height,
  )
  const thickness = numberFrom(dimensions?.[3], labeledThickness ?? defaults.thickness)

  const material = normalized.includes('steel')
    ? normalized.includes('stainless')
      ? '304 stainless steel'
      : 'mild steel'
    : normalized.includes('abs')
      ? 'ABS'
      : normalized.includes('nylon')
        ? 'Nylon 12'
        : normalized.includes('pla')
          ? 'PLA'
          : normalized.includes('aluminum') || normalized.includes('aluminium')
            ? '6061 aluminum'
            : defaults.material

  if (
    !['steel', 'stainless', 'abs', 'nylon', 'pla', 'aluminum', 'aluminium'].some((term) =>
      normalized.includes(term),
    )
  ) {
    assumptions.push('Material assumed to be 6061 aluminum.')
  }

  const holeCountMatch =
    normalized.match(/(\d+)\s+(?:mounting\s+)?holes?/) ??
    normalized.match(/holes?\s*[:=]?\s*(\d+)/)
  const holeDiameterMatch =
    normalized.match(/holes?[^,.]{0,30}?(\d+(?:\.\d+)?)\s*mm\s*(?:diameter|dia)/) ??
    normalized.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:diameter|dia)[^,.]{0,20}?holes?/)
  const edgeOffsetMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*mm\s+from\s+(?:each\s+)?(?:corner|edge)/,
  )
  const centerCutoutMatch =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*mm\s+(?:diameter\s+)?(?:center|central)\s+(?:hole|cutout)/,
    ) ??
    normalized.match(
      /(?:center|central)\s+(?:hole|cutout)[^,.]{0,18}?(\d+(?:\.\d+)?)\s*mm/,
    )
  const rectangularCutoutMatch =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*mm\s+rectangular(?:\s+center)?\s+cutout/,
    ) ??
    normalized.match(
      /rectangular(?:\s+center)?\s+cutout[^,.]{0,18}?(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*mm/,
    )
  const flangeMatch = normalized.match(/flange\s+(\d+(?:\.\d+)?)\s*mm(?:\s+high)?/)

  const kind = /l[\s-]?bracket|flange|bent bracket/.test(normalized)
    ? 'bracket'
    : /enclosure|panel/.test(normalized)
      ? 'panel'
      : 'plate'

  const explicitlyNoHoles = /\b(?:no holes?|without holes?|solid plate)\b/.test(normalized)
  const holeCount = explicitlyNoHoles
    ? 0
    : Math.round(numberFrom(holeCountMatch?.[1], defaults.holeCount))
  const holeDiameter = numberFrom(holeDiameterMatch?.[1], defaults.holeDiameter)
  const maxOffset = Math.max(2, Math.min(width, height) / 2 - holeDiameter)
  const edgeOffset = clamp(numberFrom(edgeOffsetMatch?.[1], defaults.edgeOffset), 2, maxOffset)
  const centerCutoutDiameter = rectangularCutoutMatch
    ? 0
    : numberFrom(centerCutoutMatch?.[1], defaults.centerCutoutDiameter)

  if (!holeCountMatch && !explicitlyNoHoles) {
    assumptions.push('Four mounting holes added for a stable fixture pattern.')
  }
  if (!holeDiameterMatch && !explicitlyNoHoles) {
    assumptions.push('Mounting-hole diameter assumed to be 3 mm.')
  }
  if (!edgeOffsetMatch && !explicitlyNoHoles) {
    assumptions.push('Hole centers offset 5 mm from the nearest edge.')
  }

  const params: PartParameters = {
    kind,
    width: clamp(width, 20, 250),
    height: clamp(height, 20, 180),
    thickness: clamp(thickness, 1, 20),
    holeCount: clamp(holeCount, 0, 12),
    holeDiameter: clamp(holeDiameter, 1, Math.min(width, height) / 3),
    edgeOffset,
    centerCutoutDiameter: clamp(centerCutoutDiameter, 0, Math.min(width, height) * 0.72),
    rectangularCutout: rectangularCutoutMatch
      ? {
          width: clamp(
            numberFrom(rectangularCutoutMatch[1], width * 0.5),
            4,
            width - edgeOffset * 2,
          ),
          height: clamp(
            numberFrom(rectangularCutoutMatch[2], height * 0.4),
            4,
            height - edgeOffset * 2,
          ),
        }
      : undefined,
    flangeHeight: clamp(numberFrom(flangeMatch?.[1], defaults.flangeHeight), 15, 100),
    material,
  }

  return { params, assumptions, usedDefaultEnvelope }
}

function getHolePositions(params: PartParameters): Array<[number, number]> {
  const x = params.width / 2 - params.edgeOffset
  const y = params.height / 2 - params.edgeOffset
  if (params.holeCount <= 0) return []
  if (params.holeCount === 1) return [[0, 0]]
  if (params.holeCount === 2) return [[-x, 0], [x, 0]]
  if (params.holeCount === 3) return [[-x, -y], [x, -y], [0, y]]
  if (params.holeCount === 4) return [[-x, -y], [x, -y], [x, y], [-x, y]]

  const topCount = Math.ceil(params.holeCount / 2)
  const bottomCount = Math.floor(params.holeCount / 2)
  const row = (count: number, yPos: number) =>
    Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0.5 : index / (count - 1)
      return [-x + progress * x * 2, yPos] as [number, number]
    })
  return [...row(topCount, y), ...row(bottomCount, -y)]
}

function makePlateShape(params: PartParameters, includeCenterCutout = true): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-params.width / 2, -params.height / 2)
  shape.lineTo(params.width / 2, -params.height / 2)
  shape.lineTo(params.width / 2, params.height / 2)
  shape.lineTo(-params.width / 2, params.height / 2)
  shape.closePath()

  getHolePositions(params).forEach(([x, y]) => {
    const hole = new THREE.Path()
    hole.absarc(x, y, params.holeDiameter / 2, 0, Math.PI * 2, false)
    shape.holes.push(hole)
  })

  if (includeCenterCutout && params.rectangularCutout) {
    const { width, height } = params.rectangularCutout
    const cutout = new THREE.Path()
    cutout.moveTo(-width / 2, -height / 2)
    cutout.lineTo(-width / 2, height / 2)
    cutout.lineTo(width / 2, height / 2)
    cutout.lineTo(width / 2, -height / 2)
    cutout.closePath()
    shape.holes.push(cutout)
  } else if (includeCenterCutout && params.centerCutoutDiameter > 0) {
    const center = new THREE.Path()
    center.absarc(0, 0, params.centerCutoutDiameter / 2, 0, Math.PI * 2, false)
    shape.holes.push(center)
  }

  return shape
}

function materialColor(material: string): string {
  if (material.includes('steel')) return '#8b969e'
  if (material === 'ABS') return '#dcd8cd'
  if (material.includes('Nylon')) return '#ece4ca'
  if (material === 'PLA') return '#f26946'
  return '#b7c1c7'
}

function addSolid(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: string,
  transform?: (mesh: THREE.Mesh) => void,
) {
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: color === '#dcd8cd' || color === '#ece4ca' ? 0.05 : 0.72,
    roughness: 0.31,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  transform?.(mesh)
  group.add(mesh)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 24),
    new THREE.LineBasicMaterial({ color: '#101716', transparent: true, opacity: 0.5 }),
  )
  edges.position.copy(mesh.position)
  edges.rotation.copy(mesh.rotation)
  edges.scale.copy(mesh.scale)
  group.add(edges)
}

export function createPartGroup(params: PartParameters): THREE.Group {
  const group = new THREE.Group()
  group.name = 'generated-part'
  const color = materialColor(params.material)
  const plateGeometry = new THREE.ExtrudeGeometry(makePlateShape(params), {
    depth: params.thickness,
    bevelEnabled: false,
    curveSegments: 40,
  })
  plateGeometry.translate(0, 0, -params.thickness / 2)
  addSolid(group, plateGeometry, color)

  if (params.kind === 'bracket') {
    const flangeParams: PartParameters = {
      ...params,
      height: params.flangeHeight,
      holeCount: Math.min(2, params.holeCount),
      centerCutoutDiameter: 0,
      rectangularCutout: undefined,
      edgeOffset: Math.min(params.edgeOffset, params.flangeHeight / 3),
    }
    const flangeShape = makePlateShape(flangeParams, false)
    const flangeGeometry = new THREE.ExtrudeGeometry(flangeShape, {
      depth: params.thickness,
      bevelEnabled: false,
      curveSegments: 40,
    })
    flangeGeometry.translate(0, params.flangeHeight / 2, 0)
    addSolid(group, flangeGeometry, color, (mesh) => {
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(0, params.height / 2, params.thickness / 2)
    })
  }
  return group
}

export function buildManufacturingSummary(params: PartParameters): ManufacturingSummary {
  const polymer = ['ABS', 'PLA', 'Nylon 12'].includes(params.material)
  const suggestedProcess = polymer
    ? '3D printing'
    : params.kind === 'bracket' && params.thickness <= 5
      ? 'sheet metal'
      : 'CNC machining'
  const notes: string[] = []
  const edgeLigament = params.edgeOffset - params.holeDiameter / 2

  if (edgeLigament < params.holeDiameter) {
    notes.push(
      `Hole-edge ligament is ${edgeLigament.toFixed(1)} mm; increase edge offset for a stronger mounting zone.`,
    )
  } else {
    notes.push(
      `${edgeLigament.toFixed(1)} mm minimum hole-edge ligament is suitable for this ${params.holeDiameter} mm hole pattern.`,
    )
  }

  if (
    params.centerCutoutDiameter > 0 &&
    params.centerCutoutDiameter > Math.min(params.width, params.height) * 0.55
  ) {
    notes.push('Center cutout leaves narrow side walls; verify stiffness under service load.')
  } else if (params.rectangularCutout) {
    notes.push(
      `${params.rectangularCutout.width} × ${params.rectangularCutout.height} mm cutout has sharp internal corners; add a 2 mm tool radius for CNC.`,
    )
  } else {
    notes.push('No thin-wall conflict detected between the center cutout and mounting pattern.')
  }

  if (params.kind === 'bracket') {
    notes.push(
      `Specify an inside bend radius near ${Math.max(params.thickness, 1).toFixed(0)} mm and confirm the ${params.flangeHeight} mm flange datum after forming.`,
    )
  }

  const area = params.width * params.height
  const complexity = params.holeCount + (params.centerCutoutDiameter > 0 ? 2 : 0)
  const low = Math.max(12, Math.round((area / 700 + complexity * 1.4) / 5) * 5)
  const high = Math.round((low * (suggestedProcess === 'CNC machining' ? 2.2 : 1.8)) / 5) * 5

  return {
    material: params.material,
    thicknessOrKeyDims: `${params.width} × ${params.height} × ${params.thickness} mm`,
    suggestedProcess,
    dfmNotes: notes,
    estimatedCostRangeUsd: `$${low}–${high}`,
    estimatedLeadTime: suggestedProcess === '3D printing' ? '2–4 business days' : '3–5 business days',
    disclaimer: 'Heuristic estimate, not a substitute for quote from a manufacturing partner.',
  }
}

export function buildCadQueryScript(params: PartParameters, assumptions: string[]): string {
  const lines = [
    'import cadquery as cq',
    '',
    ...assumptions.map((assumption) => `# Assumption: ${assumption}`),
    `width = ${params.width}`,
    `height = ${params.height}`,
    `thickness = ${params.thickness}`,
    `hole_diameter = ${params.holeDiameter}`,
    `edge_offset = ${params.edgeOffset}`,
    '',
    'result = cq.Workplane("XY").box(width, height, thickness)',
  ]

  const holes = getHolePositions(params)
  if (holes.length) {
    const points = holes.map(([x, y]) => `(${x.toFixed(3)}, ${y.toFixed(3)})`).join(', ')
    lines.push(`result = result.faces(">Z").workplane().pushPoints([${points}]).hole(hole_diameter)`)
  }
  if (params.centerCutoutDiameter > 0) {
    lines.push(
      `result = result.faces(">Z").workplane().circle(${params.centerCutoutDiameter / 2}).cutThruAll()`,
    )
  }
  if (params.rectangularCutout) {
    lines.push(
      `result = result.faces(">Z").workplane().rect(${params.rectangularCutout.width}, ${params.rectangularCutout.height}).cutThruAll()`,
    )
  }
  if (params.kind === 'bracket') {
    lines.push(
      '',
      `flange = cq.Workplane("XZ").box(width, thickness, ${params.flangeHeight}).translate((0, height / 2 - thickness / 2, ${params.flangeHeight / 2}))`,
      'result = result.union(flange)',
    )
  }
  lines.push(
    '',
    'cq.exporters.export(result, "part.step")',
    'cq.exporters.export(result, "part.stl")',
  )
  return lines.join('\n')
}

export function generatePart(spec: string): GeneratedPart {
  const parsed = parseSpecification(spec)
  return {
    ...parsed,
    script: buildCadQueryScript(parsed.params, parsed.assumptions),
    summary: buildManufacturingSummary(parsed.params),
  }
}
