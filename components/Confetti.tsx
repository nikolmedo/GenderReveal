'use client'

import { useEffect, useState } from 'react'
import type { Gender } from '@/lib/messages'

const PIECES = 90

type Piece = {
  left: number
  delay: number
  duration: number
  drift: number
  spin: number
  tone: number
  shape: 'strip' | 'disc'
}

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
        delay: Math.random() * 1.7,
        duration: 3.4 + Math.random() * 3.6,
        drift: (Math.random() - 0.5) * 240,
        spin: 360 + Math.random() * 900,
        tone: Math.floor(Math.random() * 4),
        shape: Math.random() > 0.5 ? 'disc' : 'strip',
      })),
    )
  }, [])

  if (pieces.length === 0) return null

  return (
    <div className={`confetti confetti--${gender}`} aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={`confetti__piece confetti__piece--${piece.shape} confetti__piece--t${piece.tone}`}
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
