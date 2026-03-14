'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from '@studio-freight/lenis'
import * as THREE from 'three'
import { useDevice } from '@/hooks/useDevice'

gsap.registerPlugin(ScrollTrigger)

// Dynamically import heavy WebGL components (client-only, no SSR)
const ThreeScene  = dynamic(() => import('@/components/ThreeScene'),  { ssr: false })
const HeroObject  = dynamic(() => import('@/components/HeroObject'),  { ssr: false })
const TechCursor  = dynamic(() => import('@/components/TechCursor'),  { ssr: false })
const Preloader   = dynamic(() => import('@/components/Preloader'),   { ssr: false })

const projects = [
  { title: 'Simple Web Pages',       tag: 'HTML / CSS',     year: '2024', image: '/image.jpg',  url: '#' },
  { title: 'AI Automation Workflow', tag: 'AI / Automation', year: '2025', image: '/image2.jpg', url: '#' },
]

// ── Word-split utility ────────────────────────────────────────────────────────
function splitWords(selector: string) {
  const el = document.querySelector(selector)
  if (!el) return
  const words = (el as HTMLElement).innerText.split(' ')
  el.innerHTML = ''
  words.forEach(word => {
    const wrapper = document.createElement('span')
    wrapper.style.cssText = 'overflow:hidden;display:inline-flex;padding-bottom:0.1em;margin-right:0.25em;'
    const inner = document.createElement('span')
    inner.style.cssText = 'display:inline-block;transform:translateY(110%);'
    inner.className = 'reveal-word'
    inner.innerText = word
    wrapper.appendChild(inner)
    el.appendChild(wrapper)
  })
}

