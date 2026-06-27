import { useEffect, useMemo, useState } from 'react'
import { LEARNING_MODULES } from '@shared/learning-modules'
import { learningModuleCount } from '@shared/learning-search'
import type { LearningModule, LearningSection } from '@shared/learning-types'
import { LearningCode } from '../components/LearningCode'
import { LearningFundamentals } from '../components/LearningFundamentals'
import { LearningHome } from '../components/LearningHome'
import { PageHeader } from '../components/PageHeader'

const STORAGE_KEY = 'berrybridge-learning-module'

type LearningView = 'home' | 'module'

function readStoredView(): LearningView {
  try {
    const id = localStorage.getItem(STORAGE_KEY)
    if (id === 'home' || !id) return 'home'
    if (LEARNING_MODULES.some((m) => m.id === id)) return 'module'
  } catch {
    /* ignore */
  }
  return 'home'
}

function readStoredModuleId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY)
    if (id && id !== 'home' && LEARNING_MODULES.some((m) => m.id === id)) return id
  } catch {
    /* ignore */
  }
  return LEARNING_MODULES[0].id
}

function SectionView({ section }: { section: LearningSection }) {
  const blocks = section.code
    ? Array.isArray(section.code)
      ? section.code
      : [section.code]
    : []

  return (
    <div className="learn-section">
      <h4 className="learn-section-heading">{section.heading}</h4>
      {section.body && <p className="panel-desc">{section.body}</p>}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="bb-req-list">
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {blocks.map((block, i) => (
        <LearningCode key={`${section.heading}-${i}`} block={block} />
      ))}
      {section.tip && <p className="learn-tip">{section.tip}</p>}
    </div>
  )
}

function ModuleContent({ module, initialLessonId }: { module: LearningModule; initialLessonId?: string }) {
  if (module.fundamentals?.length) {
    return (
      <LearningFundamentals
        module={module}
        initialLessonId={initialLessonId}
        introSections={
          <>
            {module.sections.map((section) => (
              <SectionView key={section.heading} section={section} />
            ))}
          </>
        }
      />
    )
  }

  return (
    <>
      {module.sections.map((section) => (
        <SectionView key={section.heading} section={section} />
      ))}
    </>
  )
}

function LearningModuleNav({
  view,
  activeModuleId,
  onHome,
  onOpenModule
}: {
  view: LearningView
  activeModuleId: string
  onHome: () => void
  onOpenModule: (id: string) => void
}) {
  return (
    <nav className="learn-module-nav" aria-label="Learning modules">
      <button
        type="button"
        className={`learn-module-btn learn-module-home ${view === 'home' ? 'active' : ''}`}
        onClick={onHome}
      >
        <span className="learn-module-num">⌂</span>
        <span className="learn-module-text">
          <strong>Home</strong>
          <span>Search &amp; browse</span>
        </span>
      </button>
      {LEARNING_MODULES.map((mod) => (
        <button
          key={mod.id}
          type="button"
          className={`learn-module-btn ${view === 'module' && mod.id === activeModuleId ? 'active' : ''}`}
          onClick={() => onOpenModule(mod.id)}
        >
          <span className="learn-module-num">{mod.number}</span>
          <span className="learn-module-text">
            <strong>{mod.title}</strong>
            <span>{mod.subtitle}</span>
          </span>
        </button>
      ))}
    </nav>
  )
}

export function LearningPage() {
  const [view, setView] = useState<LearningView>(() => readStoredView())
  const [moduleId, setModuleId] = useState(readStoredModuleId)
  const [initialLessonId, setInitialLessonId] = useState<string | undefined>()

  const active = useMemo(
    () => LEARNING_MODULES.find((m) => m.id === moduleId) ?? LEARNING_MODULES[0],
    [moduleId]
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view === 'home' ? 'home' : moduleId)
    } catch {
      /* ignore */
    }
  }, [view, moduleId])

  const openModule = (id: string, lessonId?: string) => {
    setModuleId(id)
    setInitialLessonId(lessonId)
    setView('module')
  }

  const goHome = () => {
    setView('home')
    setInitialLessonId(undefined)
  }

  return (
    <>
      <PageHeader
        title="Learning"
        subtitle={
          view === 'home'
            ? 'Hands-on modules for terminals, shell, SSH, code, and infrastructure — tuned for BerryCore on BB10.'
            : active.subtitle
        }
        meta={
          view === 'home'
            ? `${learningModuleCount()} modules`
            : `Module ${active.number} of ${learningModuleCount()}`
        }
      />

      <div className="learn-layout">
        <LearningModuleNav
          view={view}
          activeModuleId={moduleId}
          onHome={goHome}
          onOpenModule={(id) => openModule(id)}
        />

        {view === 'home' ? (
          <article className="learn-content learn-content-home">
            <div className="learn-content-body">
              <LearningHome onOpenModule={openModule} />
            </div>
          </article>
        ) : (
          <article className="learn-content">
            <header className="learn-content-head">
              <span className="learn-content-num">Module {active.number}</span>
              <h3>{active.title}</h3>
              <p>{active.subtitle}</p>
            </header>

            <div className="learn-content-body">
              <ModuleContent module={active} initialLessonId={initialLessonId} />
            </div>
          </article>
        )}
      </div>
    </>
  )
}
