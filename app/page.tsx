import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Configurator } from '@/components/Configurator'
import { copyFor, pickLocale } from '@/lib/i18n'
import { defaultConfig } from '@/lib/messages'
import { MAX_HORIZON_DAYS, RETENTION_DAYS } from '@/lib/reveals'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = copyFor(pickLocale((await headers()).get('accept-language')))

  return {
    title: t.ui.forge.eyebrow,
    description: t.ui.forge.lead,
  }
}

export default async function HomePage() {
  // Guessed from the request rather than after mount, so the first paint is
  // already in the visitor's language. A choice they made before overrides it
  // from localStorage once the client takes over.
  const locale = pickLocale((await headers()).get('accept-language'))
  const t = copyFor(locale)

  return (
    // The credit lives here rather than inside the Configurator so it cannot
    // reach a countdown page: /r/[hash] is a different route and never renders
    // this tree. A guest's screen belongs to whoever threw the party.
    <div className="home">
      <Configurator
        defaults={defaultConfig}
        maxHorizonDays={MAX_HORIZON_DAYS}
        retentionDays={RETENTION_DAYS}
        initialLocale={locale}
      />

      <footer className="credit">
        {t.ui.credit.by}{' '}
        <a href="https://nolmedo.dev/" target="_blank" rel="noopener noreferrer">
          Nico Olmedo
        </a>
      </footer>
    </div>
  )
}
