'use client'
import { useEffect, useRef } from 'react'

interface PreloaderProps {
  onDone: () => void
}

export default function Preloader({ onDone }: PreloaderProps) {
  const countRef  = useRef<HTMLSpanElement>(null)
  const barRef    = useRef<HTMLDivElement>(null)
  const panelTRef = useRef<HTMLDivElement>(null)
  const panelBRef = useRef<HTMLDivElement>(null)
  const elRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current = 0
    let target  = 0
    let rafId: number

    function tick() {
      if (current < target) {
        current = Math.min(current + Math.ceil((target - current) * 0.12 + 0.5), target)
        if (countRef.current)  countRef.current.textContent = String(current)
        if (barRef.current)    barRef.current.style.width   = current + '%'
      }
      if (current < 100) {
        rafId = requestAnimationFrame(tick)
      } else {
        exit()
      }
    }

    function exit() {
      setTimeout(() => {
        const dur  = 700
        const ease = 'cubic-bezier(0.76, 0, 0.24, 1)'
        if (panelTRef.current) panelTRef.current.style.transition = `transform ${dur}ms ${ease}`
        if (panelBRef.current) panelBRef.current.style.transition = `transform ${dur}ms ${ease}`
        if (countRef.current)  countRef.current.style.transition  = 'opacity 250ms ease'
        if (countRef.current)  countRef.current.style.opacity     = '0'

        setTimeout(() => {
          if (panelTRef.current) {
            panelTRef.current.style.transform       = 'scaleY(0)'
            panelTRef.current.style.transformOrigin = 'top'
          }
          if (panelBRef.current) {
            panelBRef.current.style.transform       = 'scaleY(0)'
            panelBRef.current.style.transformOrigin = 'bottom'
          }
        }, 80)

        setTimeout(() => onDone(), dur + 200)
      }, 180)
    }

    const phases = [
      { pct: 30,  delay: 200  },
      { pct: 60,  delay: 550  },
      { pct: 85,  delay: 900  },
      { pct: 100, delay: 1300 },
    ]

    const timers = phases.map(({ pct, delay }) =>
      setTimeout(() => {
        target = pct
        if (!rafId) rafId = requestAnimationFrame(tick)
      }, delay)
    )

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      timers.forEach(clearTimeout)
    }
  }, [onDone])

  return (
    <div className="preloader" ref={elRef}>
      <div className="preloader__panel preloader__panel--top"  ref={panelTRef} />
      <div className="preloader__panel preloader__panel--bottom" ref={panelBRef} />
      <span className="preloader__count" ref={countRef}>0</span>
      <div className="preloader__bar" ref={barRef} />
    </div>
  )
}
