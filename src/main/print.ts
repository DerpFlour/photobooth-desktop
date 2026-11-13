import { app, BrowserWindow } from 'electron'
import { randomBytes } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSettings } from './settings'

// Every printer Windows knows about (any brand, USB or network).
export async function listPrinters(win: BrowserWindow | null): Promise<PrinterEntry[]> {
  if (!win) return []
  const list = await win.webContents.getPrintersAsync()
  return list.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    description: p.description ?? '',
    isDefault: p.isDefault
  }))
}

function explain(reason: string): string {
  const r = (reason || '').toLowerCase()
  if (r.includes('cancel')) return 'The print was cancelled.'
  if (r.includes('invalid')) {
    return 'The printer did not accept the settings. In the admin print settings, try turning on "Use the printer\'s own paper size".'
  }
  return `The printer could not print (${reason || 'unknown reason'}). Check that it is switched on, connected, and has paper and ink.`
}

// Sends one finished sheet to the printer, silently (no print window).
export async function printSheet(req: PrintRequest, win: BrowserWindow | null): Promise<PrintResult> {
  const s = getSettings()
  if (!s.printEnabled) return { ok: false, message: 'Printing is switched off.' }
  if (!req?.image || !(req.widthMm > 0) || !(req.heightMm > 0)) {
    return { ok: false, message: 'There was nothing to print.' }
  }

  // Which printer? The one chosen in the admin, or the Windows default.
  let printers: PrinterEntry[] = []
  try {
    printers = await listPrinters(win)
  } catch {
    printers = []
  }
  if (printers.length === 0) {
    return { ok: false, message: 'No printer is installed on this computer. Install the printer in Windows first.' }
  }
  let target: PrinterEntry | undefined
  if (s.printerName) {
    target = printers.find((p) => p.name === s.printerName)
    if (!target) {
      return {
        ok: false,
        message: `The printer "${s.printerName}" is not available. Check that it is switched on and connected, or choose another printer in the admin settings.`
      }
    }
  } else {
    target = printers.find((p) => p.isDefault) ?? printers[0]
  }

  // Put the sheet in a tiny page that is exactly the size of the paper,
  // then print that page from a hidden window.
  const dir = join(app.getPath('temp'), 'photobooth-print', randomBytes(6).toString('hex'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'sheet.jpg'), Buffer.from(req.image))
  const w = req.widthMm.toFixed(2)
  const h = req.heightMm.toFixed(2)
  writeFileSync(
    join(dir, 'sheet.html'),
    `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: ${w}mm ${h}mm; margin: 0 }
html, body { margin: 0; padding: 0; width: ${w}mm; height: ${h}mm; overflow: hidden; background: #fff }
img { display: block; width: ${w}mm; height: ${h}mm }
</style></head><body><img src="sheet.jpg"></body></html>`
  )

  const printWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
  })

  try {
    await printWindow.loadFile(join(dir, 'sheet.html'))
    await new Promise((resolve) => setTimeout(resolve, 300)) // let the picture finish drawing

    const copies = Math.max(1, Math.min(10, Math.round(req.copies) || 1))
    for (let i = 0; i < copies; i++) {
      const options: Electron.WebContentsPrintOptions = {
        silent: true, // no print window
        printBackground: true,
        deviceName: target?.name ?? '',
        color: true,
        landscape: false,
        margins: { marginType: 'none' }
      }
      if (s.printUseDriverPaper) options.usePrinterDefaultPageSize = true
      else options.pageSize = { width: Math.round(req.widthMm * 1000), height: Math.round(req.heightMm * 1000) } // microns

      const result = await Promise.race([
        new Promise<{ success: boolean; reason: string }>((resolve) => {
          printWindow.webContents.print(options, (success, reason) => resolve({ success, reason }))
        }),
        new Promise<{ success: boolean; reason: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, reason: 'the printer did not respond' }), 60_000)
        )
      ])
      if (!result.success) return { ok: false, message: explain(result.reason), printer: target?.displayName }
    }
    return {
      ok: true,
      message: `Sent to ${target?.displayName ?? 'the printer'}. Your print will be ready in a moment.`,
      printer: target?.displayName
    }
  } catch (e) {
    return { ok: false, message: `The print could not be prepared: ${e instanceof Error ? e.message : String(e)}` }
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 30_000) // tidy up later
  }
}