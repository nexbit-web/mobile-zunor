// Відкрити посилання, яке прийшло НЕ від нас: з тексту повідомлення, з
// картки посилання, з вкладення чату. Такий рядок пише інша людина, тож
// перш ніж віддати його системі, перевіряємо схему.
//
// Лише http(s). Усе інше (`intent:`, `file:`, `content:`, `tel:`, схеми
// інших застосунків) з чужого тексту не відкриваємо зовсім: на Android
// довільна схема — це запуск чужого застосунку чи системної дії від імені
// нашого. Регекс, а не `new URL`: розбір адреси в React Native реалізований
// не повністю, а нам потрібен лише початок рядка.

import * as WebBrowser from 'expo-web-browser'

const WEB_URL = /^https?:\/\/[^\s]+$/i

export function isWebUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length <= 2048 && WEB_URL.test(url)
}

/** Відкриває чуже посилання в браузері застосунку; не http(s) — нічого. */
export function openLink(url: unknown): void {
  if (!isWebUrl(url)) return
  void WebBrowser.openBrowserAsync(url).catch(() => {})
}

/** Посилання «Підключити Telegram» — лише справжній t.me. */
export function isTelegramLink(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('https://t.me/')
}
