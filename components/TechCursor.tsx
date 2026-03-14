'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function TechCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = cursorRef.current
    if (!el) return

    gsap.set(el, { xPercent: -50, yPercent: -50 })
    const setX = gsap.quickTo(el, 'x', { duration: 0.15, ease: 'power3.out' })
    const setY = gsap.quickTo(el, 'y', { duration: 0.15, ease: 'power3.out' })

    const onMove = (e: MouseEvent) => { setX(e.clientX); setY(e.clientY) }
    const onLeave = () => gsap.to(el, { opacity: 0, duration: 0.3 })
    const onEnter = () => gsap.to(el, { opacity: 1, duration: 0.3 })

    const clickables = 'a, button, [data-magnetic], .project-card'

    const onMouseEnter = (e: MouseEvent) => {
      if ((e.target as Element).closest(clickables)) el.classList.add('is-hovering')
    }
    const onMouseLeave = (e: MouseEvent) => {
      if ((e.target as Element).closest(clickables)) el.classList.remove('is-hovering')
    }

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)
    document.body.addEventListener('mouseenter', onMouseEnter, true)
    document.body.addEventListener('mouseleave', onMouseLeave, true)

    // Magnetic elements
    document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic ?? '0.35') || 0.35
      el.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const dx = e.clientX - (rect.left + rect.width  / 2)
        const dy = e.clientY - (rect.top  + rect.height / 2)
        gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.4, ease: 'power2.out' })
      })
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
      })
    })

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      document.body.removeEventListener('mouseenter', onMouseEnter, true)
      document.body.removeEventListener('mouseleave', onMouseLeave, true)
    }
  }, [])

  return (
    <div className="tech-cursor" ref={cursorRef}>
      <span>{'<'}</span>
      <span>{'/>'}</span>
    </div>
  )
}
