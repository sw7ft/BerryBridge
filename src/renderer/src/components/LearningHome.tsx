import { useMemo, useState } from 'react'
import { LEARNING_MODULES } from '@shared/learning-modules'
import { searchLearning, type LearningSearchHit } from '@shared/learning-search'

const KIND_LABELS = {
  module: 'Module',
  section: 'Section',
  lesson: 'Lesson'
} as const

interface Props {
  onOpenModule: (moduleId: string, lessonId?: string) => void
}

function SearchResult({ hit, onSelect }: { hit: LearningSearchHit; onSelect: () => void }) {
  return (
    <button type="button" className="learn-search-hit" onClick={onSelect}>
      <span className="learn-search-hit-kind">{KIND_LABELS[hit.kind]}</span>
      <span className="learn-search-hit-module">
        {hit.moduleNumber}. {hit.moduleTitle}
      </span>
      <strong className="learn-search-hit-title">{hit.title}</strong>
      <span className="learn-search-hit-excerpt">{hit.excerpt}</span>
    </button>
  )
}

export function LearningHome({ onOpenModule }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchLearning(query), [query])

  const grouped = useMemo(
    () => ({
      core: LEARNING_MODULES.filter((m) => m.number <= 6),
      build: LEARNING_MODULES.filter((m) => m.number >= 7 && m.number <= 9),
      infra: LEARNING_MODULES.filter((m) => m.number >= 10)
    }),
    []
  )

  return (
    <div className="learn-home">
      <section className="learn-home-hero">
        <h3>Learn BerryCore from the ground up</h3>
        <p>
          Terminals, shell, SSH, Python, tmux, Git, DNS, and more — practical modules for BB10
          and Berry Bridge.
        </p>
        <div className="learn-search-wrap">
          <input
            type="search"
            className="learn-search-input"
            placeholder="Search tmux, SSH, if statements, DNS…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Search learning modules"
          />
          {query && (
            <button type="button" className="learn-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
      </section>

      {query.trim() ? (
        <section className="learn-search-results">
          <p className="learn-search-meta">
            {results.length === 0
              ? `No results for “${query.trim()}”`
              : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </p>
          <div className="learn-search-list">
            {results.map((hit) => (
              <SearchResult
                key={hit.id}
                hit={hit}
                onSelect={() => onOpenModule(hit.moduleId, hit.lessonId)}
              />
            ))}
          </div>
        </section>
      ) : (
        <>
          <ModuleGroup
            label="Getting started"
            desc="Terminal, shell, SSH, editors, and code basics"
            modules={grouped.core}
            onOpen={onOpenModule}
          />
          <ModuleGroup
            label="Build & automate"
            desc="Programming fundamentals, tmux, and Git"
            modules={grouped.build}
            onOpen={onOpenModule}
          />
          <ModuleGroup
            label="Infrastructure"
            desc="Networking, DNS, hosting, and virtualization"
            modules={grouped.infra}
            onOpen={onOpenModule}
          />
        </>
      )}
    </div>
  )
}

function ModuleGroup({
  label,
  desc,
  modules,
  onOpen
}: {
  label: string
  desc: string
  modules: typeof LEARNING_MODULES
  onOpen: (moduleId: string) => void
}) {
  return (
    <section className="learn-home-group">
      <header className="learn-home-group-head">
        <h4>{label}</h4>
        <p>{desc}</p>
      </header>
      <div className="learn-home-grid">
        {modules.map((mod) => (
          <button
            key={mod.id}
            type="button"
            className="learn-home-card"
            onClick={() => onOpen(mod.id)}
          >
            <span className="learn-home-card-num">{mod.number}</span>
            <strong>{mod.title}</strong>
            <span>{mod.subtitle}</span>
            {mod.fundamentals && (
              <em className="learn-home-card-badge">{mod.fundamentals.length} lessons</em>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
