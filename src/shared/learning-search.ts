import { LEARNING_MODULES } from './learning-modules'
import type { LearningModule } from './learning-types'

export type LearningSearchKind = 'module' | 'section' | 'lesson'

export interface LearningSearchHit {
  id: string
  kind: LearningSearchKind
  moduleId: string
  moduleNumber: number
  moduleTitle: string
  title: string
  excerpt: string
  /** Fundamentals lesson id when kind === 'lesson' */
  lessonId?: string
  score: number
}

function norm(s: string): string {
  return s.toLowerCase().trim()
}

function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max)}…`
}

function scoreMatch(query: string, fields: { text: string; weight: number }[]): number {
  const q = norm(query)
  if (!q) return 0
  let score = 0
  for (const { text, weight } of fields) {
    const t = norm(text)
    if (t === q) score += weight * 4
    else if (t.startsWith(q)) score += weight * 3
    else if (t.includes(q)) score += weight * 2
    else {
      const words = q.split(/\s+/).filter(Boolean)
      for (const w of words) {
        if (t.includes(w)) score += weight
      }
    }
  }
  return score
}

function collectModuleText(mod: LearningModule): string {
  const parts = [mod.title, mod.subtitle]
  for (const sec of mod.sections) {
    parts.push(sec.heading, sec.body ?? '', ...(sec.bullets ?? []), sec.tip ?? '')
    const blocks = sec.code ? (Array.isArray(sec.code) ? sec.code : [sec.code]) : []
    for (const b of blocks) parts.push(b.code, b.caption ?? '')
  }
  for (const lesson of mod.fundamentals ?? []) {
    parts.push(
      lesson.title,
      lesson.summary,
      lesson.why,
      ...lesson.concepts,
      ...lesson.compare.flatMap((r) => [r.idea, r.bash, r.python, r.node])
    )
  }
  return parts.join(' ')
}

export function buildLearningSearchIndex(): LearningSearchHit[] {
  const hits: LearningSearchHit[] = []

  for (const mod of LEARNING_MODULES) {
    hits.push({
      id: `module:${mod.id}`,
      kind: 'module',
      moduleId: mod.id,
      moduleNumber: mod.number,
      moduleTitle: mod.title,
      title: mod.title,
      excerpt: mod.subtitle,
      score: 0
    })

    for (const sec of mod.sections) {
      const text = [sec.heading, sec.body, ...(sec.bullets ?? []), sec.tip].filter(Boolean).join(' ')
      hits.push({
        id: `section:${mod.id}:${sec.heading}`,
        kind: 'section',
        moduleId: mod.id,
        moduleNumber: mod.number,
        moduleTitle: mod.title,
        title: sec.heading,
        excerpt: excerpt(sec.body ?? sec.bullets?.[0] ?? mod.subtitle),
        score: 0
      })
    }

    for (const lesson of mod.fundamentals ?? []) {
      hits.push({
        id: `lesson:${mod.id}:${lesson.id}`,
        kind: 'lesson',
        moduleId: mod.id,
        moduleNumber: mod.number,
        moduleTitle: mod.title,
        title: lesson.title,
        excerpt: excerpt(lesson.summary),
        lessonId: lesson.id,
        score: 0
      })
    }
  }

  return hits
}

const INDEX = buildLearningSearchIndex()

export function searchLearning(query: string, limit = 24): LearningSearchHit[] {
  const q = norm(query)
  if (!q) return []

  const scored = INDEX.map((hit) => {
    const mod = LEARNING_MODULES.find((m) => m.id === hit.moduleId)
    const modText = mod ? collectModuleText(mod) : ''
    const score = scoreMatch(q, [
      { text: hit.title, weight: 5 },
      { text: hit.excerpt, weight: 2 },
      { text: hit.moduleTitle, weight: 2 },
      { text: modText, weight: 1 }
    ])
    return { ...hit, score }
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.moduleNumber - b.moduleNumber)

  return scored.slice(0, limit)
}

export function learningModuleCount(): number {
  return LEARNING_MODULES.length
}
