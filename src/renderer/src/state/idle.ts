// Screens that must not be interrupted by the inactivity reset (like the
// camera screen while photos are being taken) switch this on.
let blocked = false
export const setIdleBlocked = (value: boolean): void => {
  blocked = value
}
export const isIdleBlocked = (): boolean => blocked