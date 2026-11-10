import { TemplateConfig } from '../types'
import { frameUrl } from './assets'

export const TEMPLATES: TemplateConfig[] = [
  // ---- Frames with real transparent PNG artwork ----
  {
    id: 'cherry', name: 'Cherry Pop', layoutIds: ['strip-4', 'grid-8'],
    backgroundColor: '#FFC2D6', slotColor: '#FFFFFF', textColor: '#B0305F', footerText: '',
    overlays: { 'strip-4': 'cherry-strip-4.png', 'grid-8': 'cherry-grid-8.png' }
  },
  {
    id: 'starry', name: 'Starry Night', layoutIds: ['strip-4', 'grid-8'],
    backgroundColor: '#1E1B3A', slotColor: '#34305F', textColor: '#8BF5FF', footerText: '',
    overlays: { 'strip-4': 'starry-strip-4.png', 'grid-8': 'starry-grid-8.png' }
  },

  // ---- Simple solid-color templates (no PNG) ----
  { id: 'strawberry', name: 'Strawberry Milk', layoutIds: 'all', backgroundColor: '#FFC2D6', slotColor: '#FFFFFF', textColor: '#B0305F', footerText: 'photobooth' },
  { id: 'mint', name: 'Mint Soda', layoutIds: 'all', backgroundColor: '#BFEBD9', slotColor: '#FFFFFF', textColor: '#1F7A5A', footerText: 'fresh memories' },
  { id: 'midnight', name: 'Midnight Neon', layoutIds: 'all', backgroundColor: '#1E1B3A', slotColor: '#34305F', textColor: '#8BF5FF', footerText: 'tonight' },
  { id: 'butter', name: 'Butter Yellow', layoutIds: 'all', backgroundColor: '#FFF1A8', slotColor: '#FFFFFF', textColor: '#8A6D00', footerText: 'sunny day' },
  { id: 'classic', name: 'Classic White', layoutIds: 'all', backgroundColor: '#FFFFFF', slotColor: '#EDEDED', textColor: '#333333', footerText: 'photobooth' },
  { id: 'lilac', name: 'Lilac Dream', layoutIds: ['strip-4'], backgroundColor: '#DCCBFF', slotColor: '#FFFFFF', textColor: '#5B3FA8', footerText: 'dreamy' }
]

export const getTemplateById = (id: string | null | undefined): TemplateConfig | undefined =>
  TEMPLATES.find((t) => t.id === id)

// Only templates that support the chosen layout.
export const getTemplatesForLayout = (layoutId: string): TemplateConfig[] =>
  TEMPLATES.filter((t) => t.layoutIds === 'all' || t.layoutIds.includes(layoutId))

// The frame PNG's address for this template + layout, if it has one.
export const overlayFor = (template: TemplateConfig | undefined, layoutId: string): string | undefined => {
  const fileName = template?.overlays?.[layoutId]
  return fileName ? frameUrl(fileName) : undefined
}