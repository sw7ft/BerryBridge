export type ProgLang = 'bash' | 'python' | 'node'

export const PROG_LANGS: ProgLang[] = ['python', 'bash', 'node']

export const PROG_LANG_LABELS: Record<ProgLang, string> = {
  bash: 'Bash',
  python: 'Python',
  node: 'Node.js'
}

export interface LearningCodeBlock {
  lang?: string
  code: string
  caption?: string
}

export interface LearningSection {
  heading: string
  body?: string
  bullets?: string[]
  code?: LearningCodeBlock | LearningCodeBlock[]
  tip?: string
}

export interface LangGuide {
  syntax: string
  notes: string[]
}

export interface FundamentalsExample {
  title: string
  description?: string
  code: LearningCodeBlock
}

export interface CompareRow {
  idea: string
  bash: string
  python: string
  node: string
}

export interface FundamentalsTopic {
  id: string
  number: number
  title: string
  summary: string
  why: string
  concepts: string[]
  compare: CompareRow[]
  langGuide: Record<ProgLang, LangGuide>
  walkthrough: Record<ProgLang, FundamentalsExample[]>
  exercise: {
    prompt: string
    hint?: string
    solution?: Record<ProgLang, LearningCodeBlock>
  }
}

export interface LearningModule {
  id: string
  number: number
  title: string
  subtitle: string
  sections: LearningSection[]
  fundamentals?: FundamentalsTopic[]
}
