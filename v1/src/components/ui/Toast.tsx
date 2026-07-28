'use client'

// Minimal toast system: a provider + useToast() hook.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error'
type ToastItem = { id: number; message: string; kind: ToastKind }

type ToastContextValue = {
  notify: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, kind }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`border px-4 py-2.5 text-sm font-medium shadow-lg ${
              t.kind === 'success'
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-900 bg-white text-neutral-900 dark:border-white dark:bg-neutral-900 dark:text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
