import Link from 'next/link'
import { headers } from 'next/headers'
import { copyFor, pickLocale } from '@/lib/i18n'

/** No countdown to take a language from, so the request's own is the best guess. */
export default async function NotFound() {
  const t = copyFor(pickLocale((await headers()).get('accept-language')))

  return (
    <main className="missing">
      <div className="missing__card">
        <h1>{t.ui.notFound.title}</h1>
        <p>{t.ui.notFound.body}</p>
        <Link className="missing__link" href="/">
          {t.ui.notFound.cta}
        </Link>
      </div>
    </main>
  )
}
