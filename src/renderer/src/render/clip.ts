import { coverSource } from './drawStrip'

// Behind-the-scenes footage, kept per photo. The key is the photo's id, so
// the footage follows its photo if the guest reorders or retakes photos.
export type ClipShots = Record<string, ImageData[]>

// The most frames ONE photo's footage may contain. Keeps memory predictable.
// Footage only covers the countdown, so this follows the countdown setting.
export function frameBudget(countdownMs: number, fps: number): number {
  return Math.min(150, Math.ceil((countdownMs / 1000) * fps) + 3)
}

// Records small frames of the live camera for ONE photo, already cropped to
// the shape of the photo window it will play in.
export class ShotRecorder {
  readonly width: number
  readonly height: number
  private frames: ImageData[] = []
  private ctx: CanvasRenderingContext2D
  private mirror: boolean
  private maxFrames: number

  constructor(width: number, height: number, mirror: boolean, maxFrames: number) {
    this.width = width
    this.height = height
    this.mirror = mirror
    this.maxFrames = maxFrames
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    this.ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    this.ctx.imageSmoothingQuality = 'medium'
  }

  snap(video: HTMLVideoElement): void {
    if (!video.videoWidth || this.frames.length >= this.maxFrames) return
    const { ctx, width, height } = this
    // Crop the camera picture to the window's shape, like the photos are.
    const { sx, sy, sw, sh } = coverSource(video.videoWidth, video.videoHeight, width / height)
    ctx.save()
    if (this.mirror) {
      ctx.translate(width, 0)
      ctx.scale(-1, 1) // same mirroring as the saved photos
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height)
    ctx.restore()
    this.frames.push(ctx.getImageData(0, 0, width, height))
  }

  take(): ImageData[] {
    return this.frames
  }
}