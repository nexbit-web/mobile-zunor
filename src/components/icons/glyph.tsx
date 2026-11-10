import {
  SymbolView,
  type AndroidSymbol,
  type SFSymbol,
  type SymbolWeight,
} from 'expo-symbols'

/**
 * Системні іконки — SF Symbols на iOS (ті самі, що в налаштуваннях iPhone
 * і в Telegram), Material Symbols на Android і в браузері. Ними — кнопки
 * й меню застосунку та плитки налаштувань: так інтерфейс виглядає рідним
 * для телефона. Іконки сайту (`<Icon>`) лишаються там, де потрібна саме
 * мова сайту (кнопка «Надіслати», знак Zunor).
 *
 * Каталог — одне місце, де назва дії стає парою іконок: в екранах лише
 * `<Glyph name="settings" />`.
 */
const GLYPHS = {
  // ─── Навігація й кнопки ───
  back: { ios: 'chevron.left', android: 'chevron_left' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  external: { ios: 'arrow.up.right', android: 'north_east' },
  close: { ios: 'xmark', android: 'close' },
  menu: { ios: 'line.3.horizontal', android: 'menu' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  plus: { ios: 'plus', android: 'add' },
  down: { ios: 'arrow.down', android: 'arrow_downward' },
  stop: { ios: 'stop.fill', android: 'stop' },
  check: { ios: 'checkmark', android: 'check' },
  search: { ios: 'magnifyingglass', android: 'search' },
  compose: { ios: 'square.and.pencil', android: 'edit_square' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  document: { ios: 'doc.text', android: 'description' },
  tune: { ios: 'slider.horizontal.3', android: 'tune' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off' },

  // ─── Факти картки заявки / замовлення ───
  wallet: { ios: 'banknote', android: 'payments' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  person: { ios: 'person', android: 'person' },
  star: { ios: 'star.fill', android: 'star' },
  clock: { ios: 'clock', android: 'schedule' },
  fresh: { ios: 'flame.fill', android: 'local_fire_department' },

  // ─── Порожні стани ───
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  inbox: { ios: 'tray', android: 'inbox' },
  done: { ios: 'checkmark.seal.fill', android: 'verified' },
  cancelled: { ios: 'xmark.circle', android: 'cancel' },
  findJobs: { ios: 'doc.text.magnifyingglass', android: 'find_in_page' },

  // ─── Розділи ───
  orders: { ios: 'briefcase', android: 'work' },
  chats: { ios: 'bubble.left', android: 'chat_bubble' },
  bell: { ios: 'bell', android: 'notifications' },
  settings: { ios: 'gearshape', android: 'settings' },

  // ─── Плитки налаштувань (суцільні, як у Telegram) ───
  profile: { ios: 'person.fill', android: 'person' },
  security: { ios: 'lock.fill', android: 'lock' },
  notifications: { ios: 'bell.badge.fill', android: 'notifications' },
  appearance: { ios: 'circle.lefthalf.filled', android: 'contrast' },
  assistant: { ios: 'sparkles', android: 'auto_awesome' },
  help: { ios: 'questionmark.bubble.fill', android: 'help' },
  website: { ios: 'link', android: 'link' },
  mail: { ios: 'envelope.fill', android: 'mail' },
  key: { ios: 'key.fill', android: 'key' },
  telegram: { ios: 'paperplane.fill', android: 'send' },
  push: { ios: 'app.badge.fill', android: 'app_badging' },
  briefcase: { ios: 'briefcase.fill', android: 'work' },
  box: { ios: 'shippingbox.fill', android: 'inventory_2' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  photo: { ios: 'photo.on.rectangle', android: 'add_photo_alternate' },

  // Послуг тут немає навмисно: вони — іконками сайту (icons/service-icon).

  // ─── Тип помешкання (анкета асистента) ───
  apartment: { ios: 'building.2.fill', android: 'apartment' },
  house: { ios: 'house.fill', android: 'home' },
  office: { ios: 'briefcase.fill', android: 'business_center' },
  commercial: { ios: 'storefront.fill', android: 'storefront' },
  other: { ios: 'square.grid.2x2.fill', android: 'category' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>

export type GlyphName = keyof typeof GLYPHS

export function Glyph({
  name,
  size = 22,
  color,
  weight = 'regular',
}: {
  name: GlyphName
  size?: number
  color: string
  weight?: SymbolWeight
}) {
  const g = GLYPHS[name]
  return (
    <SymbolView
      name={{ ios: g.ios, android: g.android, web: g.android }}
      size={size}
      tintColor={color}
      weight={weight}
      type="monochrome"
      resizeMode="scaleAspectFit"
    />
  )
}
