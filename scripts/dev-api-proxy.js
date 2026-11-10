// Прокси /api/* для приложения в браузере — только dev (`npm run web`).
//
// В браузере приложение открыто с адреса Metro (http://localhost:8081 или
// http://<IP компьютера>:8081), а сайт — на другом адресе (Vercel или
// локальный dev). Ходить туда напрямую мешают CORS и cookie: в браузере
// сессия — httpOnly cookie сайта, SecureStore там нет. Поэтому приложение
// ходит на свой же адрес, а Metro пересылает /api/* на сайт.
//
// Что меняется по дороге:
// - Origin нашей страницы → адрес сайта: better-auth пускает только свои
//   trustedOrigins. Чужой Origin (другая вкладка на localhost) не трогаем —
//   сайт его отклонит, и прокси не «отмывает» запросы чужих страниц.
// - Сайт на https называет cookie `__Secure-zunor.*` с флагом Secure, а по
//   http (адрес Metro в сети) браузер такие не сохранит. В ответе снимаем
//   префикс и Secure, в запросе возвращаем префикс.
//
// В сборку приложения этот файл не попадает: его подключает
// metro.config.js, то есть только dev-сервер на компьютере.

const { Readable } = require('node:stream')

// Заголовки соединения и то, что fetch выставит сам.
const DROP_REQUEST = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-connection',
  'content-length',
  'accept-encoding',
])

// fetch уже распаковал тело — его длина и сжатие больше не те.
const DROP_RESPONSE = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'set-cookie',
])

const SECURE_PREFIX = '__Secure-'

/** @param {string} target адрес сайта без слеша в конце */
function createApiProxy(target) {
  const site = new URL(target)
  const secureCookies = site.protocol === 'https:'

  return async function apiProxy(req, res, next) {
    if (!req.url || !req.url.startsWith('/api/')) return next()

    try {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) {
        if (value === undefined || DROP_REQUEST.has(name)) continue
        headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }

      const own = `http://${req.headers.host}`
      if (headers.get('origin') === own) headers.set('origin', site.origin)
      const referer = headers.get('referer')
      if (referer && referer.startsWith(`${own}/`)) {
        headers.set('referer', site.origin + referer.slice(own.length))
      }
      const cookie = headers.get('cookie')
      if (cookie && secureCookies) headers.set('cookie', toSiteCookies(cookie))

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const upstream = await fetch(new URL(req.url, site), {
        method: req.method,
        headers,
        body: hasBody ? await readBody(req) : undefined,
        redirect: 'manual',
      })

      res.statusCode = upstream.status
      upstream.headers.forEach((value, name) => {
        if (!DROP_RESPONSE.has(name)) res.setHeader(name, value)
      })
      const setCookies = upstream.headers.getSetCookie().map(toLocalSetCookie)
      if (setCookies.length) res.setHeader('set-cookie', setCookies)

      if (!upstream.body) return res.end()
      // Потоком, а не целиком: ответы чата с Zunor идут кусками.
      Readable.fromWeb(upstream.body)
        .on('error', () => res.destroy())
        .pipe(res)
    } catch (err) {
      console.error(`[api-proxy] ${req.method} ${req.url}: ${err.message}`)
      if (res.headersSent) return res.destroy()
      res.statusCode = 502
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message: `Сайт ${site.origin} не відповідає` }))
    }
  }
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : undefined
}

/** `zunor.session_token=…` → `__Secure-zunor.session_token=…` */
function toSiteCookies(header) {
  return header
    .split(/;\s*/)
    .map((pair) => (pair.startsWith('zunor.') ? SECURE_PREFIX + pair : pair))
    .join('; ')
}

/** Cookie сайта → cookie, которую браузер примет на http-адресе Metro. */
function toLocalSetCookie(cookie) {
  return cookie
    .replace(/^__(Secure|Host)-/, '')
    .replace(/;\s*Secure(?=;|$)/gi, '')
    .replace(/;\s*Partitioned(?=;|$)/gi, '')
    .replace(/;\s*Domain=[^;]*/gi, '')
}

module.exports = { createApiProxy }
