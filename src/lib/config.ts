// Бекенд застосунку — сайт (../web): його /api/* і /api/auth/*.
//
// Адреса сайту, по черзі:
// 1. EXPO_PUBLIC_API_URL з mobile/.env — якщо треба явно (Vercel, тунель).
// 2. У розробці — той самий компʼютер, з якого відкрито проєкт: його IP
//    береться з адреси Metro (`hostUri`, у браузері — адреса сторінки),
//    порт — сайту (5173). Мережа змінилась — адреса підхопиться сама.
//    Сайт має слухати мережу: `cd ../web && npm run dev -- --host`.
// 3. Прод — https://zunor.org.
//
// EXPO_PUBLIC_* вшивається в збірку й видна всім — лише адреси, без ключів.

import Constants from 'expo-constants'
import { Platform } from 'react-native'

const PRODUCTION_URL = 'https://zunor.org'
const DEV_SITE_PORT = 5173
const web = Platform.OS === 'web'

function devSiteUrl(): string | null {
  if (!__DEV__) return null
  // «172.20.10.2:8081» → «172.20.10.2»
  const host = web
    ? window.location.hostname
    : Constants.expoConfig?.hostUri?.split(':')[0]
  return host ? `http://${host}:${DEV_SITE_PORT}` : null
}

/** Сайт: його сторінки, яких у застосунку ще немає (реєстрація, онбординг). */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  devSiteUrl() ||
  PRODUCTION_URL
).replace(/\/+$/, '')

/**
 * Куди йдуть запити. На телефоні — прямо на сайт. У браузері (лише dev) —
 * на свою ж адресу: Metro пересилає /api/* на сайт
 * (scripts/dev-api-proxy.js), бо напряму заважають CORS і cookie.
 */
export const API_URL = web && __DEV__ ? window.location.origin : SITE_URL
