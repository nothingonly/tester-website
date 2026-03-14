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

    const scale = device.isMobile  ? 0.45
      : device.isPhablet ? 0.6
      : device.isTablet  ? 0.75
      : 1.0

    const outerRadius = 130 * scale

    // on mobile/phablet: hide behind content (push far right / off-screen subtly)
    // on tablet+: sit at right side of viewport
    const xFactor = device.isMobile  ? 0.82
      : device.isPhablet ? 0.80
      : device.isTablet  ? 0.78
      : 0.78

    // vertical: center on mobile, slightly above center on desktop
    const yFactor = device.isMobile || device.isPhablet ? 0.35 : 0.5

    const geoOuter = new THREE.IcosahedronGeometry(outerRadius, 1)
    const matOuter = new THREE.MeshBasicMaterial({
      color: 0xf5c518, wireframe: true, transparent: true,
      opacity: device.isMobile ? 0.07 : 0.12,
    })
    const outerMesh = new THREE.Mesh(geoOuter, matOuter)

    const group = new THREE.Group()
    group.add(outerMesh)
    group.position.set(
      window.innerWidth  * xFactor,
      window.innerHeight * yFactor,
      -100,
    )
    scene.add(group)
    groupRef.current = group

    gsap.from(group.scale, { x: 0, y: 0, z: 0, duration: 1.6, ease: 'elastic.out(1, 0.6)', delay: 0.2 })

    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end:   'bottom top',
      scrub: 1.5,
      onUpdate: (self) => {
        const p = self.progress
        group.scale.setScalar(1 - p * 0.4)
        matOuter.opacity = (device.isMobile ? 0.07 : 0.12) * (1 - p)
        group.position.y = window.innerHeight * yFactor + p * 80
      },
    })

    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    if (!device.isTouchDevice) window.addEventListener('mousemove', onMouseMove, { passive: true })

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
      geoOuter.dispose()
      matOuter.dispose()
      window.removeEventListener('mousemove', onMouseMove)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [scene, bloomLayer, device, onUpdate])

  return null
}
