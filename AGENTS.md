This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Zunor

Мобільний застосунок Zunor — сервісу замовлення прибирання. Окремий
репозиторій у робочій теці `zunor/` (карта проєктів і спільні правила —
`../AGENTS.md`). **Бекенд — сайт `../web`**: застосунок ходить у його
`/api/*`, вхід — його better-auth. Продукт і причини рішень —
`../web/MANIFESTO.md`, правила сервера — `../web/AGENTS.md`.

- **Нова можливість для сайту й застосунку** — спершу логіка й ендпоінт у
  `../web`, потім екран тут. Своєї бізнес-логіки (розсилка, статуси,
  доступ) застосунок не має: що можна й що видно — вирішує сервер.
- **Запити — лише через `api()` з `src/lib/api.ts`** (cookie сесії в
  заголовку, `credentials: 'omit'`, помилки — `ApiError`), дані — через
  TanStack Query. Свого `fetch` в екранах не пиши.
- **Браузер — лише для dev-перевірки інтерфейсу** (`web.output: single`).
  Там `/api/*` іде на адресу Metro, а `scripts/dev-api-proxy.js` пересилає
  його на сайт; сесія — cookie сайту, не SecureStore. Тому в екранах
  нічого лише-нативного без запасного шляху для web: `Alert.alert` у
  браузері мовчить — питання «так/ні» через `confirmAction()` з
  `src/lib/confirm.ts`.
- **Код сайту не імпортується шляхом `../web/...`** — збірка EAS клонує
  лише цей репозиторій. Потрібне чисте ядро — копія в `src/shared/` з
  поміткою, звідки взято; змінилось на сайті — зміни копію в тій самій
  задачі.
- **Контракт API**: сервер поля лише додає, тож нові поля в типах
  `src/shared/*` — опційні. Старі версії застосунку живуть місяцями.
- **Стилі — Uniwind (`className`, Tailwind 4).** Кольори — лише токени з
  `src/global.css`: мова iOS — темна тема на справжньому чорному
  (#000 → картки #1c1c1e → #2c2c2e), світла — «згрупована» (#f2f2f7 і
  білі картки); акцент і текст світлої — із сайту. Де `className` не
  дістає (вкладки, шапки, іконки, плейсхолдер) — `useColors()` з
  `src/lib/theme.ts`, а не hex у компоненті. Варіанти `first:`/`last:`
  тут не працюють — рядок отримує проп.
- **Каркас за роллю** (`app/(app)/_layout.tsx`): клієнт — бічна панель
  (`expo-router/drawer`, `components/drawer/*`) і чат із Zunor на весь
  екран, як застосунок ІІ; майстер — системні вкладки `NativeTabs`.
  Маршрути спільні; `TabStack` сам ставить кнопку меню (клієнт) і
  дзвіночок (усім). Для свайпу панелі корінь обгорнуто в
  `GestureHandlerRootView`.
- **Дзвіночок сповіщень** (`components/header-bell.tsx`) — праворуч у
  шапці кожного ГОЛОВНОГО екрана: розділи `TabStack`, налаштування,
  розмова з Zunor. Непрочитані — червоний кружечок із числом
  (`RoundButton badge`), лічильник — `useUnreadCount()` (один кеш
  `['badges']` і для бічної панелі). На екранах «вглиб» (заявка, розділи
  налаштувань, самі сповіщення) дзвіночка немає.
- **Перемикач розділів екрана** — `components/swipe-tabs.tsx`: доріжка з
  повзунком поверх сторінок, свайп будь-де на екрані, вібрація лише на
  натискання. Перемикач стоїть під великим заголовком і разом із ним
  підіймається, а потім «прилипає» під шапкою на тому ж напівпрозорому
  фоні; сторінка отримує `PageScroll` (відступ і прокрутку).
- **Іконки — системні** (`components/icons/glyph.tsx`, `<Glyph name="settings" />`):
  SF Symbols на iOS, Material Symbols на Android і в браузері
  (`expo-symbols`). Ними — кнопки, меню, бічна панель, плитки
  налаштувань (`ui/tile.tsx`: кольорова плитка з відблиском).
  Нова іконка — рядок у каталозі `GLYPHS` (обидві назви перевірити:
  SF — у `sf-symbols-typescript`, Material — у
  `expo-symbols/build/android/symbols.json`). Пласкі контурні іконки на
  телефоні виглядали дешево — саме тому системні.
