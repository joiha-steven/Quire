'use client'

// Provides the admin language + strings to all admin client components.
import { createContext, useContext, type ReactNode } from 'react'
import type { SiteLang } from '@/types'
import { adminT, type AdminStrings } from '@/lib/admin-i18n'

type Ctx = { lang: SiteLang; t: AdminStrings }

const AdminI18nContext = createContext<Ctx | null>(null)

export function AdminI18nProvider({ lang, children }: { lang: SiteLang; children: ReactNode }) {
  return (
    <AdminI18nContext.Provider value={{ lang, t: adminT(lang) }}>
      {children}
    </AdminI18nContext.Provider>
  )
}

// Strings for the current admin language.
export function useAdminT(): AdminStrings {
  const ctx = useContext(AdminI18nContext)
  if (!ctx) throw new Error('useAdminT must be used within AdminI18nProvider')
  return ctx.t
}

// Current admin language (for date formatting etc.).
export function useAdminLang(): SiteLang {
  const ctx = useContext(AdminI18nContext)
  if (!ctx) throw new Error('useAdminLang must be used within AdminI18nProvider')
  return ctx.lang
}
