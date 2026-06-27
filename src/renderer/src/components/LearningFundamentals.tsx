import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  PROG_LANG_LABELS,
  PROG_LANGS,
  type FundamentalsTopic,
  type LearningModule,
  type ProgLang
} from '@shared/learning-types'
import { LearningCode } from './LearningCode'
import { Panel } from './Panel'

const LANG_STORAGE_KEY = 'berrybridge-learning-lang'
const TOPIC_STORAGE_KEY = 'berrybridge-learning-fundamentals-topic'
const VIEW_STORAGE_KEY = 'berrybridge-learning-fundamentals-view'

type ViewMode = 'compare' | ProgLang

function readStoredView(): ViewMode {
  try {
    const view = localStorage.getItem(VIEW_STORAGE_KEY)
    if (view === 'compare' || view === 'bash' || view === 'python' || view === 'node') return view
  } catch {
    /* ignore */
  }
  return 'python'
}

function CompareTable({ topic }: { topic: FundamentalsTopic }) {
  return (
    <div className="learn-compare-wrap">
      <table className="learn-compare-table">
        <thead>
          <tr>
            <th>Concept</th>
            <th>Python</th>
            <th>Bash</th>
            <th>Node.js</th>
          </tr>
        </thead>
        <tbody>
          {topic.compare.map((row) => (
            <tr key={row.idea}>
              <th scope="row">{row.idea}</th>
              <td>
                <code>{row.python}</code>
              </td>
              <td>
                <code>{row.bash}</code>
              </td>
              <td>
                <code>{row.node}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LangGuideCard({ lang, topic }: { lang: ProgLang; topic: FundamentalsTopic }) {
  const guide = topic.langGuide[lang]
  return (
    <div className="learn-lang-card">
      <h5>{PROG_LANG_LABELS[lang]}</h5>
      <p className="learn-lang-syntax">
        <code>{guide.syntax}</code>
      </p>
      <ul className="bb-req-list">
        {guide.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  )
}

function WalkthroughBlock({
  topic,
  view
}: {
  topic: FundamentalsTopic
  view: ViewMode
}) {
  if (view === 'compare') {
    return (
      <div className="learn-walk-compare">
        {PROG_LANGS.map((lang) => (
          <div key={lang} className="learn-walk-col">
            <h5 className="learn-walk-col-head">{PROG_LANG_LABELS[lang]}</h5>
            {topic.walkthrough[lang].map((example) => (
              <div key={example.title} className="learn-walk-example">
                <h6>{example.title}</h6>
                {example.description && <p className="panel-desc">{example.description}</p>}
                <LearningCode block={example.code} />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="learn-walk-single">
      {topic.walkthrough[view].map((example) => (
        <div key={example.title} className="learn-walk-example">
          <h6>{example.title}</h6>
          {example.description && <p className="panel-desc">{example.description}</p>}
          <LearningCode block={example.code} />
        </div>
      ))}
    </div>
  )
}

function ExerciseBlock({ topic, view }: { topic: FundamentalsTopic; view: ViewMode }) {
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)

  useEffect(() => {
    setShowHint(false)
    setShowSolution(false)
  }, [topic.id])

  const solution =
    view === 'compare'
      ? topic.exercise.solution
      : topic.exercise.solution
        ? { [view]: topic.exercise.solution[view] }
        : undefined

  return (
    <Panel className="learn-exercise-panel">
      <h4 className="learn-section-heading">Try it</h4>
      <p className="panel-desc">{topic.exercise.prompt}</p>
      <div className="btn-row">
        {topic.exercise.hint && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowHint((v) => !v)}>
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
        )}
        {topic.exercise.solution && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSolution((v) => !v)}
          >
            {showSolution ? 'Hide solution' : 'Show solution'}
          </button>
        )}
      </div>
      {showHint && topic.exercise.hint && <p className="learn-tip">{topic.exercise.hint}</p>}
      {showSolution && solution && (
        <div className="learn-solution">
          {view === 'compare'
            ? PROG_LANGS.map(
                (lang) =>
                  topic.exercise.solution?.[lang] && (
                    <div key={lang}>
                      <h6>{PROG_LANG_LABELS[lang]}</h6>
                      <LearningCode block={topic.exercise.solution[lang]!} />
                    </div>
                  )
              )
            : topic.exercise.solution?.[view] && (
                <LearningCode block={topic.exercise.solution[view]!} />
              )}
        </div>
      )}
    </Panel>
  )
}

function TopicLesson({
  topic,
  view,
  onPrev,
  onNext,
  hasPrev,
  hasNext
}: {
  topic: FundamentalsTopic
  view: ViewMode
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  return (
    <article className="learn-fund-lesson">
      <header className="learn-fund-lesson-head">
        <span className="learn-fund-lesson-num">Lesson {topic.number}</span>
        <h4>{topic.title}</h4>
        <p>{topic.summary}</p>
      </header>

      <section className="learn-fund-section">
        <h5>Why it matters</h5>
        <p className="panel-desc">{topic.why}</p>
      </section>

      <section className="learn-fund-section">
        <h5>Key concepts</h5>
        <ul className="bb-req-list">
          {topic.concepts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="learn-fund-section">
        <h5>Syntax at a glance</h5>
        <CompareTable topic={topic} />
      </section>

      {view !== 'compare' ? (
        <section className="learn-fund-section">
          <h5>{PROG_LANG_LABELS[view]} notes</h5>
          <LangGuideCard lang={view} topic={topic} />
        </section>
      ) : (
        <section className="learn-fund-section">
          <h5>Language notes</h5>
          <div className="learn-lang-grid">
            {PROG_LANGS.map((lang) => (
              <LangGuideCard key={lang} lang={lang} topic={topic} />
            ))}
          </div>
        </section>
      )}

      <section className="learn-fund-section">
        <h5>Walkthrough</h5>
        <WalkthroughBlock topic={topic} view={view} />
      </section>

      <ExerciseBlock topic={topic} view={view} />

      <footer className="learn-fund-nav-footer">
        <button type="button" className="btn btn-secondary" disabled={!hasPrev} onClick={onPrev}>
          ← Previous
        </button>
        <button type="button" className="btn btn-primary" disabled={!hasNext} onClick={onNext}>
          Next →
        </button>
      </footer>
    </article>
  )
}

interface Props {
  module: LearningModule
  introSections: ReactNode
  initialLessonId?: string
}

export function LearningFundamentals({ module, introSections, initialLessonId }: Props) {
  const topics = module.fundamentals ?? []
  const [view, setView] = useState<ViewMode>(() => readStoredView())
  const [topicId, setTopicId] = useState(() => {
    if (initialLessonId && topics.some((t) => t.id === initialLessonId)) return initialLessonId
    try {
      const stored = localStorage.getItem(TOPIC_STORAGE_KEY)
      if (stored && topics.some((t) => t.id === stored)) return stored
    } catch {
      /* ignore */
    }
    return topics[0]?.id ?? ''
  })

  const topicIndex = topics.findIndex((t) => t.id === topicId)
  const topic = topics[topicIndex] ?? topics[0]

  useEffect(() => {
    if (initialLessonId && topics.some((t) => t.id === initialLessonId)) {
      setTopicId(initialLessonId)
    }
  }, [initialLessonId, topics])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view)
      if (view !== 'compare') localStorage.setItem(LANG_STORAGE_KEY, view)
    } catch {
      /* ignore */
    }
  }, [view])

  useEffect(() => {
    if (topicId) {
      try {
        localStorage.setItem(TOPIC_STORAGE_KEY, topicId)
      } catch {
        /* ignore */
      }
    }
  }, [topicId])

  const goPrev = () => {
    if (topicIndex > 0) setTopicId(topics[topicIndex - 1].id)
  }

  const goNext = () => {
    if (topicIndex < topics.length - 1) setTopicId(topics[topicIndex + 1].id)
  }

  return (
    <div className="learn-fundamentals">
      {introSections}

      <div className="learn-fund-layout">
        <div className="learn-fund-main">
          <div className="learn-view-bar">
            <span className="learn-view-label">Language</span>
            <div className="learn-lang-toggle" role="tablist" aria-label="Language view">
              {PROG_LANGS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="tab"
                  aria-selected={view === lang}
                  className={`learn-lang-btn ${view === lang ? 'active' : ''}`}
                  onClick={() => setView(lang)}
                >
                  {PROG_LANG_LABELS[lang]}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={view === 'compare'}
                className={`learn-lang-btn ${view === 'compare' ? 'active' : ''}`}
                onClick={() => setView('compare')}
              >
                Compare all
              </button>
            </div>
          </div>

          {topic && (
            <TopicLesson
              topic={topic}
              view={view}
              onPrev={goPrev}
              onNext={goNext}
              hasPrev={topicIndex > 0}
              hasNext={topicIndex < topics.length - 1}
            />
          )}
        </div>

        <nav className="learn-fund-steps" aria-label="Fundamentals lessons">
          <p className="learn-fund-steps-label">Lessons</p>
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`learn-fund-step ${topic?.id === t.id ? 'active' : ''}`}
              onClick={() => setTopicId(t.id)}
            >
              <span className="learn-fund-step-num">{t.number}</span>
              <span className="learn-fund-step-text">{t.title}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
