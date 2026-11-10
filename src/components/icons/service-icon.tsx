import { View } from 'react-native'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'

import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'

/**
 * Іконки послуг — ті самі, що на сайті (web/…/categories/cleaning/
 * service-icon.svelte), перемальовані на react-native-svg. Змінились там —
 * поміняй і тут, координати один в один.
 *
 * Мова набору: сітка 24, контур 1.6 з круглими кінцями кольором тексту,
 * тіло предмета ледь залите тим самим кольором, і рівно ОДНА деталь
 * кольором акценту — піна, відблиск, іскра. Тож іконки самі йдуть за
 * темою й за акцентом, який людина обрала у «Вигляді».
 *
 * Невідома послуга (і стара заявка без неї) — відро, як на сайті.
 */
export function ServiceIcon({
  service,
  size = 24,
  color,
  accent,
}: {
  service: unknown
  size?: number
  /** Контур і тіло; за замовчуванням — колір тексту. */
  color?: string
  /** Одна деталь; за замовчуванням — акцент. */
  accent?: string
}) {
  const c = useColors()
  const ink = color ?? c.foreground
  const acc = accent ?? c.primary

  // Ролі з svelte-файлу: .b — тіло, .a — контур акцентом, .a-fill —
  // залита деталь акцентом, .dot — приглушені клітинки календаря.
  const b = { fill: ink, fillOpacity: 0.1 }
  const a = { stroke: acc }
  const aFill = { fill: acc, stroke: 'none' }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G
        fill="none"
        stroke={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {service === 'standard' ? (
          // Звичайне — пульверизатор
          <>
            <Path
              {...b}
              d="M8.2 11h5.6a1.2 1.2 0 0 1 1.2 1.2V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6.8A1.2 1.2 0 0 1 8.2 11Z"
            />
            <Path d="M9.4 11V8.6h3.2V11" />
            <Path d="M8.6 8.6h5.2l1.6-2.1V5.1a1.1 1.1 0 0 0-1.1-1.1H9.2a1.1 1.1 0 0 0-1.1 1.1v1.4" />
            <Path d="M15.4 5h1.5M9.4 15.2h3.2" />
            <G {...aFill}>
              <Circle cx={19.4} cy={3.4} r={0.9} />
              <Circle cx={20.6} cy={6} r={0.9} />
              <Circle cx={19.4} cy={8.6} r={0.9} />
            </G>
          </>
        ) : service === 'post-renovation' ? (
          // Після ремонту — валик
          <>
            <Rect {...b} x={3.6} y={3.4} width={13.4} height={5.6} rx={2} />
            <Path d="M17 6.2h2.2a1.1 1.1 0 0 1 1.1 1.1v3.2a1.1 1.1 0 0 1-1.1 1.1h-6.9a1.1 1.1 0 0 0-1.1 1.1V14" />
            <Rect {...b} x={9.9} y={14} width={2.6} height={7} rx={1.1} />
            <Path {...a} d="M6.6 6.2h4.6" />
            <Path
              {...aFill}
              d="M5.2 13.4c.25 1.05.75 1.55 1.8 1.8-1.05.25-1.55.75-1.8 1.8-.25-1.05-.75-1.55-1.8-1.8 1.05-.25 1.55-.75 1.8-1.8Z"
            />
          </>
        ) : service === 'windows' ? (
          // Миття вікон — вікно з відблиском
          <>
            <Rect {...b} x={4.5} y={3.2} width={15} height={15.6} rx={1.6} />
            <Path d="M12 3.2v15.6M4.5 11h15M3 21h18" />
            <Path {...a} d="M6.8 8.6 9.6 5.8M7 10.6l4-4M14.4 16.4l2.6-2.6" />
          </>
        ) : service === 'sofa' ? (
          // Хімчистка — диван із бульбашками
          <>
            <Path d="M6 11.3V8.8A2.6 2.6 0 0 1 8.6 6.2h6.8A2.6 2.6 0 0 1 18 8.8v2.5" />
            <Path
              {...b}
              d="M5 11.2a2 2 0 0 0-2 2v4.1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-4.1a2 2 0 0 0-4 0v1.3H7v-1.3a2 2 0 0 0-2-2Z"
            />
            <Path d="M12 6.2v8.3M6 18.3V20M18 18.3V20" />
            <G {...a}>
              <Circle cx={19.2} cy={3.6} r={1.5} />
              <Circle cx={21.4} cy={7} r={0.8} />
            </G>
          </>
        ) : service === 'regular' ? (
          // Регулярне — той самий день щотижня позначений акцентом
          <>
            <Rect {...b} x={3.6} y={5} width={16.8} height={15.6} rx={2.4} />
            <Path d="M8 3.2v3.4M16 3.2v3.4M3.6 9.6h16.8" />
            <G fill={ink} stroke="none" opacity={0.45}>
              <Circle cx={12} cy={13.3} r={1} />
              <Circle cx={16} cy={13.3} r={1} />
              <Circle cx={12} cy={17} r={1} />
              <Circle cx={16} cy={17} r={1} />
            </G>
            <G {...aFill}>
              <Circle cx={8} cy={13.3} r={1.35} />
              <Circle cx={8} cy={17} r={1.35} />
            </G>
          </>
        ) : (
          // Генеральне (і заявка без послуги) — відро з піною та іскрою
          <>
            <Path {...b} d="M5.2 11.5h13.6l-1.4 8a2 2 0 0 1-2 1.7H8.6a2 2 0 0 1-2-1.7Z" />
            <Path d="M4.2 11.5h15.6M6.3 15.4h11.4" />
            <Path d="M7.1 11.4a2 2 0 0 1 1.9-2.6 2.6 2.6 0 0 1 4.9-.3 1.9 1.9 0 0 1 2.9 2.9" />
            <Path
              {...aFill}
              d="M19 2.2c.3 1.3.9 1.9 2.2 2.2-1.3.3-1.9.9-2.2 2.2-.3-1.3-.9-1.9-2.2-2.2 1.3-.3 1.9-.9 2.2-2.2Z"
            />
          </>
        )}
      </G>
    </Svg>
  )
}

/**
 * Іконка послуги на плитці — для шапки картки й підказок у чаті. Плитка
 * нейтральна (шар `secondary`): колір тут несе лише деталь-акцент, тож
 * зміна акценту у «Вигляді» перефарбовує всі послуги разом.
 */
export function ServiceBadge({
  service,
  size = 42,
}: {
  service: unknown
  size?: number
}) {
  return (
    <View
      className="items-center justify-center bg-secondary"
      style={[
        SQUIRCLE,
        { width: size, height: size, borderRadius: Math.round(size * 0.27) },
      ]}
    >
      <ServiceIcon service={service} size={Math.round(size * 0.62)} />
    </View>
  )
}
