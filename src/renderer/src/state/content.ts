import { useSyncExternalStore } from 'react'

const EMPTY: ContentFile = { customLayouts: [], customTemplates: [], layoutEnabled: {}, templateEnabled: {} }

// The admin's layouts, frames and on/off switches. Kept outside React so the
// layout and template lists can read them anywhere. Screens that must update
// the moment something changes use useContent().
let current: ContentFile = EMPTY
const listeners = new Set<() => void>()
const emit = (): void => listeners.forEach((l) => l())

export const getContent = (): ContentFile => current

export function useContent(): ContentFile {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getContent,
    getContent
  )
}

export async function loadContent(): Promise<void> {
  current = await window.api.contentGet()
  emit()
}

// Saves a change (the main program checks it) and refreshes everything.
export async function saveContent(next: ContentFile): Promise<void> {
  current = await window.api.contentSet(next)
  emit()
}