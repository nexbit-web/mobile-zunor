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

// Uniwind — Tailwind 4 для React Native. Обгортка мусить бути зовнішньою,
// якщо колись додасться ще якась. Типи класів генеруються під час старту
// Metro в src/uniwind-types.d.ts.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})
