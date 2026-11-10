// Чат із Zunor — КОПІЇ з сайту:
// - контракт /api/zunor/chat — web/src/lib/types/zunor.ts;
// - розбір формату відповіді — web/src/lib/zunor/message-format.ts;
// - очищення тексту під час друку — visibleText/normalizeMarkers зі
//   сторінки web/src/routes/(auth)/dashboard/jobs/new/+page.svelte.
// Змінився протокол на сайті — зміни й тут (../AGENTS.md).

export interface ZunorClientMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ZunorDraft {
  /** Дані заявки — сервер уже перевірив; застосунок їх не читає, а лише
   *  повертає в POST /api/jobs як є. */
  metadata: Record<string, unknown>
  title: string
  /** Опис для майстра ('' — модель не впоралась). */
  description: string
  /** Рядки картки: «Помешкання — Квартира». */
  summary: Array<{ label: string; value: string; icon?: string }>
}

export type ZunorResponse =
  | { kind: 'message'; reply: string; suggestions?: string[] }
  | { kind: 'draft'; reply: string; draft: ZunorDraft }

// ─── Формат відповіді ───
// Порожній рядок — абзац; «— пункт» — список; «1. крок» — нумерований;
// **слово** — напівжирне. Незакрите ** під час друку вважається відкритим.

export interface Span {
  text: string
  strong: boolean
}

export interface ListItem {
  /** Термін до « — » («Назва — опис»), інакше null. */
  term: string | null
  spans: Span[]
}

export type Block =
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'list'; ordered: false; items: ListItem[] }
  | { kind: 'list'; ordered: true; start: number; items: ListItem[] }

const BULLET = /^— /
const ORDERED = /^(\d{1,2})[.)]\s+/
const MAX_TERM_WORDS = 4

export function parseInline(text: string): Span[] {
  const spans: Span[] = []
  text.split('**').forEach((part, i) => {
    if (part) spans.push({ text: part, strong: i % 2 === 1 })
  })
  return spans
}

function listItem(line: string): ListItem {
  const at = line.indexOf(' — ')
  if (at !== -1) {
    const term = line.slice(0, at).replaceAll('**', '').trim()
    if (term && term.split(/\s+/).length <= MAX_TERM_WORDS) {
      return { term, spans: parseInline(line.slice(at + 3).trim()) }
    }
  }
  return { term: null, spans: parseInline(line) }
}

type LineKind = 'text' | 'bullet' | 'ordered'

function kindOf(line: string): LineKind {
  if (BULLET.test(line)) return 'bullet'
  if (ORDERED.test(line)) return 'ordered'
  return 'text'
}

export function parseMessage(text: string): Block[] {
  const out: Block[] = []

  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    let group: string[] = []
    let kind: LineKind | null = null

    const flush = () => {
      if (!group.length || !kind) return
      if (kind === 'text') {
        out.push({ kind: 'paragraph', spans: parseInline(group.join(' ')) })
      } else if (kind === 'bullet') {
        out.push({
          kind: 'list',
          ordered: false,
          items: group.map((l) => listItem(l.replace(BULLET, '').trim())),
        })
      } else {
        out.push({
          kind: 'list',
          ordered: true,
          start: Number(ORDERED.exec(group[0])?.[1] ?? 1),
          items: group.map((l) => listItem(l.replace(ORDERED, '').trim())),
        })
      }
      group = []
    }

    for (const line of lines) {
      const next = kindOf(line)
      if (kind !== null && next !== kind) flush()
      kind = next
      group.push(line)
    }
    flush()
  }

  return out
}

/**
 * Текст, що друкується: рядок «>>> кнопки» ховаємо (кнопки прийдуть у
 * фіналі), хвіст «>»/«>>» теж, а маркери `* `/`- ` зводимо до «— », як
 * сервер робить із фіналом.
 */
export function visibleText(raw: string): string {
  const idx = raw.indexOf('>>>')
  let body: string
  if (idx !== -1) {
    body = raw.slice(0, idx).trimEnd()
  } else {
    const tail = raw.match(/>{1,2}$/)
    body = tail ? raw.slice(0, raw.length - tail[0].length) : raw
  }
  return body.replace(/^[ \t]*[*\-•][ \t]+/gm, '— ')
}
