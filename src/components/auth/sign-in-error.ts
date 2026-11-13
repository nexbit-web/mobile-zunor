// Текст помилки входу — для пошти з паролем і для Google (welcome).
// За кодом better-auth, а не за статусом: 403 — це і «пошту не
// підтверджено», і «чужа адреса застосунку» (INVALID_ORIGIN), а людині
// треба різне.
export function signInError(err: {
  status: number
  code?: string
  message?: string
}): string {
  if (err.code === 'INVALID_EMAIL_OR_PASSWORD' || err.status === 401)
    return 'Невірна пошта або пароль'
  if (err.code === 'EMAIL_NOT_VERIFIED')
    // Сюди — лише якщо новий код надіслати не вдалось (вхід шле його сам
    // і веде на verify-email).
    return 'Пошту ще не підтверджено, а код надіслати не вдалося. Спробуйте ще раз'
  // Чужа адреса застосунку: Origin запиту чи адреса повернення з Google
  // (exp:// в Expo Go) не в trustedOrigins сервера.
  if (
    err.code === 'INVALID_ORIGIN' ||
    err.code === 'INVALID_CALLBACK_URL' ||
    err.code === 'INVALID_ERROR_CALLBACK_URL'
  )
    return __DEV__
      ? 'Сервер не пускає вхід з Expo Go: на ньому потрібен ZUNOR_EXPO_GO=1 (web/docs/deploy-vercel.md)'
      : 'Ця версія застосунку застаріла. Оновіть її'
  if (err.status === 429) return 'Забагато спроб. Спробуйте за хвилину'
  return err.message || 'Не вдалося увійти. Спробуйте ще раз'
}
