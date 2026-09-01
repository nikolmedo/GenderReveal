'use client'

import { useEffect, useState } from 'react'
import type { Gender } from '@/lib/messages'

const PIECES = 70

type Piece = { left: number; delay: number; duration: number; drift: number; spin: number; tone: number; wide: boolean }

/**
 * Generated after mount rather than during render: the values are random, and
 * random markup on the server never matches what the client draws.
 */
export function Confetti({ gender }: { gender: Gender }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setPieces(
      Array.from({ length: PIECES }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.6,
        duration: 3.6 + Math.random() * 3.4,
        drift: (Math.random() - 0.5) * 220,
        spin: 360 + Math.random() * 720,
        tone: Math.floor(Math.random() * 3),
        wide: Math.random() > 0.55,
      })),
    )
  }, [])

  if (pieces.length === 0) return null

  return (
    <div className={`confetti confetti--${gender}`} aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={`confetti__piece confetti__piece--t${piece.tone}${piece.wide ? ' confetti__piece--wide' : ''}`}
          style={
            {
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
