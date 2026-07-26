import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  AlertTriangle,
  Box,
  Braces,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileCode2,
  Github,
  LoaderCircle,
  Move3D,
  PackageCheck,
  Ruler,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import {
  buildCadQueryScript,
  buildManufacturingSummary,
  createPartGroup,
  generatePart,
  parseSpecification,
  presets,
} from './cad'
import { PartViewer } from './components/PartViewer'
import { exportStep } from './step-export'
import type { GeneratedPart, PartParameters } from './types'

const wait = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration))

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 38) || 'generated-part'

const saveBlob = (contents: BlobPart, filename: string, type: string) => {
  const blob = new Blob([contents], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1200)
}

interface DimensionControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

function DimensionControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: DimensionControlProps) {
  return (
    <label className="dimension-control">
      <span>{label}</span>
      <strong>
        {value}
        <small>mm</small>
      </strong>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function App() {
  const [spec, setSpec] = useState(presets[0].spec)
  const [activePreset, setActivePreset] = useState(presets[0].id)
  const [generated, setGenerated] = useState<GeneratedPart>(() => generatePart(presets[0].spec))
  const [generating, setGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [codeOpen, setCodeOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inputError, setInputError] = useState('')

  const generationStages = ['Parse constraints', 'Build solid', 'Run DFM checks']
  const draftParse = useMemo(() => parseSpecification(spec), [spec])
  const partName = useMemo(
    () => `${generated.params.kind}-${generated.params.width}x${generated.params.height}`,
    [generated.params],
  )

  const runGeneration = async () => {
    if (!spec.trim() || generating) return
    if (draftParse.usedDefaultEnvelope) {
      setInputError(
        'Add an envelope such as “120 × 80 × 2 mm” or “width 120 mm, depth 80 mm, thickness 2 mm.”',
      )
      return
    }
    setInputError('')
    setGenerating(true)
    setGenerationStep(0)
    await wait(360)
    setGenerationStep(1)
    await wait(460)
    setGenerationStep(2)
    await wait(430)
    setGenerated(generatePart(spec))
    await wait(260)
    setGenerating(false)
  }

  const selectPreset = (id: string) => {
    const preset = presets.find((item) => item.id === id)
    if (!preset) return
    setSpec(preset.spec)
    setActivePreset(id)
    setInputError('')
    setGenerated(generatePart(preset.spec))
  }

  const updateParameter = (key: keyof PartParameters, value: number) => {
    setGenerated((current) => {
      const params = { ...current.params, [key]: value }
      return {
        ...current,
        params,
        summary: buildManufacturingSummary(params),
        script: buildCadQueryScript(params, current.assumptions),
      }
    })
  }

  const downloadStl = () => {
    const group = createPartGroup(generated.params)
    const exporter = new STLExporter()
    const data = exporter.parse(group, { binary: true })
    saveBlob(data, `${slugify(partName)}.stl`, 'model/stl')
  }

  const downloadStep = () => {
    const group = createPartGroup(generated.params)
    const data = exportStep(group, partName)
    saveBlob(data, `${slugify(partName)}.step`, 'application/step')
  }

  const downloadScript = () => {
    saveBlob(generated.script, `${slugify(partName)}.py`, 'text/x-python')
  }

  const copyScript = async () => {
    await navigator.clipboard.writeText(generated.script)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Spec to Part home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            SPEC<span>/</span>PART
          </span>
        </a>
        <nav>
          <a href="#workspace">Workspace</a>
          <a href="#readiness">Manufacturing</a>
          <a href="#method">Method</a>
        </nav>
        <div className="header-meta">
          <span>FOR GARRY TRAN</span>
          <a
            className="github-link"
            href="https://github.com/krishnatheaverage/spec-to-part"
            target="_blank"
            rel="noreferrer"
            aria-label="View project on GitHub"
          >
            <Github size={17} />
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-kicker">
            <span>AI-NATIVE CAD PIPELINE</span>
            <i />
            <span>V0.1 / BROWSER KERNEL</span>
          </div>
          <h1>
            Describe the part.
            <br />
            <span>Leave with the files.</span>
          </h1>
          <div className="hero-bottom">
            <p>
              Plain English in. Parametric geometry, production files, and a quote-ready
              manufacturing brief out.
            </p>
            <a href="#workspace" className="hero-jump">
              START BUILDING <ArrowDown size={16} />
            </a>
          </div>
        </section>

        <section className="proof-strip" aria-label="Product capabilities">
          <span><ShieldCheck size={15} /> LOCAL-FIRST</span>
          <span><Move3D size={15} /> REAL 3D GEOMETRY</span>
          <span><PackageCheck size={15} /> STEP + STL</span>
          <span><Ruler size={15} /> MILLIMETER NATIVE</span>
        </section>

        <section className="workspace" id="workspace">
          <aside className="spec-panel">
            <div className="section-label">
              <span>01</span>
              SPECIFICATION
            </div>
            <div className="spec-heading">
              <h2>What should we make?</h2>
              <span className="engine-status"><i /> KERNEL READY</span>
            </div>

            <div className="presets">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={activePreset === preset.id ? 'active' : ''}
                  onClick={() => selectPreset(preset.id)}
                >
                  <small>{preset.eyebrow}</small>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <label className="spec-input">
              <span>PART BRIEF</span>
              <textarea
                value={spec}
                onChange={(event) => {
                  setSpec(event.target.value)
                  setActivePreset('')
                  setInputError('')
                }}
                aria-invalid={Boolean(inputError)}
                spellCheck={false}
              />
              <small>{spec.length} CHAR / SIMPLE PARTS ONLY</small>
            </label>

            <div
              className={`parse-feedback ${
                inputError || draftParse.usedDefaultEnvelope ? 'needs-input' : 'ready'
              }`}
            >
              {inputError || draftParse.usedDefaultEnvelope ? (
                <AlertTriangle size={15} />
              ) : (
                <CheckCircle2 size={15} />
              )}
              <div>
                <strong>
                  {inputError || draftParse.usedDefaultEnvelope
                    ? 'DIMENSIONS REQUIRED'
                    : 'ENVELOPE RECOGNIZED'}
                </strong>
                <span>
                  {inputError ||
                    (draftParse.usedDefaultEnvelope
                      ? 'Use width × depth × thickness, in millimeters.'
                      : `${draftParse.params.width} W × ${draftParse.params.height} D × ${draftParse.params.thickness} T mm`)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="generate-button"
              onClick={runGeneration}
              disabled={generating || !spec.trim()}
            >
              {generating ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <WandSparkles size={18} />
              )}
              <span>{generating ? generationStages[generationStep] : 'Generate production model'}</span>
              {!generating && <ArrowUpRight size={18} />}
            </button>

            <div className="generation-pipeline">
              {generationStages.map((stage, index) => (
                <div
                  key={stage}
                  className={
                    generating && generationStep === index
                      ? 'active'
                      : !generating || generationStep > index
                        ? 'complete'
                        : ''
                  }
                >
                  <span>{!generating || generationStep > index ? <Check size={12} /> : index + 1}</span>
                  {stage}
                </div>
              ))}
            </div>

            {generated.assumptions.length > 0 && (
              <div className="assumptions">
                <Sparkles size={15} />
                <div>
                  <strong>{generated.assumptions.length} parser notes</strong>
                  <p>{generated.assumptions[0]}</p>
                </div>
              </div>
            )}
          </aside>

          <div className="model-panel">
            <div className="section-label light">
              <span>02</span>
              PARAMETRIC MODEL
            </div>
            <PartViewer params={generated.params} generating={generating} />
            <div className="parameter-dock">
              <div className="dock-title">
                <Braces size={16} />
                <span>LIVE PARAMETERS</span>
              </div>
              <DimensionControl
                label="WIDTH"
                value={generated.params.width}
                min={20}
                max={200}
                onChange={(value) => updateParameter('width', value)}
              />
              <DimensionControl
                label="DEPTH"
                value={generated.params.height}
                min={20}
                max={150}
                onChange={(value) => updateParameter('height', value)}
              />
              <DimensionControl
                label="THICKNESS"
                value={generated.params.thickness}
                min={1}
                max={12}
                step={0.5}
                onChange={(value) => updateParameter('thickness', value)}
              />
            </div>
          </div>
        </section>

        <section className="deliverables">
          <div>
            <div className="section-label">
              <span>03</span>
              PRODUCTION OUTPUT
            </div>
            <h2>Not a rendering. A handoff.</h2>
          </div>
          <div className="file-actions">
            <button type="button" onClick={downloadStep}>
              <FileCode2 size={22} />
              <span>
                <small>CAD EXCHANGE</small>
                STEP
              </span>
              <Download size={17} />
            </button>
            <button type="button" onClick={downloadStl}>
              <Box size={22} />
              <span>
                <small>MANUFACTURING MESH</small>
                STL
              </span>
              <Download size={17} />
            </button>
            <button type="button" onClick={downloadScript}>
              <Braces size={22} />
              <span>
                <small>PARAMETRIC SOURCE</small>
                CADQUERY
              </span>
              <Download size={17} />
            </button>
          </div>
        </section>

        <section className="readiness" id="readiness">
          <div className="readiness-heading">
            <div>
              <div className="section-label light">
                <span>04</span>
                MANUFACTURING READINESS
              </div>
              <h2>Quote-ready context,<br />attached to the geometry.</h2>
            </div>
            <div className="readiness-score">
              <div className="score-ring">
                <strong>92</strong>
                <span>/ 100</span>
              </div>
              <div>
                <strong>READY TO QUOTE</strong>
                <span>2 checks passed · 1 advisory</span>
              </div>
            </div>
          </div>

          <div className="readiness-grid">
            <article className="summary-card material-card">
              <small>MATERIAL / PROCESS</small>
              <h3>{generated.summary.material}</h3>
              <span>{generated.summary.suggestedProcess}</span>
              <dl>
                <div>
                  <dt>ENVELOPE</dt>
                  <dd>{generated.summary.thicknessOrKeyDims}</dd>
                </div>
                <div>
                  <dt>UNITS</dt>
                  <dd>Millimeters</dd>
                </div>
              </dl>
            </article>

            <article className="summary-card dfm-card">
              <small>DFM ANALYSIS</small>
              <div className="dfm-list">
                {generated.summary.dfmNotes.map((note, index) => (
                  <div key={note}>
                    {index === generated.summary.dfmNotes.length - 1 &&
                    generated.params.kind === 'bracket' ? (
                      <Sparkles size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    <p>{note}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="summary-card quote-card">
              <small>ROUGH ORDER ESTIMATE</small>
              <div>
                <span>COST / UNIT</span>
                <strong>{generated.summary.estimatedCostRangeUsd}</strong>
              </div>
              <div>
                <span>LEAD TIME</span>
                <strong>{generated.summary.estimatedLeadTime}</strong>
              </div>
              <p>{generated.summary.disclaimer}</p>
            </article>
          </div>
        </section>

        <section className={`code-section ${codeOpen ? 'open' : ''}`}>
          <button type="button" className="code-toggle" onClick={() => setCodeOpen((open) => !open)}>
            <div>
              <span className="code-icon"><Braces size={18} /></span>
              <span>
                <small>PARAMETRIC PROVENANCE</small>
                View generated CadQuery source
              </span>
            </div>
            <span>{codeOpen ? 'HIDE' : 'INSPECT'} <ArrowUpRight size={15} /></span>
          </button>
          {codeOpen && (
            <div className="code-body">
              <div className="code-topbar">
                <span>generated_part.py</span>
                <button type="button" onClick={copyScript}>
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <pre><code>{generated.script}</code></pre>
            </div>
          )}
        </section>

        <section className="method" id="method">
          <div className="section-label">
            <span>05</span>
            THE SERVICE
          </div>
          <div className="method-grid">
            <h2>This isn’t a CAD copilot.<br /><span>It’s the whole service.</span></h2>
            <div className="method-steps">
              <div><strong>01</strong><p>Describe a bounded mechanical part in ordinary language.</p></div>
              <div><strong>02</strong><p>The browser kernel resolves dimensions into deterministic geometry.</p></div>
              <div><strong>03</strong><p>Download the model and bring manufacturing context with it.</p></div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>SPEC<span>/</span>PART</span>
        </a>
        <p>FROM SPECIFICATION TO MANUFACTURABLE GEOMETRY.</p>
        <span>PROTOTYPE / 2026</span>
      </footer>
    </div>
  )
}

export default App
