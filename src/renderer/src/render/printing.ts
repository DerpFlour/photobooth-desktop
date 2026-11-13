import { getLayoutById } from '../config/layouts'
import { canvasToBlob } from './drawStrip'
import { buildSheet, buildTestSheet, Sheet } from './sheet'

// How many times each guest session has pressed Print (kept while the app runs).
const used = new Map<string, number>()
export const printsUsed = (sessionId: string): number => used.get(sessionId) ?? 0
export const countPrint = (sessionId: string): void => {
  used.set(sessionId, printsUsed(sessionId) + 1)
}

// Reads a saved strip and lays it out on the chosen paper.
async function sheetForSession(record: SessionRecord, s: AppSettings): Promise<Sheet> {
  const bytes = await window.api.readSessionFile(record.stripPath)
  const bitmap = await createImageBitmap(new Blob([bytes]))
  try {
    // The strip's natural print size (300 dpi), whatever resolution it was saved at.
    const natural = getLayoutById(record.layoutId)?.output
    return buildSheet({
      strip: bitmap,
      natW: natural?.width ?? bitmap.width,
      natH: natural?.height ?? bitmap.height,
      paper: s.printPaper,
      fill: s.printFillSheet,
      marginMm: s.printMarginMm
    })
  } finally {
    bitmap.close()
  }
}

async function send(sheet: Sheet, copies: number): Promise<PrintResult> {
  const blob = await canvasToBlob(sheet.canvas, 'image/jpeg', 0.95)
  return window.api.printSheet({
    image: await blob.arrayBuffer(),
    widthMm: sheet.widthMm,
    heightMm: sheet.heightMm,
    copies
  })
}

const failure = (e: unknown): PrintResult => ({
  ok: false,
  message: `Printing did not work: ${e instanceof Error ? e.message : String(e)}`
})

export async function printSession(record: SessionRecord, s: AppSettings): Promise<PrintResult> {
  try {
    return await send(await sheetForSession(record, s), s.printCopies)
  } catch (e) {
    return failure(e)
  }
}

export async function printTestPage(s: AppSettings): Promise<PrintResult> {
  try {
    return await send(buildTestSheet(s.printPaper, s.printMarginMm), 1)
  } catch (e) {
    return failure(e)
  }
}

// Saves the print-ready sheet as a file, to print from any other program.
export async function saveSheetFor(record: SessionRecord, s: AppSettings): Promise<void> {
  const sheet = await sheetForSession(record, s)
  const blob = await canvasToBlob(sheet.canvas, 'image/jpeg', 0.95)
  await window.api.saveSheetFile(record.id, await blob.arrayBuffer())
}