/** Common BB10 folders on the WiFi Storage `media` share (try in order). */
export interface BackupFolderPreset {
  id: string
  label: string
  description: string
  /** Remote paths relative to share root — first existing path wins. */
  candidates: string[]
}

export const BACKUP_FOLDER_PRESETS: BackupFolderPreset[] = [
  {
    id: 'camera',
    label: 'Camera',
    description: 'Photos and videos from the camera roll',
    candidates: ['accounts/1000/camera', 'camera']
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Shared documents (BerryCore uploads, files)',
    candidates: [
      'accounts/1000/shared/documents',
      'shared/documents',
      'documents'
    ]
  },
  {
    id: 'music',
    label: 'Music',
    description: 'Music library',
    candidates: ['accounts/1000/music', 'music']
  },
  {
    id: 'videos',
    label: 'Videos',
    description: 'Video files',
    candidates: ['accounts/1000/videos', 'videos', 'video']
  },
  {
    id: 'misc',
    label: 'Misc',
    description: 'Shared misc (BerryCore runtime, etc.)',
    candidates: ['accounts/1000/shared/misc', 'misc']
  },
  {
    id: 'pimdata',
    label: 'PIM / messages',
    description: 'Messages, notebooks, contacts startup data',
    candidates: ['accounts/1000/pimdata', 'pimdata']
  }
]
