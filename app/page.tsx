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
    <Configurator
      defaults={defaultConfig}
      maxHorizonDays={MAX_HORIZON_DAYS}
      retentionDays={RETENTION_DAYS}
    />
  )
}
