import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

/**
 * Шпалери розмови в браузері (dev-перевірка): Skia там потребує окремого
 * завантаження CanvasKit, тож малюємо звичайними картинками — сам браузер
 * розбирає SVG миттєво. Вигляд той самий, що в chat-background.tsx.
 */
const PATTERN = require('../../../assets/images/chat-pattern.svg')
const MESH = require('../../../assets/images/chat-mesh-light.png')
const RATIO = 2960 / 1440
const TILE = 460

export function ChatBackground() {
  const dark = useColorScheme() === 'dark'
  const [size, setSize] = useState({ width: 0, height: 0 })
  const tileH = TILE * RATIO
  const cols = Math.max(1, Math.ceil(size.width / TILE))
  const rows = Math.max(1, Math.ceil(size.height / tileH))
  const tiles = (ink: string) =>
    size.width > 0
      ? Array.from({ length: rows * cols }, (_, i) => (
          <Image
            key={i}
            source={PATTERN}
            contentFit="fill"
            tintColor={ink}
            style={{
              position: 'absolute',
              left: (i % cols) * TILE,
              top: Math.floor(i / cols) * tileH,
              width: TILE,
              height: tileH,
            }}
          />
        ))
      : null

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { isolation: 'isolate' }]}
      onLayout={(e) =>
        setSize({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      {dark ? (
        // Спрощено (лише dev): на телефоні узор — градієнтом Telegram
        // (chat-background.tsx, MESH_DARK), тут — його фіолетовим.
        <View style={[StyleSheet.absoluteFill, { opacity: 0.38 }]}>
          {tiles('#962fbf')}
        </View>
      ) : (
        <>
          <Image source={MESH} contentFit="fill" style={StyleSheet.absoluteFill} />
          <View
            style={[
              StyleSheet.absoluteFill,
              { opacity: 0.5, mixBlendMode: 'soft-light' },
            ]}
          >
            {tiles('#000000')}
          </View>
        </>
      )}
    </View>
  )
}
