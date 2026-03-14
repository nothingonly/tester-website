'use client'
import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'phablet' | 'tablet' | 'laptop' | 'desktop'

export interface DeviceInfo {
  breakpoint: Breakpoint
  isMobile: boolean       // ≤480
  isPhablet: boolean      // 481–768
  isTablet: boolean       // 769–1024
  isLaptop: boolean       // 1025–1280
  isDesktop: boolean      // 1281+
  isTouchDevice: boolean
  isPointerFine: boolean
  width: number
}

function getBreakpoint(w: number): Breakpoint {
  if (w <= 480)  return 'mobile'
  if (w <= 768)  return 'phablet'
  if (w <= 1024) return 'tablet'
  if (w <= 1280) return 'laptop'
  return 'desktop'
}

function getDeviceInfo(w: number): DeviceInfo {
  const bp = getBreakpoint(w)
  const isTouchDevice = typeof window !== 'undefined'
    ? window.matchMedia('(hover: none)').matches
    : false
  const isPointerFine = typeof window !== 'undefined'
    ? window.matchMedia('(pointer: fine)').matches
    : true

  return {
    breakpoint: bp,
    isMobile:   bp === 'mobile',
    isPhablet:  bp === 'phablet',
    isTablet:   bp === 'tablet',
    isLaptop:   bp === 'laptop',
    isDesktop:  bp === 'desktop',
    isTouchDevice,
    isPointerFine,
    width: w,
  }
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() =>
    typeof window !== 'undefined'
      ? getDeviceInfo(window.innerWidth)
      : getDeviceInfo(1440)
  )

  useEffect(() => {
    const update = () => setInfo(getDeviceInfo(window.innerWidth))
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  return info
}
