import { useState } from 'react'
import type { LearningCodeBlock } from '@shared/learning-modules'

interface Props {
  block: LearningCodeBlock
}

export function LearningCode({ block }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <figure className="learn-code">
      {(block.lang || block.caption) && (
        <figcaption className="learn-code-cap">
          {block.caption && <span>{block.caption}</span>}
          {block.lang && <span className="learn-code-lang">{block.lang}</span>}
        </figcaption>
      )}
      <div className="learn-code-row">
        <pre className="learn-code-pre">{block.code}</pre>
        <button type="button" className="btn btn-secondary btn-sm learn-code-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </figure>
  )
}
