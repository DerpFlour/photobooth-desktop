import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Confirm } from '../components/Confirm'
import { Overlay } from '../components/Overlay'
import { PinPad } from '../components/PinPad'
import { ChoiceRow, NumberRow, TextRow, ToggleRow } from '../components/SettingRows'
import { fileUrl } from '../config/assets'
import { getLayoutById } from '../config/layouts'
import { getTemplateById } from '../config/templates'
import { useNav } from '../state/nav'
import { useSettings } from '../state/settings'

const MB = 1024 * 1024
const fmt = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / MB).toFixed(1)} MB`

// The wrong-PIN counter lives OUTSIDE the screen, so leaving and re-entering
// the admin does not reset it.
let failedAttempts = 0
let lockedUntil = 0

type Tab = 'sessions' | 'storage' | 'settings'

export function Admin({ initiallyUnlocked }: { initiallyUnlocked: boolean }): React.JSX.Element {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked)
  return unlocked ? <AdminPanel /> : <PinGate onUnlock={() => setUnlocked(true)} />
}

// ---------------------------------------------------------------------------
// PIN screen
// ---------------------------------------------------------------------------
function PinGate({ onUnlock }: { onUnlock: () => void }): React.JSX.Element {
  const nav = useNav()
  const { settings } = useSettings()
  const [message, setMessage] = useState('Enter PIN')

  const check = (pin: string): void => {
    if (Date.now() < lockedUntil) {
      setMessage('Too many tries. Please wait a moment.')
      return
    }
    if (pin === settings.adminPin) {
      failedAttempts = 0
      onUnlock()
      return
    }
    failedAttempts++
    if (failedAttempts >= 5) {
      failedAttempts = 0
      lockedUntil = Date.now() + 30000
      setMessage('Locked for 30 seconds.')
    } else {
      setMessage('Wrong PIN')
    }
  }

  return (
    <div className="screen">
      <PinPad
        length={settings.adminPin.length}
        title="Admin"
        message={message}
        onComplete={check}
        onCancel={() => nav.go({ name: 'home' })}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------
function AdminPanel(): React.JSX.Element {
  const nav = useNav()
  const { settings, update } = useSettings()
  const [tab, setTab] = useState<Tab>('sessions')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [summary, setSummary] = useState<StorageSummary | null>(null)
  const [queue, setQueue] = useState<CloudQueue>({ waiting: 0, failed: 0 })
  const [selected, setSelected] = useState<SessionRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [cloudTest, setCloudTest] = useState<CloudTestResult | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    yesLabel: string
    run: () => Promise<void>
  } | null>(null)
  const [pinStep, setPinStep] = useState<null | 'new' | 'confirm'>(null)
  const [pinFirst, setPinFirst] = useState('')
  const [pinMsg, setPinMsg] = useState('')

  const refresh = useCallback(async () => {
    try {
      setSessions(await window.api.listSessions(1000))
      setSummary(await window.api.storageSummary())
      setQueue(await window.api.cloudQueue())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const copyLink = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Link copied.')
    } catch {
      setNotice(url) // couldn't copy: at least show it
    }
  }

  const askDelete = (rec: SessionRecord): void =>
    setConfirm({
      title: 'Delete this session?',
      message: 'The photo strip will be permanently deleted from this computer, and from the online gallery if it was shared.',
      yesLabel: 'Delete',
      run: async () => {
        const result = await window.api.deleteSession(rec.id)
        setSelected(null)
        setNotice(
          result.remote === 'failed'
            ? 'Deleted here. The online copy could not be deleted right now; it will expire by itself.'
            : result.remote === 'deleted'
              ? 'Deleted, including the online copy.'
              : ''
        )
        await refresh()
      }
    })

  const askDeleteAll = (): void =>
    setConfirm({
      title: 'Delete ALL sessions?',
      message: 'Every saved photo strip on this computer will be permanently deleted. Online copies are deleted in the background.',
      yesLabel: 'Delete all',
      run: async () => {
        await window.api.deleteAllSessions()
        await refresh()
      }
    })

  const runCleanup = async (): Promise<void> => {
    const n = await window.api.pruneStorage()
    setNotice(settings.autoPrune ? `Cleanup removed ${n} session(s).` : 'Automatic cleanup is turned off in Settings.')
    await refresh()
  }

  // Changing the PIN: enter it twice.
  const onNewPin = (pin: string): void => {
    if (pinStep === 'new') {
      setPinFirst(pin)
      setPinStep('confirm')
      setPinMsg('Enter it again to confirm')
    } else if (pin === pinFirst) {
      update({ adminPin: pin })
      setPinStep(null)
      setNotice('PIN changed. Write it down: there is no way to recover it.')
    } else {
      setPinStep('new')
      setPinMsg("The PINs didn't match. Try again")
    }
  }

  const avg = summary && summary.sessionCount > 0 ? summary.usedBytes / summary.sessionCount : 1.5 * MB
  const roomFor = summary ? Math.max(0, Math.floor((summary.freeBytes - settings.minFreeSpaceMB * MB) / avg)) : 0

  return (
    <div className="screen">
      <div className="admin-head">
        <h1 className="admin-title">Admin</h1>
        <div className="admin-tabs tabs">
          {(['sessions', 'storage', 'settings'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => {
                setTab(t)
                setNotice('')
              }}
            >
              {t === 'sessions' ? 'Sessions' : t === 'storage' ? 'Storage' : 'Settings'}
            </button>
          ))}
        </div>
        <Button label="Exit" variant="secondary" onClick={() => nav.go({ name: 'home' })} style={{ minWidth: 0, padding: '18px 48px' }} />
      </div>

      <div className="admin-body">
        {error && <div className="warn">Could not load: {error}</div>}

        {/* ------------- SESSIONS ------------- */}
        {tab === 'sessions' && (
          <>
            <p className="admin-hint">
              {sessions.length} saved session{sessions.length === 1 ? '' : 's'}, newest first. Tap one to open it.
            </p>
            {notice && <div className="notice" style={{ marginTop: 0, marginBottom: 12 }}>{notice}</div>}
            <div className="admin-grid">
              {sessions.map((s) => (
                <button key={s.id} className="session-card" onClick={() => setSelected(s)}>
                  <img src={fileUrl(s.thumbPath, s.createdAt)} style={{ aspectRatio: s.width / s.height }} alt="" draggable={false} />
                  <span>
                    {new Date(s.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {s.cloud ? (s.cloud.status === 'ready' ? ' · online' : ` · ${s.cloud.status}`) : ''}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ------------- STORAGE ------------- */}
        {tab === 'storage' && summary && (
          <div>
            <p className="stat">Saved sessions: <b>{summary.sessionCount}</b></p>
            <p className="stat">Used by sessions: <b>{fmt(summary.usedBytes)}</b></p>
            <p className="stat">
              Free on this computer: <b>{fmt(summary.freeBytes)}</b> of {fmt(summary.diskBytes)}
            </p>
            <p className="stat">
              Room for about <b>{roomFor}</b> more sessions (keeping {settings.minFreeSpaceMB} MB free)
            </p>
            <div className="admin-actions">
              <button className="chip" onClick={runCleanup}>Run cleanup now</button>
              <button className="chip" onClick={refresh}>Refresh</button>
              <button className="chip" onClick={() => window.api.openSessionsFolder()}>Open sessions folder</button>
              <button className="chip danger" onClick={askDeleteAll}>Delete all sessions</button>
            </div>
            {notice && <div className="notice">{notice}</div>}
          </div>
        )}

        {/* ------------- SETTINGS ------------- */}
        {tab === 'settings' && (
          <div>
            {settings.adminPin === '1234' && (
              <div className="warn">The admin PIN is still the default (1234). Please change it under Security below.</div>
            )}
            {notice && <div className="notice" style={{ marginTop: 0, marginBottom: 12 }}>{notice}</div>}

            <h2 className="group-title">Capture</h2>
            <div className="row">
              <div className="row-text">
                <div className="row-label">Camera and quality</div>
                <div className="row-hint">Choose the webcam and its resolution</div>
              </div>
              <button className="chip" onClick={() => nav.go({ name: 'cameraSetup' })}>Open camera setup</button>
            </div>
            <NumberRow label="Countdown" value={settings.countdownSeconds} min={1} max={10} step={1} unit=" s" onChange={(v) => update({ countdownSeconds: v })} />
            <NumberRow label="Show each shot for" value={settings.previewAfterShotMs} min={500} max={5000} step={500} unit=" ms" onChange={(v) => update({ previewAfterShotMs: v })} />
            <ToggleRow label="Live preview is mirrored" hint="Like a mirror / selfie camera" value={settings.mirrorPreview} onChange={(v) => update({ mirrorPreview: v })} />
            <ToggleRow label="Saved photos are mirrored" hint="On = photos look exactly like the preview" value={settings.mirrorPhotos} onChange={(v) => update({ mirrorPhotos: v })} />

            <h2 className="group-title">Behind-the-scenes clip</h2>
            <ToggleRow label="Record the animated strip clip" hint="Automatic for every guest. A red REC badge shows while it records" value={settings.gifEnabled} onChange={(v) => update({ gifEnabled: v })} />
            <NumberRow label="Smoothness" hint="Frames per second. Higher = smoother but a bigger file" value={settings.gifFps} min={5} max={15} step={1} unit=" fps" onChange={(v) => update({ gifFps: v })} />
            <NumberRow label="Clip size (width)" hint="Smaller files load faster on guests' phones" value={settings.gifWidth} min={240} max={480} step={60} unit=" px" onChange={(v) => update({ gifWidth: v })} />
            <NumberRow label="Pause on the finished strip" hint="Shown at the end of each loop" value={settings.gifHoldSeconds} min={0} max={5} step={1} unit=" s" onChange={(v) => update({ gifHoldSeconds: v })} />

            <h2 className="group-title">Online sharing (QR code)</h2>
            <ToggleRow label="Show a QR code so guests can download their photos" hint="Needs the website address and booth key below" value={settings.cloudEnabled} onChange={(v) => update({ cloudEnabled: v })} />
            <TextRow label="Website address" hint="From Vercel, for example https://photobooth-gallery-lac.vercel.app" value={settings.cloudBaseUrl} placeholder="https://your-site.vercel.app" onSave={(v) => update({ cloudBaseUrl: v })} />
            <TextRow label="Booth key" hint="The BOOTH_API_KEY from Vercel. Kept on this computer and never shown again" value={settings.cloudBoothKey} secret placeholder="paste the key here" onSave={(v) => update({ cloudBoothKey: v })} />
            <NumberRow label="Keep guest links online for" hint="Photos are deleted from the internet after this many days" value={settings.cloudRetentionDays} min={1} max={30} step={1} unit=" days" onChange={(v) => update({ cloudRetentionDays: v })} />
            <div className="row">
              <div className="row-text">
                <div className="row-label">Connection</div>
                <div className="row-hint" style={cloudTest ? { color: cloudTest.ok ? '#2f855a' : '#c53030', fontWeight: 700 } : undefined}>
                  {cloudTest ? cloudTest.message : 'Check that the address and key are right'}
                </div>
              </div>
              <button
                className="chip"
                onClick={async () => {
                  setCloudTest({ ok: false, message: 'Testing…' })
                  setCloudTest(await window.api.cloudTest())
                }}
              >
                Test connection
              </button>
            </div>
            <div className="row">
              <div className="row-text">
                <div className="row-label">Upload queue</div>
                <div className="row-hint">
                  {queue.waiting} waiting · {queue.failed} failed (failed uploads retry by themselves)
                </div>
              </div>
              <button
                className="chip"
                onClick={async () => {
                  await window.api.cloudRetry()
                  await refresh()
                }}
              >
                Retry now
              </button>
            </div>

            <h2 className="group-title">Export</h2>
            <ChoiceRow label="Picture format" hint="JPEG is smaller; PNG is lossless" value={settings.exportFormat} options={[{ value: 'jpeg', label: 'JPEG' }, { value: 'png', label: 'PNG' }]} onChange={(v) => update({ exportFormat: v })} />
            <NumberRow label="JPEG quality" value={settings.exportQuality} min={70} max={100} step={5} onChange={(v) => update({ exportQuality: v })} />
            <NumberRow label="Resolution multiplier" hint="1 = 300 dpi. 2 doubles the size (frame art gets softer)" value={settings.exportScale} min={1} max={2} step={1} unit="×" onChange={(v) => update({ exportScale: v })} />

            <h2 className="group-title">Kiosk</h2>
            <ToggleRow label="Fullscreen" hint="Also: F11 on the keyboard" value={settings.fullscreen} onChange={(v) => update({ fullscreen: v })} />
            <NumberRow label="Reset to home after" hint="0 = never" value={settings.idleTimeoutSeconds} min={0} max={600} step={15} unit=" s" onChange={(v) => update({ idleTimeoutSeconds: v })} />
            <NumberRow label="Warning countdown" value={settings.idleWarningSeconds} min={5} max={30} step={5} unit=" s" onChange={(v) => update({ idleWarningSeconds: v })} />
            <ToggleRow label="Show recent strips on the home screen" hint="Turn off to keep guests' photos private" value={settings.showRecentOnHome} onChange={(v) => update({ showRecentOnHome: v })} />
            <NumberRow label="Strips shown on home" value={settings.homeGalleryCount} min={0} max={20} step={1} onChange={(v) => update({ homeGalleryCount: v })} />

            <h2 className="group-title">Storage</h2>
            <ToggleRow label="Keep original full-size photos" hint="Uses about 20-30 MB per session" value={settings.keepOriginalPhotos} onChange={(v) => update({ keepOriginalPhotos: v })} />
            <ToggleRow label="Automatic cleanup" hint="Deletes the OLDEST sessions when a limit below is reached" value={settings.autoPrune} onChange={(v) => update({ autoPrune: v })} />
            <NumberRow label="Delete sessions older than" hint="0 = keep forever" value={settings.retentionDays} min={0} max={365} step={7} unit=" days" onChange={(v) => update({ retentionDays: v })} />
            <NumberRow label="Maximum sessions kept" value={settings.maxSessions} min={50} max={5000} step={50} onChange={(v) => update({ maxSessions: v })} />
            <NumberRow label="Keep this much space free" value={settings.minFreeSpaceMB} min={100} max={5000} step={100} unit=" MB" onChange={(v) => update({ minFreeSpaceMB: v })} />

            <h2 className="group-title">Security</h2>
            <div className="row">
              <div className="row-text">
                <div className="row-label">Admin PIN</div>
                <div className="row-hint">4 digits. Write it down: there is no recovery.</div>
              </div>
              <button
                className="chip"
                onClick={() => {
                  setPinMsg('Enter a new 4-digit PIN')
                  setPinStep('new')
                }}
              >
                Change PIN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------- Session detail (covers the whole window) ------------- */}
      {selected && (
        <Overlay>
          <div className="detail-row">
            <img src={fileUrl(selected.stripPath, selected.createdAt)} alt="" />
            {selected.gifPath && <img src={fileUrl(selected.gifPath, selected.createdAt)} alt="clip" />}
          </div>
          <div className="modal-text">
            {new Date(selected.createdAt).toLocaleString()} · {getLayoutById(selected.layoutId)?.name ?? selected.layoutId} ·{' '}
            {getTemplateById(selected.templateId)?.name ?? selected.templateId}
            <br />
            {selected.width}×{selected.height}px · {fmt(selected.bytes)}
            {selected.gifPath ? ' · with clip' : ''}
            {selected.originalsKept ? ' (originals kept)' : ''}
            {selected.cloud ? ` · online: ${selected.cloud.status}` : ''}
            {selected.cloud?.error ? ` (${selected.cloud.error})` : ''}
          </div>
          <div className="modal-buttons">
            <Button label="Close" variant="secondary" onClick={() => setSelected(null)} />
            <Button label="Show file" variant="secondary" onClick={() => window.api.showInFolder(selected.stripPath)} />
            {selected.cloud && (
              <Button
                label="Copy link"
                variant="secondary"
                onClick={() => {
                  if (selected.cloud) copyLink(selected.cloud.url)
                  setSelected(null)
                }}
              />
            )}
            <Button label="Delete" onClick={() => askDelete(selected)} style={{ background: '#e53e3e' }} />
          </div>
        </Overlay>
      )}

      {/* ------------- Change PIN ------------- */}
      {pinStep && (
        <Overlay background="#fff5f8" zIndex={1500}>
          <PinPad key={pinStep} length={4} title="Change PIN" message={pinMsg} onComplete={onNewPin} onCancel={() => setPinStep(null)} />
        </Overlay>
      )}

      {/* ------------- Are you sure? ------------- */}
      {confirm && (
        <Confirm
          title={confirm.title}
          message={confirm.message}
          yesLabel={confirm.yesLabel}
          danger
          onNo={() => setConfirm(null)}
          onYes={async () => {
            const run = confirm.run
            setConfirm(null)
            try {
              await run()
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }}
        />
      )}
    </div>
  )
}