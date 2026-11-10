import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { useCamera } from '../state/camera'
import { useNav } from '../state/nav'
import { useSettings } from '../state/settings'

const RESOLUTIONS = ['1280x720', '1920x1080', '3840x2160']

// Pick which camera to use and how sharp it should be.
// Reached by pressing and holding the title on the home screen.
export function CameraSetup(): React.JSX.Element {
  const nav = useNav()
  const { settings, update } = useSettings()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState(settings.cameraDeviceId)
  const [res, setRes] = useState(`${settings.cameraWidth}x${settings.cameraHeight}`)
  const [actual, setActual] = useState('')
  const [w, h] = res.split('x').map(Number)
  const { videoRef, state } = useCamera(deviceId, w, h)

  // Camera names are only available after permission is granted.
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => setDevices(list.filter((d) => d.kind === 'videoinput')))
      .catch(() => setDevices([]))
  }, [state.status])

  const save = async (): Promise<void> => {
    await update({ cameraDeviceId: deviceId, cameraWidth: w, cameraHeight: h })
    nav.go({ name: 'home' })
  }

  return (
    <div className="screen">
      <h1 className="page-title">Camera setup</h1>
      <div className="setup">
        <div className="setup-left">
          <div className="setup-video">
            <video
              ref={videoRef}
              className="cam-video"
              muted
              playsInline
              onLoadedMetadata={(e) => setActual(`${e.currentTarget.videoWidth}×${e.currentTarget.videoHeight}`)}
              style={{ transform: settings.mirrorPreview ? 'scaleX(-1)' : undefined }}
            />
          </div>
          {state.status === 'error' && <p className="note" style={{ color: '#c53030' }}>{state.message}</p>}
          {state.status === 'ready' && actual && <p className="note">Camera is delivering {actual} pixels.</p>}
        </div>

        <div className="setup-right">
          <h2>Camera</h2>
          <button className={`pick ${deviceId === '' ? 'selected' : ''}`} onClick={() => setDeviceId('')}>
            Default camera
          </button>
          {devices.map((d, i) => (
            <button
              key={d.deviceId}
              className={`pick ${deviceId === d.deviceId ? 'selected' : ''}`}
              onClick={() => setDeviceId(d.deviceId)}
            >
              {d.label || `Camera ${i + 1}`}
            </button>
          ))}

          <h2>Quality</h2>
          <div className="res-row">
            {RESOLUTIONS.map((r) => (
              <button key={r} className={`pick ${res === r ? 'selected' : ''}`} onClick={() => setRes(r)}>
                {r.replace('x', ' × ')}
              </button>
            ))}
          </div>
          <p className="note">If a camera cannot do the size you pick, it uses the closest it can.</p>
          
          <h2>Keyboard (operator)</h2>
          <p className="note">
            F11: fullscreen on/off
            <br />
            Ctrl+Shift+M: move to the next monitor (the tablet)
            <br />
            Ctrl+Q: quit
          </p>
        </div>
      </div>

      <div className="footer">
        <Button label="Cancel" variant="secondary" onClick={() => nav.go({ name: 'home' })} />
        <Button label="Save" onClick={save} />
      </div>
    </div>
  )
}