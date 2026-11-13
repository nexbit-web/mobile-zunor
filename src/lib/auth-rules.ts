// Межі полів входу, реєстрації й відновлення пароля — як у формах сайту
// (web/…/components/signup-form.svelte, routes/(auth)/user/forgot).
// Авторитет — сервер (better-auth: пароль 8–128); тут — лише щоб людина
// дізналась про помилку з поля, а не з відповіді сервера.

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export function validEmail(email: string): boolean {
  const t = email.trim()
  return t.length >= 3 && t.length <= 254 && EMAIL_RE.test(t)
}

export function validName(name: string): boolean {
  const t = name.trim()
  return t.length >= 2 && t.length <= 50
}

export function validPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX
}
