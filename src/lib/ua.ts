// Coarse user-agent buckets for the analytics audience view. We store ONLY these
// low-cardinality labels (device class / browser family / OS), never the raw UA,
// so nothing here is a fingerprint — it's the same privacy stance as the salted
// visitor hash. Best-effort substring matching; anything unrecognized is 'Other'.
// Order matters: the more specific token is tested before the generic one it
// contains (Edge/Opera/Samsung before Chrome; Chrome before Safari).

export type UaInfo = { device: string; browser: string; os: string }

export function parseUa(ua: string): UaInfo {
  const s = (ua || '').toLowerCase()
  return { device: device(s), browser: browser(s), os: os(s) }
}

function device(s: string): string {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return 'tablet'
  if (/mobi|iphone|ipod|android|windows phone|blackberry|iemobile|opera mini/.test(s)) return 'mobile'
  return 'desktop'
}

function browser(s: string): string {
  if (/edg[ea/]/.test(s)) return 'Edge'
  if (/opr\/|opera|opios/.test(s)) return 'Opera'
  if (/samsungbrowser/.test(s)) return 'Samsung Internet'
  if (/firefox|fxios/.test(s)) return 'Firefox'
  if (/chrome|crios|chromium/.test(s)) return 'Chrome'
  if (/safari/.test(s)) return 'Safari'
  return 'Other'
}

function os(s: string): string {
  if (/iphone|ipad|ipod|ios/.test(s)) return 'iOS'
  if (/android/.test(s)) return 'Android'
  if (/windows/.test(s)) return 'Windows'
  if (/mac os x|macintosh/.test(s)) return 'macOS'
  if (/cros/.test(s)) return 'ChromeOS'
  if (/linux/.test(s)) return 'Linux'
  return 'Other'
}
