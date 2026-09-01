export type Shade = {
  base: string
  light: string
  deep: string
  pale: string
  tint: [string, string, string]
}

export type Palette = { girl: Shade; boy: Shade }

const HEX = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`
}

function toward(from: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = channels(from)
  const [tr, tg, tb] = target
  return hex([r + (tr - r) * amount, g + (tg - g) * amount, b + (tb - b) * amount])
}

const WHITE: [number, number, number] = [255, 255, 255]

function shade(base: string): Shade {
  return {
    base,
    light: toward(base, WHITE, 0.35),
    // Scaling the channels darkens without shifting hue, so any colour the
    // creator picks keeps its identity in borders and drop shadows.
    deep: hex(channels(base).map((c) => c * 0.82) as [number, number, number]),
    pale: toward(base, WHITE, 0.78),
    tint: [toward(base, WHITE, 0.8), toward(base, WHITE, 0.88), toward(base, WHITE, 0.96)],
  }
}

/**
 * Two chosen colours become the whole theme.
 *
 * Derived here on the server rather than with `color-mix` in CSS: a custom
 * property substitutes its `var()` references at the element where it is
 * declared, so tokens derived in `:root` would ignore an override further down
 * the tree — and older Safari has no `color-mix` at all.
 */
export function derivePalette(girl: string, boy: string): Palette {
  return { girl: shade(girl), boy: shade(boy) }
}

/** The custom properties a page sets to wear this palette. */
export function paletteVars(palette: Palette): Record<string, string> {
  return {
    '--girl': palette.girl.base,
    '--girl-light': palette.girl.light,
    '--girl-deep': palette.girl.deep,
    '--girl-pale': palette.girl.pale,
    '--boy': palette.boy.base,
    '--boy-light': palette.boy.light,
    '--boy-deep': palette.boy.deep,
    '--boy-pale': palette.boy.pale,
  }
}