- **Іконки послуг — ті самі, що на сайті** (`components/icons/service-icon.tsx`,
  копія `web/…/categories/cleaning/service-icon.svelte` на react-native-svg):
  контур кольором тексту й одна деталь кольором акценту, тож іконки самі
  йдуть за темою й акцентом. Скрізь, де видно послугу: картки заявок і
  замовлень, підказки в чаті, анкета асистента. Системних іконок для
  послуг немає. Змінилась іконка на сайті — перенести координати сюди.
- **Іконки сайту** — `components/icons/icon.tsx` (`<Icon name="send" />`)
  — лише там, де потрібна мова сайту: кнопка «Надіслати». Набір —
  копія web/…/icons/set; змінився на сайті — `node scripts/sync-icons.mjs`,
  `site-icons.ts` руками не правити. Hugeicons лишились у старих
  екранах (порожні стани, «незабаром») — нові місця ними не робити.
- **Шапка — своя** (`components/screen-header.tsx`), у подачі Apple:
  лежить ПОВЕРХ екрана (`headerTransparent`) і напівпрозора
  (`ui/backdrop.tsx`: розмиття + колір фону ~70%), без лінії знизу. Під
  нею — великий заголовок ліворуч; гортаєш — він їде під шапку, а в
  шапці зʼявляється маленька назва по центру. Тому кожен екран зі
  стековою шапкою гортається через `useLargeTitleScroll()`
  (`lib/large-title.ts`: Animated.ScrollView / Animated.FlatList,
  відступ згори, прокрутка → шапці) — інакше зміст заляже під шапку.
  Виняток — розмова з Zunor на головній: у неї своя смуга без заголовка.
  «‹ Назад» — шеврон і слово «Назад» кольору акценту, як у iOS (так
  попросив власник). Решта кнопок-іконок (меню, «⋯», дзвіночок,
  закрити) — лише іконка кольору тексту, без підкладки й контуру: сірі
  кружечки з обводкою виглядали дешево. Системну шапку не вмикати: вона
  не дає нашого заголовка й кнопок. Екрани вглиб (заявка,
  налаштування, сповіщення) — у корені `app/`, поверх усього.
- **Налаштування** — у подачі Telegram (`components/settings/list.tsx`):
  `Section` (картка-група, лінії між рядками ставить сама), `Row`
  (кольорова плитка `TINT` + назва + значення + шеврон), `ActionRow`
  («Вийти», «Змінити фото»), `FieldRow`/`AreaField` (поля прямо в
  картці), `HeaderPill` / `HeaderSave` («Змінити» → «Зберегти» в шапці; свій
  `headerLeft` екрана, напр. «Скасувати», шапка ставить замість «Назад»), `QueryGate` (спінер /
  помилка з повтором). Кольори плиток — системні iOS, не акцент і не
  тема: вони лише розрізняють розділи. Дані розділів — ті самі, що на
  сайті (`web/src/lib/server/settings-data.ts`).
- **Картки й контур.** Картки й групи (заявка, замовлення, налаштування,
  підказки) — без контуру: `bg-card`/`bg-shell` на фоні, кути
  «суперелипсом» (`borderCurve: 'continuous'`, `SQUIRCLE`), як в iOS.
  Обводок немає ніде — ні в полів вводу, ні в чіпів, меню чи кнопок:
  поверхню відділяє заливка на шар вище (поле на фоні — `shell`/`field`,
  поле на картці — `secondary`). Кнопки з текстом — `primary` чи сіра
  `secondary`. `border-border` (8%) — лише лінії-розділювачі.
- **Бічна панель** — шар `card` (#1c1c1e у темній): так вона відділяється
  від чорного екрана, що відʼїхав.
- **Файли в `fetch`.** Глобальний `fetch` у SDK 58 — `expo/fetch`, і
  частину форми у вигляді `{ uri, name, type }` (старий спосіб React
  Native) він не приймає — кидає «Unsupported FormDataPart». Файл у
  `FormData` — лише `new File(uri)` з `expo-file-system`
  (`lib/upload.ts`).
- **Тексти інтерфейсу — українською**, тон теплий і людяний, як на сайті.
  Коментарі в коді — українською, ідентифікатори — англійською.
- **Стиль коду** — `.prettierrc`: одинарні лапки, без крапки з комою.
- Перевірка перед «готово»: `npm run typecheck` і `npx expo-doctor`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
