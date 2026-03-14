'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { DeviceInfo } from '@/hooks/useDevice'

gsap.registerPlugin(ScrollTrigger)


interface HeroObjectProps {
  scene: THREE.Scene
  bloomLayer: number
  device: DeviceInfo
  onUpdate: (cb: (time: number) => void) => void
}

export default function HeroObject({ scene, bloomLayer, device, onUpdate }: HeroObjectProps) {
  const groupRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    if (!scene) return

    // Scale the object based on breakpoint
    const scale = device.isMobile ? 0.55
      : device.isPhablet ? 0.7
      : device.isTablet  ? 0.85
      : 1.0

    const outerRadius = 130 * scale
    const innerRadius = 88  * scale

    // X position: push to right on desktop, center-ish on mobile
    const xFactor = device.isMobile || device.isPhablet ? 0.5 : 0.78

    const geoOuter = new THREE.IcosahedronGeometry(outerRadius, 1)
    const matOuter = new THREE.MeshBasicMaterial({
      color: 0xf5c518, wireframe: true, transparent: true, opacity: 0.12,
    })
    const outerMesh = new THREE.Mesh(geoOuter, matOuter)

    const group = new THREE.Group()
    group.add(outerMesh)
    group.position.set(window.innerWidth * xFactor, window.innerHeight * 0.5, -100)
    scene.add(group)
    groupRef.current = group

    // Animate in
    gsap.from(group.scale, { x: 0, y: 0, z: 0, duration: 1.6, ease: 'elastic.out(1, 0.6)', delay: 0.2 })

    // Scroll dissolve
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end:   'bottom top',
      scrub: 1.5,
      onUpdate: (self) => {
        const p = self.progress
        group.scale.setScalar(1 - p * 0.4)
        matOuter.opacity = 0.07 * (1 - p)
        group.position.y = window.innerHeight * 0.5 + p * 80
      },
    })

    // Mouse parallax (skip on touch)
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    if (!device.isTouchDevice) window.addEventListener('mousemove', onMouseMove, { passive: true })

    // Register update callback
    onUpdate((time: number) => {
      group.rotation.y = time * 0.12
      group.rotation.x = time * 0.07
      if (!device.isTouchDevice) {
        targetX += (mouseX * 0.08 - targetX) * 0.05
        targetY += (mouseY * 0.08 - targetY) * 0.05
        group.rotation.x += targetY
        group.rotation.y += targetX
      }
      group.position.x = window.innerWidth * xFactor
    })

    return () => {
      scene.remove(group)
      geoOuter.dispose(); matOuter.dispose()
      window.removeEventListener('mousemove', onMouseMove)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [scene, bloomLayer, device, onUpdate])

  return null
}
