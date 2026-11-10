import { Text, View } from 'react-native'

import { parseMessage, type Span } from '@/shared/zunor'

/**
 * Відповідь Zunor: абзаци, списки, **жирне** — без розмітки з тексту моделі
 * (вона лише ділиться на шматки, shared/zunor.ts).
 */
export function MessageText({ text }: { text: string }) {
  const blocks = parseMessage(text)
  return (
    <View className="gap-2.5">
      {blocks.map((block, i) =>
        block.kind === 'paragraph' ? (
          <Text key={i} className="text-[16px] leading-[23px] text-foreground">
            <Spans spans={block.spans} />
          </Text>
        ) : (
          <View key={i} className="gap-1.5">
            {block.items.map((item, j) => (
              <View key={j} className="flex-row gap-2 pr-2">
                <Text className="min-w-[16px] text-[16px] leading-[23px] text-muted-foreground">
                  {block.ordered ? `${block.start + j}.` : '•'}
                </Text>
                <Text className="flex-1 text-[16px] leading-[23px] text-foreground">
                  {item.term ? (
                    <Text className="font-semibold">{item.term} — </Text>
                  ) : null}
                  <Spans spans={item.spans} />
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  )
}

function Spans({ spans }: { spans: Span[] }) {
  return spans.map((s, i) =>
    s.strong ? (
      <Text key={i} className="font-semibold">
        {s.text}
      </Text>
    ) : (
      s.text
    ),
  )
}
