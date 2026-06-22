'use client'

// MCP server card (Advanced settings): an enable toggle (part of the settings form)
// plus a self-contained token manager. Tokens have their own API (/api/mcp/tokens)
// because the plaintext is shown ONCE on creation and never retrievable again — so
// this part owns its state and does not flow through the settings save.
import { useCallback, useEffect, useState } from 'react'
import type { McpSettings } from '@/types'
import type { McpTokenInfo } from '@/lib/mcp/tokens'
import type { ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { ToggleRow } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { formatDateTimeShort } from '@/lib/utils'
import { useAdminT } from './I18nProvider'

const MAX = 5

export function McpFields({ mcp, onChange }: { mcp: McpSettings; onChange: (m: McpSettings) => void }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [tokens, setTokens] = useState<McpTokenInfo[]>([])
  const [created, setCreated] = useState<string | null>(null) // plaintext shown once
  const [pending, setPending] = useState(false)

  // Refresh used by the create/delete handlers (event handlers — setState is fine).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/tokens')
      const json = (await res.json()) as ApiResponse<McpTokenInfo[]>
      if (json.success && json.data) setTokens(json.data)
    } catch {
      /* non-fatal: the card still shows the toggle */
    }
  }, [])

  // Initial load — inline fetch chain (setState inside a .then callback, not the body).
  useEffect(() => {
    fetch('/api/mcp/tokens')
      .then((r) => r.json() as Promise<ApiResponse<McpTokenInfo[]>>)
      .then((j) => {
        if (j.success && j.data) setTokens(j.data)
      })
      .catch(() => {})
  }, [])

  async function generate() {
    const name = prompt(t.mcpNamePrompt)?.trim()
    if (!name) return
    setPending(true)
    try {
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = (await res.json()) as ApiResponse<{ token: string; info: McpTokenInfo }>
      if (!json.success || !json.data) {
        notify(json.error === 'token_limit' ? t.mcpLimitReached : t.mcpCreateFailed, 'error')
        return
      }
      setCreated(json.data.token)
      await refresh()
    } catch {
      notify(t.mcpCreateFailed, 'error')
    } finally {
      setPending(false)
    }
  }

  async function remove(id: number) {
    if (!confirm(t.mcpConfirmDelete)) return
    setPending(true)
    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(t.mcpTokenDeleted)
      await refresh()
    } catch {
      notify(t.mcpCreateFailed, 'error')
    } finally {
      setPending(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      notify(t.mcpCopied)
    } catch {
      /* clipboard blocked — the value is visible to select manually */
    }
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <ToggleRow
          label={t.mcpEnable}
          desc={t.mcpEnableDesc}
          checked={mcp.enabled}
          onChange={(enabled) => onChange({ ...mcp, enabled })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t.mcpTokensTitle}</h3>
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{t.mcpTokensHint}</p>
          </div>
          <Button type="button" onClick={generate} disabled={pending || tokens.length >= MAX}>
            {t.mcpGenerate}
          </Button>
        </div>

        {/* The just-created plaintext token, shown ONCE. */}
        {created && (
          <div className="space-y-2 rounded-xl border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t.mcpOnceWarning}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                {created}
              </code>
              <Button type="button" onClick={() => copy(created)}>{t.mcpCopy}</Button>
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="rounded-lg px-2.5 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">{t.mcpNoTokens}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.mcpColName}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t.mcpColCreated}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t.mcpColLastUsed}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((tok) => (
                  <tr key={tok.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-3 py-2">
                      <span className="font-medium">{tok.name}</span>
                      <code className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">{tok.prefix}…</code>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-neutral-500 sm:table-cell dark:text-neutral-400">
                      {formatDateTimeShort(tok.createdAt)}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-neutral-500 sm:table-cell dark:text-neutral-400">
                      {tok.lastUsedAt ? formatDateTimeShort(tok.lastUsedAt) : t.mcpNeverUsed}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(tok.id)}
                        disabled={pending}
                        className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
