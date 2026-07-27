// The enrolment QR code, as inline SVG.
//
// `qrcode-generator` rather than a hand-written encoder: QR is Reed-Solomon error
// correction over a bit-interleaved layout, and a subtly wrong implementation produces an
// image that looks exactly like a QR code and cannot be scanned. That is the failure mode
// worth paying a dependency to avoid — and this one is a single file with no dependencies
// of its own, which is why it was chosen over the more popular `qrcode` (29 packages,
// including a CLI argument parser and a PNG encoder we would never call).
//
// SVG, not PNG: it needs no raster pipeline, so unlike the OG card this works in the
// compiled binary with nothing beside it, and it stays sharp on any display.

import qrcode from 'qrcode-generator'

/** Quiet zone, in modules. Four is the specification's minimum and scanners rely on it. */
const MARGIN = 4

/**
 * An `<svg>` element for `text`, drawn as one path.
 *
 * Error correction level M (~15%) is the usual choice for a screen: a QR on a monitor is
 * not getting scratched, and a higher level makes the code denser for no gain here.
 *
 * Type 0 asks the library to pick the smallest version that fits, so this does not need a
 * table of capacities that would have to stay in step with the input length.
 */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()

  const count = qr.getModuleCount()
  const size = count + MARGIN * 2

  // One path of rectangles rather than one <rect> per module: a version-6 code is ~1,700
  // modules, and 1,700 elements is a page the browser has to lay out.
  let d = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`
    }
  }

  // `viewBox` with no width/height, so the CSS decides how big it is. `shape-rendering`
  // stops the browser antialiasing module edges into grey seams, which scanners dislike.
  //
  // The colours are literal black and white, and deliberately NOT theme tokens: a QR code
  // needs maximum contrast in a fixed polarity to scan, and a dark theme rendering it in
  // reverse produces a code many readers refuse. This is the one place in the codebase
  // where a hardcoded colour is the correct answer.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `role="img" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path d="${d}" fill="#000"/></svg>`
}
