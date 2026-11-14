import { TemplateConfig } from '../types'
import { frameUrl } from './assets'

export const TEMPLATES: TemplateConfig[] = [
  // ---- Click frames (transparent PNG artwork) ----
  {
    id: 'navy', name: 'Navy', layoutIds: ['strip-4', 'grid-8'],
    backgroundColor: '#0F2A5C', slotColor: '#16356F', textColor: '#FFFFFF', footerText: '',
    overlays: { 'strip-4': 'navy-strip-4.png', 'grid-8': 'navy-grid-8.png' }
  },
  {
    id: 'ocean', name: 'Ocean', layoutIds: ['strip-4', 'grid-8'],
    backgroundColor: '#2A64C0', slotColor: '#3A7CE2', textColor: '#FFFFFF', footerText: '',
    overlays: { 'strip-4': 'ocean-strip-4.png', 'grid-8': 'ocean-grid-8.png' }
  },
  {
    id: 'sky', name: 'Sky', layoutIds: ['strip-4', 'grid-8'],
    backgroundColor: '#CFE3FA', slotColor: '#FFFFFF', textColor: '#0F2A5C', footerText: '',
    overlays: { 'strip-4': 'sky-strip-4.png', 'grid-8': 'sky-grid-8.png' }
  },
  {
    id: 'cloud', name: 'Cloud', layoutIds: ['strip-4', 'grid-8'],
    backgroundColor: '#F2F7FD', slotColor: '#E1ECF9', textColor: '#0F2A5C', footerText: '',
    overlays: { 'strip-4': 'cloud-strip-4.png', 'grid-8': 'cloud-grid-8.png' }
  },

  // ---- Simple solid-color templates (work with any layout) ----
  { id: 'navy-solid', name: 'Navy Simple', layoutIds: 'all', backgroundColor: '#0F2A5C', slotColor: '#16356F', textColor: '#FFFFFF', footerText: 'click' },
  { id: 'sky-solid', name: 'Sky Simple', layoutIds: 'all', backgroundColor: '#CFE3FA', slotColor: '#FFFFFF', textColor: '#0F2A5C', footerText: 'click' },
  { id: 'white-solid', name: 'Clean White', layoutIds: 'all', backgroundColor: '#FFFFFF', slotColor: '#E8EFF9', textColor: '#0F2A5C', footerText: 'click' },

  // ---- Earlier pink designs: hidden for now ----
  {
    id: 'cherry', name: 'Cherry Pop', layoutIds: ['strip-4', 'grid-8'], enabled: false,
    backgroundColor: '#FFC2D6', slotColor: '#FFFFFF', textColor: '#B0305F', footerText: '',
    overlays: { 'strip-4': 'cherry-strip-4.png', 'grid-8': 'cherry-grid-8.png' }
  },
  {
    id: 'starry', name: 'Starry Night', layoutIds: ['strip-4', 'grid-8'], enabled: false,
    backgroundColor: '#1E1B3A', slotColor: '#34305F', textColor: '#8BF5FF', footerText: '',
    overlays: { 'strip-4': 'starry-strip-4.png', 'grid-8': 'starry-grid-8.png' }
  },
  { id: 'strawberry', name: 'Strawberry Milk', layoutIds: 'all', enabled: false, backgroundColor: '#FFC2D6', slotColor: '#FFFFFF', textColor: '#B0305F', footerText: 'photobooth' },
  { id: 'mint', name: 'Mint Soda', layoutIds: 'all', enabled: false, backgroundColor: '#BFEBD9', slotColor: '#FFFFFF', textColor: '#1F7A5A', footerText: 'fresh memories' },
  { id: 'midnight', name: 'Midnight Neon', layoutIds: 'all', enabled: false, backgroundColor: '#1E1B3A', slotColor: '#34305F', textColor: '#8BF5FF', footerText: 'tonight' },
  { id: 'butter', name: 'Butter Yellow', layoutIds: 'all', enabled: false, backgroundColor: '#FFF1A8', slotColor: '#FFFFFF', textColor: '#8A6D00', footerText: 'sunny day' },
  { id: 'classic', name: 'Classic White', layoutIds: 'all', enabled: false, backgroundColor: '#FFFFFF', slotColor: '#EDEDED', textColor: '#333333', footerText: 'photobooth' },
  { id: 'lilac', name: 'Lilac Dream', layoutIds: ['strip-4'], enabled: false, backgroundColor: '#DCCBFF', slotColor: '#FFFFFF', textColor: '#5B3FA8', footerText: 'dreamy' }
]

// Finds any template, even a hidden one (older sessions may use it).
export const getTemplateById = (id: string | null | undefined): TemplateConfig | undefined =>
  TEMPLATES.find((t) => t.id === id)

// Only templates guests may pick, that support the chosen layout.
export const getTemplatesForLayout = (layoutId: string): TemplateConfig[] =>
  TEMPLATES.filter((t) => t.enabled !== false && (t.layoutIds === 'all' || t.layoutIds.includes(layoutId)))

// The frame PNG's address for this template + layout, if it has one.
export const overlayFor = (template: TemplateConfig | undefined, layoutId: string): string | undefined => {
  const fileName = template?.overlays?.[layoutId]
  return fileName ? frameUrl(fileName) : undefined
}