const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')
const { createApiProxy } = require('./scripts/dev-api-proxy')

const config = getDefaultConfig(__dirname)

// Приложение в браузере ходит в API на свой же адрес, а Metro пересылает
// /api/* на сайт (scripts/dev-api-proxy.js). Сайт — EXPO_PUBLIC_API_URL из
// .env, без него — локальный dev-сайт. Телефону (Expo Go) прокси не нужен:
// он ходит на сайт напрямую.
const apiProxy = createApiProxy(
  (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5173').replace(
    /\/+$/,
    '',
  ),
)
const previousMiddleware = config.server.enhanceMiddleware
config.server.enhanceMiddleware = (middleware, server) => {
  const metro = previousMiddleware
    ? previousMiddleware(middleware, server)
    : middleware
  return (req, res, next) => apiProxy(req, res, () => metro(req, res, next))
}

function throttleStore(store, max) {
  let active = 0
  const queue = []
  const run = (task) =>
    new Promise((resolve, reject) => {
      const start = () => {
        active++
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            active--
            queue.shift()?.()
          })
      }
      if (active < max) start()
      else queue.push(start)
    })
  return {
    get: (key) => run(() => store.get(key)),
    set: (key, value) => run(() => store.set(key, value)),
    clear: () => store.clear(),
  }
}

// Uniwind — Tailwind 4 для React Native. Типи класів генеруються під час
// старту Metro в src/uniwind-types.d.ts.
const finalConfig = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})

// Windows: обходячи залежності, Metro читає кеш тисячами файлів РАЗОМ (без
// обмеження) і впирається в ліміт відкритих файлів — «EMFILE: too many open
// files» посеред збірки. Пропускаємо до 32 читань/записів одночасно, решта
// чекає в черзі: на швидкість це майже не впливає.
//
// САМЕ ТУТ, ПІСЛЯ withUniwindConfig: Uniwind підміняє cacheStores своїм
// сховищем, і обмеження, поставлене до нього, мовчки зникало.
if (process.platform === 'win32') {
  finalConfig.cacheStores = (finalConfig.cacheStores ?? []).map((store) =>
    throttleStore(store, 32),
  )
}

module.exports = finalConfig
