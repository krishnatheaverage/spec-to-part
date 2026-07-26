export type PartKind = 'plate' | 'panel' | 'bracket'

export interface RectangularCutout {
  width: number
  height: number
}

export interface PartParameters {
  kind: PartKind
  width: number
  height: number
  thickness: number
  holeCount: number
  holeDiameter: number
  edgeOffset: number
  centerCutoutDiameter: number
  rectangularCutout?: RectangularCutout
  flangeHeight: number
  material: string
}

export interface ManufacturingSummary {
  material: string
  thicknessOrKeyDims: string
  suggestedProcess: 'CNC machining' | 'sheet metal' | '3D printing'
  dfmNotes: string[]
  estimatedCostRangeUsd: string
  estimatedLeadTime: string
  disclaimer: string
}

export interface GeneratedPart {
  params: PartParameters
  assumptions: string[]
  script: string
  summary: ManufacturingSummary
}

export interface Preset {
  id: string
  label: string
  eyebrow: string
  spec: string
}
