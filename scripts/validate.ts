import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import * as THREE from 'three'
import { createPartGroup, generatePart, parseSpecification, presets } from '../src/cad'
import { exportStep } from '../src/step-export'

const generated = presets.map((preset) => generatePart(preset.spec))

assert.deepEqual(
  generated.map((part) => [part.params.width, part.params.height, part.params.thickness]),
  [
    [80, 40, 3],
    [120, 80, 2],
    [70, 50, 4],
  ],
)
assert.deepEqual(
  generated.map((part) => part.params.kind),
  ['plate', 'panel', 'bracket'],
)
assert.equal(generated[0].params.holeCount, 4)
assert.equal(generated[0].params.holeDiameter, 3)
assert.equal(generated[0].params.centerCutoutDiameter, 10)
assert.deepEqual(generated[1].params.rectangularCutout, { width: 60, height: 28 })
assert.equal(generated[2].params.flangeHeight, 36)
assert.ok(generated.every((part) => !part.usedDefaultEnvelope))

const labeled = parseSpecification(
  'Steel plate, width 95mm, depth 55mm, thickness 6mm, no holes.',
)
assert.deepEqual(
  [labeled.params.width, labeled.params.height, labeled.params.thickness],
  [95, 55, 6],
)
assert.equal(labeled.params.holeCount, 0)
assert.equal(labeled.usedDefaultEnvelope, false)

const adjectiveDimensions = parseSpecification(
  'Bracket that is 100mm wide, 60mm deep and 5mm thick with 2 holes 8mm diameter.',
)
assert.deepEqual(
  [
    adjectiveDimensions.params.width,
    adjectiveDimensions.params.height,
    adjectiveDimensions.params.thickness,
  ],
  [100, 60, 5],
)
assert.equal(adjectiveDimensions.params.holeCount, 2)

const incomplete = parseSpecification('Make a steel mounting plate with some holes.')
assert.equal(incomplete.usedDefaultEnvelope, true)

const implicitMillimeters = parseSpecification(
  'Plate with width: 140, depth: 65, thickness: 4 and no holes.',
)
assert.deepEqual(
  [
    implicitMillimeters.params.width,
    implicitMillimeters.params.height,
    implicitMillimeters.params.thickness,
  ],
  [140, 65, 4],
)
assert.equal(implicitMillimeters.usedDefaultEnvelope, false)

for (const part of generated) {
  const group = createPartGroup(part.params)
  const meshCount = group.children.filter((child) => child instanceof THREE.Mesh).length
  assert.ok(meshCount >= 1, 'Every preset must emit at least one solid mesh.')
  assert.ok(part.script.includes('result ='), 'CadQuery output must assign the result variable.')
  assert.ok(part.summary.dfmNotes.length >= 2, 'Every part must receive dimension-specific DFM notes.')
}

const sampleGroup = createPartGroup(generated[0].params)
const step = exportStep(sampleGroup, 'validation-mounting-plate')
assert.ok(step.startsWith('ISO-10303-21;'))
assert.ok(step.includes('FACETED_BREP'))
assert.ok(step.includes('SHAPE_DEFINITION_REPRESENTATION'))
assert.ok(step.endsWith('END-ISO-10303-21;\n'))

const output = '/tmp/spec-to-part-validation.step'
writeFileSync(output, step)
console.log(`Validated ${generated.length} presets. STEP sample: ${output} (${step.length} bytes)`)