export default function Home() {
  const device = useDevice()
  const [loaded, setLoaded]       = useState(false)
  const [navOpen, setNavOpen]     = useState(false)
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null)
  const [bloomLayer, setBloomLayer] = useState(1)
  const heroUpdateRef = useRef<((time: number) => void) | null>(null)
  const lenisRef      = useRef<Lenis | null>(null)

  // Passed to ThreeScene so it can call heroObject update inside its RAF
  const onRafTick = useCallback((time: number) => {
    heroUpdateRef.current?.(time)
  }, [])

  const onSceneReady = useCallback((scene: THREE.Scene, bl: number) => {
    setThreeScene(scene)
    setBloomLayer(bl)
  }, [])

  const registerHeroUpdate = useCallback((cb: (t: number) => void) => {
    heroUpdateRef.current = cb
  }, [])

  // ── After preloader: init Lenis + GSAP animations ────────────────────────
  useEffect(() => {
    if (!loaded) return

    // Lenis smooth scroll
    const lenis = new Lenis()
    lenisRef.current = lenis

    lenis.on('scroll', ({ velocity }: { velocity: number }) => {
      const setter = (window as Window & { __setScrollVelocity?: (v: number) => void }).__setScrollVelocity
      setter?.(velocity)
    })

    function lenisRaf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(lenisRaf)
    }
    requestAnimationFrame(lenisRaf)

    // Nav scroll buttons
    document.querySelectorAll<HTMLElement>('[data-scroll-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        const target = document.querySelector(btn.dataset.scrollTarget!)
        if (target) lenis.scrollTo(target as HTMLElement, { offset: -80, duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) })
        setNavOpen(false)
      })
    })

    // Hero text split + cascade
    splitWords('.hero__title')
    splitWords('.hero__subtitle')

    const tl = gsap.timeline({ delay: 0.2 })
    tl.from('.hero__eyebrow', { opacity: 0, duration: 1, ease: 'power3.inOut' })
      .to('.hero__title .reveal-word',    { y: '0%', duration: 1.2, stagger: 0.04, ease: 'power4.out' }, '-=0.5')
      .to('.hero__subtitle .reveal-word', { y: '0%', duration: 1.0, stagger: 0.02, ease: 'power4.out' }, '-=0.9')

    // Section scroll-in animations
    document.querySelectorAll('.about, .skills, .experience, .projects').forEach(section => {
      gsap.from(section, {
        y: 50, opacity: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none reverse' },
      })
    })

    return () => { lenis.destroy() }
  }, [loaded])

  return (
    <>
      {!loaded && <Preloader onDone={() => setLoaded(true)} />}

      {/* WebGL canvas — always mounted so it initialises early */}
      <ThreeScene device={device} onSceneReady={onSceneReady} onRafTick={onRafTick} />

      {/* Hero icosahedron — only once scene is ready */}
      {threeScene && (
        <HeroObject
          scene={threeScene}
          bloomLayer={bloomLayer}
          device={device}
          onUpdate={registerHeroUpdate}
        />
      )}

      {/* Custom cursor — pointer devices only */}
      {device.isPointerFine && <TechCursor />}

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="site-header">
        <div className="site-header__inner">
          <a href="#top" className="site-header__logo">PS</a>

          {/* Hamburger — visible only on mobile via CSS */}
          <button
            className={`site-header__hamburger${navOpen ? ' is-open' : ''}`}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(v => !v)}
          >
            <span /><span /><span />
          </button>

          <nav
            className={`site-header__nav${navOpen ? ' is-open' : ''}`}
            aria-label="Primary navigation"
          >
            {['about', 'skills', 'projects', 'contact'].map(id => (
              <button
                key={id}
                className="site-header__link"
                type="button"
                data-scroll-target={`#${id}`}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <main className="page" id="top">

        {/* HERO */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__content">
            <p className="hero__eyebrow">Computer Science Student</p>
            <h1 id="hero-title" className="hero__title">
              Pidugu Shivaram, building the web.
            </h1>
            <p className="hero__subtitle">
              Motivated B.Tech CSE student with a strong foundation in C, HTML, CSS, and SQL.
              Eager to contribute to web development and software projects while growing fast.
            </p>
          </div>
        </section>

        {/* ABOUT */}
        <section className="about" id="about" aria-labelledby="about-title">
          <h2 id="about-title" className="section-label">About</h2>
          <div className="about__content">
            <h3 className="about__headline">
              Motivated problem-solver seeking to apply technical skills in real-world projects.
            </h3>
            <p className="about__body">
              I&apos;m a 2nd-year B.Tech Computer Science Engineering student at Ku College of
              Engineering and Technology, Peddapalli, Telangana. I have a strong foundation in
              C programming, web technologies (HTML &amp; CSS), and SQL databases. I&apos;m eager
              to grow, learn fast, and deliver meaningful contributions in web development or
              software-related roles.
            </p>
          </div>
        </section>

        {/* SKILLS */}
        <section className="skills" id="skills" aria-labelledby="skills-title">
          <h2 id="skills-title" className="section-label">Skills</h2>
          <div className="skills__grid">
            {[
              { title: 'Programming Languages', meta: 'C' },
              { title: 'Web Technologies',      meta: 'HTML · CSS' },
              { title: 'Database',              meta: 'SQL' },
              { title: 'Tools & Platforms',     meta: 'VS Code · Git · GitHub · Microsoft Excel' },
            ].map(({ title, meta }) => (
              <article key={title} className="skills__card">
                <h3 className="skills__title">{title}</h3>
                <p className="skills__meta">{meta}</p>
              </article>
            ))}
          </div>
        </section>

        {/* EDUCATION */}
        <section className="experience" aria-labelledby="experience-title">
          <h2 id="experience-title" className="section-label">Education</h2>
          <ul className="experience__list">
            <li className="experience__item">
              <span className="experience__label">B.Tech in Computer Science Engineering</span>
              <span className="experience__meta">
                Ku College of Engineering &amp; Technology · Currently 2nd Year · 2023–2027
              </span>
            </li>
          </ul>
        </section>

        {/* PROJECTS */}
        <section className="projects" id="projects" aria-labelledby="projects-title">
          <header className="projects__header">
            <h2 id="projects-title" className="section-label">Selected projects</h2>
            <p className="projects__subtitle">
              A selection of recent work spanning AI products, creative engineering, and full-stack platforms.
            </p>
          </header>
          <div className="projects__grid">
            {projects.map(p => (
              <div key={p.title} className="project-card" data-url={p.url}>
                <div className="image-placeholder" data-image={p.image} />
                <div className="project-card__info">
                  <span className="project-card__tag">{p.tag}</span>
                  <h3 className="project-card__title">{p.title}</h3>
                  <span className="project-card__year">{p.year}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT */}
        <section className="contact" id="contact" aria-labelledby="contact-title">
          <div className="contact__inner">
            <div className="contact__copy">
              <h2 id="contact-title" className="section-label">Contact</h2>
              <p className="contact__headline">Let&apos;s collaborate on something meaningful.</p>
              <p className="contact__body">
                Whether you&apos;re exploring an idea, looking for an internship opportunity, or
                curious about my work — feel free to reach out. Based in Peddapalli, Telangana
                · +91 9515546704
              </p>
            </div>
            <div className="contact__actions">
              <a className="contact__email" href="mailto:pidugushivaram@gmail.com">
                pidugushivaram@gmail.com
              </a>
              <div className="contact__buttons">
                <a href="/resume.pdf" download className="button button--primary">
                  Download Resume
                </a>
                <div className="contact__links">
                  <a href="https://www.linkedin.com/in/shivarampidugu" target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </div>

          <footer className="footer">
            <p className="footer__text">
              © {new Date().getFullYear()} Pidugu Shivaram. All rights reserved.
            </p>
          </footer>
        </section>

      </main>
    </>
  )
}
