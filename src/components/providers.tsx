import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import * as Network from 'expo-network'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Один повтор: Neon міг прокидатись. Більше — людина довго дивиться
      // на спінер замість помилки з кнопкою «Спробувати ще».
      retry: 1,
      staleTime: 30_000,
    },
  },
})

// На телефоні немає «фокусу вікна» — свіжі дані, коли людина повернулась
// у застосунок.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) =>
    handleFocus(state === 'active'),
  )
  return () => sub.remove()
})

// Без мережі запити чекають, а не падають; зʼявилась — дотягуються самі.
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((state) =>
    setOnline(state.isConnected !== false),
  )
  return () => sub.remove()
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

export { queryClient }
