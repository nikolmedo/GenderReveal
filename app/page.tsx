import type { Metadata } from 'next'
import { Configurator } from '@/components/Configurator'
import { defaultConfig } from '@/lib/messages'
import { MAX_HORIZON_DAYS, RETENTION_DAYS } from '@/lib/reveals'

export const metadata: Metadata = {
  title: 'Armá tu reveal',
  description: 'Configurá la hora, el sexo, los textos y los colores, y llevate un link para compartir.',
}

export default function HomePage() {
  return (
    // The credit lives here rather than inside the Configurator so it cannot
    // reach a countdown page: /r/[hash] is a different route and never renders
    // this tree. A guest's screen belongs to whoever threw the party.
    <div className="home">
      <Configurator
        defaults={defaultConfig}
        maxHorizonDays={MAX_HORIZON_DAYS}
        retentionDays={RETENTION_DAYS}
      />

      <footer className="credit">
        Desarrollado por{' '}
        <a href="https://nolmedo.dev/" target="_blank" rel="noopener noreferrer">
          Nico Olmedo
        </a>
      </footer>
    </div>
  )
}
