import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="missing">
      <div className="missing__card">
        <h1>Este countdown no existe</h1>
        <p>
          El link puede estar mal copiado, o la fiesta ya pasó hace más de un mes y sus datos se
          borraron.
        </p>
        <Link className="missing__link" href="/">
          Armar uno nuevo
        </Link>
      </div>
    </main>
  )
}
