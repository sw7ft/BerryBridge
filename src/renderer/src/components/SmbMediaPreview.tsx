import type { SmbFileEntry, SmbMediaPreview } from '@shared/types'

interface Props {
  preview: SmbMediaPreview | null
  loading: boolean
  error: string
  entry: SmbFileEntry | null
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  onExpand: () => void
  onDownload: () => void
  onClose: () => void
  onMediaError: () => void
  downloading: boolean
}

export function SmbMediaPreviewPanel({
  preview,
  loading,
  error,
  entry,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onExpand,
  onDownload,
  onClose,
  onMediaError,
  downloading
}: Props) {
  if (!entry && !loading) return null

  return (
    <aside className="smb-preview-panel">
      <div className="smb-preview-header">
        <div className="smb-preview-title">
          <strong>{entry?.name || 'Preview'}</strong>
          {preview && (
            <span className="smb-preview-meta">
              {preview.kind === 'image' ? 'Photo' : 'Video'}
              {preview.cached ? ' · cached' : ''}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close preview">
          ✕
        </button>
      </div>

      <div className="smb-preview-body">
        {loading && (
          <div className="smb-preview-loading">
            <div className="scan-progress-bar">
              <div className="scan-progress-fill smb-indeterminate" />
            </div>
            <p>Loading from device…</p>
          </div>
        )}

        {!loading && error && <div className="alert alert-warn">{error}</div>}

        {!loading && preview && preview.kind === 'image' && (
          <button type="button" className="smb-preview-media-btn" onClick={onExpand}>
            <img
              src={preview.url}
              alt={preview.name}
              className="smb-preview-image"
              onError={onMediaError}
            />
          </button>
        )}

        {!loading && preview && preview.kind === 'video' && (
          <video
            src={preview.url}
            className="smb-preview-video"
            controls
            playsInline
            preload="metadata"
          />
        )}

        {!loading && !preview && !error && entry && (
          <div className="smb-preview-empty">Select a photo or video to preview.</div>
        )}
      </div>

      <div className="smb-preview-actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={!hasPrev || loading} onClick={onPrev}>
          ← Prev
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!hasNext || loading} onClick={onNext}>
          Next →
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!preview || loading}
          onClick={onExpand}
        >
          Full screen
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!entry || downloading}
          onClick={onDownload}
        >
          {downloading ? 'Saving…' : 'Download'}
        </button>
      </div>
    </aside>
  )
}

interface ModalProps {
  preview: SmbMediaPreview
  onClose: () => void
}

export function SmbMediaPreviewModal({ preview, onClose }: ModalProps) {
  return (
    <div className="smb-preview-modal" role="dialog" aria-modal="true" aria-label={preview.name}>
      <button type="button" className="smb-preview-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="smb-preview-modal-content">
        <button type="button" className="smb-preview-modal-close btn btn-secondary btn-sm" onClick={onClose}>
          Close
        </button>
        {preview.kind === 'image' ? (
          <img src={preview.url} alt={preview.name} className="smb-preview-modal-image" />
        ) : (
          <video
            src={preview.url}
            className="smb-preview-modal-video"
            controls
            autoPlay
            playsInline
          />
        )}
        <p className="smb-preview-modal-caption">{preview.name}</p>
      </div>
    </div>
  )
}
