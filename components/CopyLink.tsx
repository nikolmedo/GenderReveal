'use client'

import { useState } from 'react'

/**
 * A link the organiser is meant to take away with them. Read-only, selects
 * itself on focus, and copies on a click, because these get moved to WhatsApp
 * and a mistyped one leads nowhere.
 */
export function CopyLink({ url, tone = 'share' }: { url: string; tone?: 'share' | 'secret' }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className={`link link--${tone}`}>
      <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? '¡Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}
