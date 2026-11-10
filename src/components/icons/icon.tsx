import Svg, { Circle, Path } from 'react-native-svg'

import { SITE_ICONS, type IconNode, type SiteIconName } from './site-icons'

export type { SiteIconName }

/**
 * Іконка з набору сайту (site-icons.ts — копія web/…/icons/set). Ті самі
 * атрибути лінії, що в stroke-icon.svelte: 1.5, круглі кінці й зʼєднання.
 * `fill` — для суцільних (квадрат «Стоп»).
 */
export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.5,
  fill = 'none',
}: {
  name: SiteIconName
  size?: number
  color: string
  strokeWidth?: number
  fill?: string
}) {
  const icon = SITE_ICONS[name]
  const nodes: readonly IconNode[] = icon.nodes
  return (
    <Svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {nodes.map(([kind, attrs], i) =>
        kind === 'circle' ? (
          <Circle
            key={i}
            cx={attrs.cx}
            cy={attrs.cy}
            r={attrs.r}
            strokeLinecap={attrs.strokeLinecap}
          />
        ) : (
          <Path key={i} d={attrs.d} strokeLinecap={attrs.strokeLinecap} />
        ),
      )}
    </Svg>
  )
}
