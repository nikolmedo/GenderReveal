'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Gender } from '@/lib/messages'

type Balloon = {
  tone: Gender
  left: number
  size: number
  delay: number
  duration: number
  sway: number
  tilt: number
  rest: number
  dim: boolean
}

const FLOATING = 20
const CHEERING = 12

/**
 * Keeps most balloons out of the middle column, where the reading happens.
 * A few still drift across the centre — the sky would look staged without
 * them — and those are dimmed so they never fight the text.
 */
function pickLane(edgeBiased: boolean): { left: number; dim: boolean } {
  if (!edgeBiased) return { left: Math.random() * 94, dim: false }

  const lane = Math.random()
  if (lane < 0.45) return { left: Math.random() * 24, dim: false }
  if (lane < 0.9) return { left: 74 + Math.random() * 22, dim: false }
  return { left: 28 + Math.random() * 44, dim: true }
}

function make(tone: Gender, edgeBiased: boolean, headStart: boolean): Balloon {
  const lane = pickLane(edgeBiased)

  return {
    tone,
    left: lane.left,
    dim: lane.dim,
    size: 46 + Math.random() * 46,
    // A negative delay drops each balloon in mid-flight, so the first paint is
    // already a sky full of them instead of an empty screen filling up.
    delay: headStart ? -Math.random() * 22 : Math.random() * 2.5,
    duration: 14 + Math.random() * 10,
    sway: 14 + Math.random() * 26,
    tilt: (Math.random() - 0.5) * 14,
    // Where this balloon sits when motion is switched off and nothing rises.
    rest: 6 + Math.random() * 74,
  }
}

/**
 * The one thing on screen that never restarts.
 *
 * These live above the countdown/reveal swap so the moment reads as a single
 * continuous event: the balloons that guessed wrong burst where they float,
 * the rest keep going and are joined by more.
 */
export function Balloons({ winner }: { winner: Gender | null }) {
  const [floating, setFloating] = useState<Balloon[]>([])
  const [calm, setCalm] = useState(false)

  useEffect(() => {
    setCalm(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    // Strictly alternating tones: pink and blue in equal number, all the way up.
    setFloating(
      Array.from({ length: FLOATING }, (_, index) =>
        make(index % 2 === 0 ? 'girl' : 'boy', true, true),
      ),
    )
  }, [])

  const cheering = useMemo(
    // The reveal screen carries less text, so the winning colour is free to
    // fill the whole width instead of hugging the edges.
    () => (winner ? Array.from({ length: CHEERING }, () => make(winner, false, false)) : []),
    [winner],
  )

  if (floating.length === 0) return null

  return (
    <div className="balloons" aria-hidden="true">
      {floating.map((balloon, index) => {
        const popping = winner !== null && balloon.tone !== winner
        return (
          <Floater
            key={`float-${index}`}
            balloon={balloon}
            popping={popping}
            popDelay={index * 55}
            calm={calm}
          />
        )
      })}

      {cheering.map((balloon, index) => (
        <Floater key={`cheer-${index}`} balloon={balloon} popping={false} popDelay={0} calm={calm} />
      ))}
    </div>
  )
}

function Floater({
  balloon,
  popping,
  popDelay,
  calm,
}: {
  balloon: Balloon
  popping: boolean
  popDelay: number
  calm: boolean
}) {
  return (
    <span
      className={`balloon balloon--${balloon.tone}${balloon.dim ? ' balloon--dim' : ''}${
        popping ? ' balloon--popping' : ''
      }`}
      style={
        {
          left: `${balloon.left}%`,
          width: `${balloon.size}px`,
          animationDelay: `${balloon.delay}s`,
          animationDuration: `${calm ? balloon.duration * 2 : balloon.duration}s`,
          '--sway': `${balloon.sway}px`,
          '--tilt': `${balloon.tilt}deg`,
          '--pop-delay': `${popDelay}ms`,
          '--rest': `${balloon.rest}%`,
        } as React.CSSProperties
      }
    >
      <span className="balloon__body">
        <span className="balloon__shine" />
      </span>
      <span className="balloon__string" />
    </span>
  )
}
