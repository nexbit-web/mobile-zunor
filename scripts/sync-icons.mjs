// Копіює набір іконок сайту (../web/src/lib/components/icons/set/*.svelte)
// у src/components/icons/site-icons.ts — щоб застосунок і сайт мали ОДНІ
// іконки: ті самі контури, ту саму товщину лінії.
//
// Запуск — вручну, коли на сайті додали чи змінили іконку:
//   node scripts/sync-icons.mjs
// Результат комітиться: EAS-збірка клонує лише цей репозиторій, тож
// імпортувати ../web під час збірки не можна (../AGENTS.md).

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const setDir = join(root, '..', 'web', 'src', 'lib', 'components', 'icons', 'set')
const outFile = join(root, 'src', 'components', 'icons', 'site-icons.ts')

const icons = {}
for (const file of readdirSync(setDir).filter((f) => f.endsWith('.svelte')).sort()) {
  const src = readFileSync(join(setDir, file), 'utf8')
  const body = src.match(/<StrokeIcon([^>]*)>([\s\S]*?)<\/StrokeIcon>/)
  if (!body) throw new Error(`${file}: немає <StrokeIcon>`)
  const viewBox = body[1].match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24'

  const nodes = []
  for (const el of body[2].matchAll(/<(path|circle)\b([\s\S]*?)\/>/g)) {
    const attrs = {}
    for (const a of el[2].matchAll(/([a-z-]+)="([^"]*)"/g)) {
      attrs[a[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = a[2]
    }
    nodes.push([el[1], attrs])
  }
  if (!nodes.length) throw new Error(`${file}: немає контурів`)
  icons[file.replace(/\.svelte$/, '')] = { viewBox, nodes }
}

const out = `// ЗГЕНЕРОВАНО scripts/sync-icons.mjs з ../web/src/lib/components/icons/set
// — не правити руками. Набір сайту: Hugeicons Stroke Rounded, сітка 24×24.
/* eslint-disable */

/** Лінія за замовчуванням — кругла; кілька контурів на сайті її міняють. */
type Cap = { strokeLinecap?: 'round' | 'square' | 'butt' }

export type IconNode =
  | ['path', { d: string } & Cap]
  | ['circle', { cx: string; cy: string; r: string } & Cap]

export const SITE_ICONS = ${JSON.stringify(icons, null, 2)} as const satisfies Record<
  string,
  { viewBox: string; nodes: readonly IconNode[] }
>

export type SiteIconName = keyof typeof SITE_ICONS
`
writeFileSync(outFile, out)
console.log(`${Object.keys(icons).length} іконок → ${outFile}`)
