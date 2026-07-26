import * as THREE from 'three'

class StepWriter {
  private entities: string[] = []

  add(body: string) {
    this.entities.push(body)
    return this.entities.length
  }

  ref(id: number) {
    return `#${id}`
  }

  serialize() {
    return this.entities.map((entity, index) => `#${index + 1}=${entity};`).join('\n')
  }
}

const safeName = (name: string) => name.replaceAll("'", '')
const number = (value: number) => {
  const rounded = Math.abs(value) < 1e-8 ? 0 : value
  return Number.isInteger(rounded) ? `${rounded}.` : rounded.toFixed(6).replace(/0+$/, '')
}

export function exportStep(group: THREE.Group, partName: string): string {
  const writer = new StepWriter()
  const appContext = writer.add(
    "APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies')",
  )
  writer.add(
    `APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,${writer.ref(appContext)})`,
  )
  const productContext = writer.add(
    `PRODUCT_CONTEXT('',${writer.ref(appContext)},'mechanical')`,
  )
  const product = writer.add(
    `PRODUCT('${safeName(partName)}','${safeName(partName)}','',(${writer.ref(productContext)}))`,
  )
  const formation = writer.add(
    `PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('1','',${writer.ref(product)},.NOT_KNOWN.)`,
  )
  const definitionContext = writer.add(
    `PRODUCT_DEFINITION_CONTEXT('part definition',${writer.ref(appContext)},'design')`,
  )
  const definition = writer.add(
    `PRODUCT_DEFINITION('design','',${writer.ref(formation)},${writer.ref(definitionContext)})`,
  )
  const definitionShape = writer.add(
    `PRODUCT_DEFINITION_SHAPE('','',${writer.ref(definition)})`,
  )

  group.updateMatrixWorld(true)
  const breps: number[] = []

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const geometry = object.geometry as THREE.BufferGeometry
    const position = geometry.getAttribute('position')
    if (!position) return
    const index = geometry.getIndex()
    const pointMap = new Map<string, number>()
    const faces: number[] = []

    const vectorAt = (vertexIndex: number) =>
      new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(object.matrixWorld)

    const pointFor = (point: THREE.Vector3) => {
      const key = `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`
      const cached = pointMap.get(key)
      if (cached) return cached
      const entity = writer.add(
        `CARTESIAN_POINT('',(${number(point.x)},${number(point.y)},${number(point.z)}))`,
      )
      pointMap.set(key, entity)
      return entity
    }

    const triangleCount = index ? index.count / 3 : position.count / 3
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const a = index ? index.getX(triangle * 3) : triangle * 3
      const b = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1
      const c = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2
      const vertices = [vectorAt(a), vectorAt(b), vectorAt(c)]
      const edgeA = new THREE.Vector3().subVectors(vertices[1], vertices[0])
      const edgeB = new THREE.Vector3().subVectors(vertices[2], vertices[0])
      const normalVector = new THREE.Vector3().crossVectors(edgeA, edgeB)
      if (normalVector.lengthSq() < 1e-12 || edgeA.lengthSq() < 1e-12) continue
      normalVector.normalize()
      edgeA.normalize()

      const pointRefs = vertices.map(pointFor)
      if (new Set(pointRefs).size < 3) continue
      const loop = writer.add(`POLY_LOOP('',(${pointRefs.map((id) => writer.ref(id)).join(',')}))`)
      const bound = writer.add(`FACE_OUTER_BOUND('',${writer.ref(loop)},.T.)`)
      const normal = writer.add(
        `DIRECTION('',(${number(normalVector.x)},${number(normalVector.y)},${number(normalVector.z)}))`,
      )
      const reference = writer.add(
        `DIRECTION('',(${number(edgeA.x)},${number(edgeA.y)},${number(edgeA.z)}))`,
      )
      const placement = writer.add(
        `AXIS2_PLACEMENT_3D('',${writer.ref(pointRefs[0])},${writer.ref(normal)},${writer.ref(reference)})`,
      )
      const plane = writer.add(`PLANE('',${writer.ref(placement)})`)
      faces.push(
        writer.add(`FACE_SURFACE('',(${writer.ref(bound)}),${writer.ref(plane)},.T.)`),
      )
    }

    if (faces.length) {
      const shell = writer.add(`CLOSED_SHELL('',(${faces.map((id) => writer.ref(id)).join(',')}))`)
      breps.push(writer.add(`FACETED_BREP('${safeName(partName)}',${writer.ref(shell)})`))
    }
  })

  const lengthUnit = writer.add(
    '(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))',
  )
  const angleUnit = writer.add(
    '(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))',
  )
  const solidAngleUnit = writer.add(
    '(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())',
  )
  const uncertainty = writer.add(
    `UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-6),${writer.ref(lengthUnit)},'distance_accuracy_value','confusion accuracy')`,
  )
  const representationContext = writer.add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${writer.ref(uncertainty)})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${writer.ref(lengthUnit)},${writer.ref(angleUnit)},${writer.ref(solidAngleUnit)})) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'))`,
  )
  const representation = writer.add(
    `FACETED_BREP_SHAPE_REPRESENTATION('${safeName(partName)}',(${breps.map((id) => writer.ref(id)).join(',')}),${writer.ref(representationContext)})`,
  )
  writer.add(
    `SHAPE_DEFINITION_REPRESENTATION(${writer.ref(definitionShape)},${writer.ref(representation)})`,
  )

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '')
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('Faceted BREP generated by Spec to Part'),'2;1');",
    `FILE_NAME('${safeName(partName)}.step','${timestamp}',('Spec to Part'),('Spec to Part'),'Spec to Part browser CAD','Spec to Part','');`,
    "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));",
    'ENDSEC;',
    'DATA;',
    writer.serialize(),
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n')
}
