import Svg, { Path } from 'react-native-svg'

/**
 * Галочки біля свого повідомлення, як у Telegram: одна — доставлено на
 * сервер, дві — співрозмовник прочитав (`peerLastReadAt`, не мій
 * lastReadAt). Своїм SVG: у SF Symbols і Material подвійної галочки
 * потрібної форми немає.
 */
export function Ticks({
  read,
  color,
  size = 16,
}: {
  read: boolean
  color: string
  size?: number
}) {
  return (
    <Svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 16 11"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={read ? 'M1 5.9l2.9 2.9L9.6 2.2' : 'M3 5.9l2.9 2.9 5.7-6.6'} />
      {read ? <Path d="M6.4 7.9l0.9 0.9 5.7-6.6" /> : null}
    </Svg>
  )
}
