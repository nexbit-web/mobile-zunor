// Відповіді ендпоінтів налаштувань — копія форм із
// web/src/lib/server/settings-data.ts. Міняється там — міняй і тут.

/** GET /api/me/profile */
export interface ProfileData {
  user: {
    name: string | null
    email: string
    phone: string | null
    avatar: string | null
    avatarPublicId: string | null
    city: string | null
    district: string | null
    bio: string | null
    role: string
    onboarded: boolean
  }
  cities: { slug: string; name: string }[]
  districts: {
    citySlug: string
    slug: string
    name: string
    group: 'CITY' | 'SUBURB'
  }[]
}

/** GET /api/me/security */
export interface SecurityData {
  hasPassword: boolean
  hasGoogle: boolean
  email: string
  activeOrders: number
}

/** GET /api/telegram/link — null: бот на сервері не налаштований. */
export interface NotificationsData {
  telegram: { linked: boolean; linkUrl: string | null } | null
}

export interface AiObject {
  premise: string
  note: string
}

export interface AiProfile {
  callName: string
  about: string
  objects: AiObject[]
  services: string[]
}

/** GET /api/profile/ai-profile */
export interface AssistantData {
  profile: AiProfile
  userName: string
  /** Пресети категорії «Прибирання»; icon — назва іконки lucide на сайті. */
  premises: { key: string; label: string; icon: string }[]
  services: { key: string; label: string; icon: string }[]
  limits: { about: number; objectNote: number; maxObjects: number }
}

/** GET /api/me/master-profile — анкета майстра (loadMasterProfileForm). */
export interface MasterProfileData {
  user: {
    name: string | null
    email: string
    username: string | null
    phone: string | null
    avatar: string | null
    avatarPublicId: string | null
    city: string | null
    district: string | null
    role: string
  }
  /** null — анкети ще немає. */
  master: {
    categories: string[]
    travelRadiusKm: number | null
    hasVehicle: boolean | null
    crew: 'SOLO' | 'TEAM' | 'COMPANY' | null
    /** Уміння за категоріями: { [slug]: … }. */
    skills: Record<string, unknown>
    description: string
    portfolioImages: string[]
    portfolioImagesPublicIds: string[]
    verificationStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'
    verificationRejectReason: string | null
  } | null
  categories: { slug: string; name: string }[]
  cities: { slug: string; name: string }[]
  districts: ProfileData['districts']
}
