'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import type { DeviceInfo } from '@/hooks/useDevice'

interface ThreeSceneProps {
  device: DeviceInfo
  onSceneReady?: (scene: THREE.Scene, bloomLayer: number) => void
  onRafTick?: (time: number) => void
}

const BLOOM_LAYER = 1

// desktop=236 → 55k particles | tablet=128 → 16k | mobile=64 → 4k
function getComputeSize(device: DeviceInfo): number {
  if (device.isMobile || device.isPhablet) return 64
  if (device.isTablet) return 128
  return 236
}

const planeVertexShader = `
uniform float uVelocity;
uniform float uHoverStrength;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 transformed = position;
  float strength = clamp(abs(uVelocity) * 0.6, 0.0, 1.0);
  float edge = vUv.y - 0.5;
  float curveProfile = edge * abs(edge);
  float bendY = -sign(uVelocity) * strength * curveProfile * 50.0;
  float bendZ = strength * curveProfile * 140.0;
  bendZ += uHoverStrength * 20.0;
  transformed.y += bendY;
  transformed.z += bendZ;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`

const planeFragmentShader = `
uniform sampler2D uTexture;
uniform vec2 uImageSize;
uniform vec2 uPlaneSize;
uniform vec2 uMouse;
uniform float uHoverStrength;
varying vec2 vUv;
void main() {
  float imageAspect = uImageSize.x / max(uImageSize.y, 0.001);
  float planeAspect = uPlaneSize.x / max(uPlaneSize.y, 0.001);
  vec2 uv = vUv;
  if (imageAspect > planeAspect) {
    float scale = planeAspect / imageAspect;
    uv.x = (uv.x - 0.5) * scale + 0.5;
  } else {
    float scale = imageAspect / planeAspect;
    uv.y = (uv.y - 0.5) * scale + 0.5;
  }
  float distToMouse = distance(uv, uMouse);
  float radius = 0.35;
  float hoverMask = smoothstep(radius, 0.0, distToMouse) * uHoverStrength;
  vec2 direction = normalize(uv - uMouse);
  direction = mix(direction, vec2(0.0), 1.0 - hoverMask);
  float maxShift = 0.025;
  vec2 shift = direction * maxShift * hoverMask;
  vec4 colorR = texture2D(uTexture, uv + shift * 0.7);
  vec4 colorG = texture2D(uTexture, uv);
  vec4 colorB = texture2D(uTexture, uv - shift * 0.7);
  gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, colorG.a);
}
`

const positionFragmentShader = `
uniform vec3 uBounds;
uniform float uDelta;
uniform float uTime;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);
  vec3 nextPos = pos.xyz + vel.xyz;
  vec3 center = vec3(uBounds.x * 0.5, uBounds.y * 0.5, 0.0);
  float h  = fract(sin(dot(uv + uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
  float h2 = fract(sin(dot(uv + vec2(4.123, 9.456) + uTime * 0.02, vec2(39.346, 11.135))) * 24634.6345);
  bool outX = abs(nextPos.x - center.x) > uBounds.x * 1.25;
  bool outY = abs(nextPos.y - center.y) > uBounds.y * 1.25;
  bool outZ = abs(nextPos.z) > uBounds.z * 1.25;
  if (outX || outY || outZ) {
    nextPos = center + vec3((h - 0.5) * uBounds.x * 0.15, (h2 - 0.5) * uBounds.y * 0.15, (h - 0.5) * uBounds.z * 0.15);
  }
  gl_FragColor = vec4(nextPos, 1.0);
}
`

const velocityFragmentShader = `
uniform vec3 uMouse;
uniform vec3 uBounds;
uniform float uDelta;
uniform float uTime;

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4(((x*34.0)+10.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x  = x_ * ns.x + ns.yyyy;
  vec4 y  = y_ * ns.x + ns.yyyy;
  vec4 h  = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e,0,0), dy = vec3(0,e,0), dz = vec3(0,0,e);
  vec3 px0 = vec3(snoise(p-dx), snoise(p-dx+vec3(12.3)), snoise(p-dx+vec3(24.6)));
  vec3 px1 = vec3(snoise(p+dx), snoise(p+dx+vec3(12.3)), snoise(p+dx+vec3(24.6)));
  vec3 py0 = vec3(snoise(p-dy), snoise(p-dy+vec3(12.3)), snoise(p-dy+vec3(24.6)));
  vec3 py1 = vec3(snoise(p+dy), snoise(p+dy+vec3(12.3)), snoise(p+dy+vec3(24.6)));
  vec3 pz0 = vec3(snoise(p-dz), snoise(p-dz+vec3(12.3)), snoise(p-dz+vec3(24.6)));
  vec3 pz1 = vec3(snoise(p+dz), snoise(p+dz+vec3(12.3)), snoise(p+dz+vec3(24.6)));
  float x = py1.z - py0.z - pz1.y + pz0.y;
  float y = pz1.x - pz0.x - px1.z + px0.z;
  float z = px1.y - px0.y - py1.x + py0.x;
  return normalize(vec3(x,y,z) / (2.0*e));
}

void main() {
  vec2 uv  = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  vec3 targetVel = curlNoise(pos * 0.002 + uTime * 0.2) * 2.0;
  vel += (targetVel - vel) * 0.05;
  float dist = distance(pos.xy, uMouse.xy);
  float maxDist = 120.0;
  if (dist < maxDist) {
    vec2 dir = pos.xy - uMouse.xy;
    float force = (maxDist - dist) / maxDist;
    vel.xy += normalize(dir + 0.0001) * force * 22.0;
  }
  vel *= 0.95;
  gl_FragColor = vec4(vel, 1.0);
}
`

export default function ThreeScene({ device, onSceneReady, onRafTick }: ThreeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W = () => window.innerWidth
    const H = () => window.innerHeight

    const COMPUTE_SIZE = getComputeSize(device)

    const scene  = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(0, W(), H(), 0, -1000, 1000)
    camera.position.z = 10

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, device.isMobile ? 1.5 : 2))
    renderer.setSize(W(), H())
    renderer.setClearColor(0x000000, 0)

    // ── Post-processing ──────────────────────────────────────
    const bloomComposer = new EffectComposer(renderer)
    const finalComposer = new EffectComposer(renderer)
    const renderPass    = new RenderPass(scene, camera)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(W(), H()),
      device.isMobile ? 0.5 : 0.85,
      0.95,
      0.6,
    )

    bloomComposer.renderToScreen = false
    bloomComposer.addPass(renderPass)
    bloomComposer.addPass(bloomPass)

    const finalPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture:  { value: null },
          bloomTexture: { value: null },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }
        `,
        defines: {},
      }),
      'baseTexture',
    )
    finalPass.needsSwap = true
    finalComposer.addPass(renderPass)
    finalComposer.addPass(finalPass)

    // ── GPGPU — runs on ALL devices, size scales per breakpoint ─
    let gpuCompute:       GPUComputationRenderer | null = null
    let positionVariable: ReturnType<GPUComputationRenderer['addVariable']> | null = null
    let velocityVariable: ReturnType<GPUComputationRenderer['addVariable']> | null = null
    let particles:        THREE.Points | null = null
    let pointsMaterial:   THREE.ShaderMaterial | null = null
    const fboMouse = new THREE.Vector3(W() / 2, H() / 2, 0)

    try {
      gpuCompute = new GPUComputationRenderer(COMPUTE_SIZE, COMPUTE_SIZE, renderer)

      const posTex = gpuCompute.createTexture()
      const velTex = gpuCompute.createTexture()

      const pd = posTex.image.data as Float32Array
      for (let i = 0; i < pd.length; i += 4) {
        pd[i]   = Math.random() * W()
        pd[i+1] = Math.random() * H()
        pd[i+2] = (Math.random() - 0.5) * 100
        pd[i+3] = 1
      }
      const vd = velTex.image.data as Float32Array
      for (let i = 0; i < vd.length; i += 4) { vd[i+3] = 1 }

      positionVariable = gpuCompute.addVariable('texturePosition', positionFragmentShader, posTex)
      velocityVariable = gpuCompute.addVariable('textureVelocity', velocityFragmentShader, velTex)

      gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable])
      gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable])

      positionVariable.material.uniforms.uBounds = { value: new THREE.Vector3(W(), H(), 100) }
      positionVariable.material.uniforms.uTime   = { value: 0 }
      positionVariable.material.uniforms.uDelta  = { value: 0.016 }

      velocityVariable.material.uniforms.uBounds = { value: new THREE.Vector3(W(), H(), 100) }
      velocityVariable.material.uniforms.uTime   = { value: 0 }
      velocityVariable.material.uniforms.uDelta  = { value: 0.016 }
      velocityVariable.material.uniforms.uMouse  = { value: fboMouse }

      const err = gpuCompute.init()
      if (err) { gpuCompute = null; positionVariable = null; velocityVariable = null }
    } catch {
      gpuCompute = null; positionVariable = null; velocityVariable = null
    }

    // ── Particle mesh ────────────────────────────────────────
    if (gpuCompute && positionVariable) {
      const count      = COMPUTE_SIZE * COMPUTE_SIZE
      const geo        = new THREE.BufferGeometry()
      const positions  = new Float32Array(count * 3)
      const references = new Float32Array(count * 2)

      for (let i = 0; i < count; i++) {
        references[i*2]   = ((i % COMPUTE_SIZE) + 0.5) / COMPUTE_SIZE
        references[i*2+1] = (Math.floor(i / COMPUTE_SIZE) + 0.5) / COMPUTE_SIZE
      }

      geo.setAttribute('position',  new THREE.BufferAttribute(positions,  3))
      geo.setAttribute('reference', new THREE.BufferAttribute(references, 2))

      pointsMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uPositionTexture: { value: null },
          uAlpha:           { value: 0.85 },
        },
        vertexShader: `
          uniform sampler2D uPositionTexture;
          attribute vec2 reference;
          varying vec3 vPos;
          void main() {
            vec3 pos = texture2D(uPositionTexture, reference).xyz;
            vPos = pos;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = 2.0;
          }
        `,
        fragmentShader: `
          uniform float uAlpha;
          varying vec3 vPos;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float mask = smoothstep(0.5, 0.35, length(c));
            vec3 c1 = vec3(1.0, 0.84, 0.0);
            vec3 c2 = vec3(1.0, 0.55, 0.0);
            float mix_ = clamp((vPos.x * 0.001) + (vPos.y * 0.001) + 0.5, 0.0, 1.0);
            gl_FragColor = vec4(mix(c1, c2, mix_), uAlpha * mask);
          }
        `,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      })

      particles = new THREE.Points(geo, pointsMaterial)
      particles.frustumCulled = false
      particles.position.z    = -300
      particles.layers.set(BLOOM_LAYER)
      scene.add(particles)
    }

    // ── Image planes ─────────────────────────────────────────
    type PlaneEntry = { element: Element; mesh: THREE.Mesh }
    const planeMeshes: PlaneEntry[] = []
    const textureLoader = new THREE.TextureLoader()

    // pointerScreen tracks raw screen px — used for local UV mouse (reference fix)
    const pointerScreen = new THREE.Vector2(W() / 2, H() / 2)

    function buildPlanes() {
      planeMeshes.forEach(({ mesh }) => {
        scene.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      })
      planeMeshes.length = 0

      document.querySelectorAll('.image-placeholder').forEach((el) => {
        const rect = el.getBoundingClientRect()
        const geo  = new THREE.PlaneGeometry(rect.width, rect.height, 32, 32)
        const mat  = new THREE.ShaderMaterial({
          uniforms: {
            uTexture:       { value: null },
            uVelocity:      { value: 0 },
            uHoverStrength: { value: 0 },
            uMouse:         { value: new THREE.Vector2(0.5, 0.5) },
            uImageSize:     { value: new THREE.Vector2(Math.max(rect.width, 1), Math.max(rect.height, 1)) },
            uPlaneSize:     { value: new THREE.Vector2(rect.width, rect.height) },
          },
          vertexShader:   planeVertexShader,
          fragmentShader: planeFragmentShader,
          transparent: true,
        })
        const mesh = new THREE.Mesh(geo, mat)
        const imgUrl = (el as HTMLElement).dataset.image
        if (imgUrl) {
          textureLoader.load(imgUrl, (tex) => {
            if (tex.image) mat.uniforms.uImageSize.value.set(tex.image.width, tex.image.height)
            mat.uniforms.uTexture.value = tex
            mat.needsUpdate = true
          })
        }
        scene.add(mesh)
        planeMeshes.push({ element: el, mesh })
      })
    }

    function syncPlaneTransforms() {
      planeMeshes.forEach(({ element, mesh }) => {
        const rect = element.getBoundingClientRect()
        mesh.position.set(rect.left + rect.width / 2, H() - (rect.top + rect.height / 2), 0)
      })
    }

    buildPlanes()
    syncPlaneTransforms()

    // ── Pointer / Touch ──────────────────────────────────────
    const raycaster  = new THREE.Raycaster()
    const pointerNDC = new THREE.Vector2(2, 2)

    const onPointerMove = (e: PointerEvent) => {
      pointerScreen.set(e.clientX, e.clientY)
      pointerNDC.x =  (e.clientX / W()) * 2 - 1
      pointerNDC.y = -(e.clientY / H()) * 2 + 1
      // mouse → FBO space (Y flipped, same as reference)
      fboMouse.set(e.clientX, H() - e.clientY, 0)
    }

    // Touch: scatter particles on tap/drag + drive scroll scatter
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0]
        fboMouse.set(t.clientX, H() - t.clientY, 0)
        pointerScreen.set(t.clientX, t.clientY)
      }
    }

    // Touch start: burst — set fboMouse to touch point for instant repulsion
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0]
        fboMouse.set(t.clientX, H() - t.clientY, 0)
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('touchmove',   onTouchMove,   { passive: true })
    window.addEventListener('touchstart',  onTouchStart,  { passive: true })

    // ── Resize ───────────────────────────────────────────────
    function onResize() {
      camera.right = W(); camera.top = H()
      camera.updateProjectionMatrix()
      renderer.setSize(W(), H())
      bloomComposer.setSize(W(), H())
      finalComposer.setSize(W(), H())
      bloomPass.setSize(new THREE.Vector2(W(), H()))
      positionVariable?.material.uniforms.uBounds?.value.set(W(), H(), 100)
      velocityVariable?.material.uniforms.uBounds?.value.set(W(), H(), 100)
      buildPlanes()
      syncPlaneTransforms()
    }

    window.addEventListener('resize', onResize, { passive: true })

    // ── RAF loop ─────────────────────────────────────────────
    let scrollVelocity   = 0
    let smoothedVelocity = 0
    let rafId: number

    ;(window as Window & { __setScrollVelocity?: (v: number) => void }).__setScrollVelocity = (v: number) => {
      scrollVelocity = v
    }

    onSceneReady?.(scene, BLOOM_LAYER)

    function raf(time: number) {
      const t = time * 0.001

      syncPlaneTransforms()

      // scroll bend: active on desktop/laptop, disabled on touch (matches reference)
      const targetVel = device.isTouchDevice ? 0 : scrollVelocity
      smoothedVelocity += (targetVel - smoothedVelocity) * 0.16

      // Hover detection via raycaster
      raycaster.setFromCamera(pointerNDC, camera)
      const hits = raycaster.intersectObjects(planeMeshes.map(p => p.mesh))

      planeMeshes.forEach(({ element, mesh }) => {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms.uVelocity.value = smoothedVelocity

        const isHit = hits.length > 0 && hits[0].object === mesh
        mat.uniforms.uHoverStrength.value += ((isHit ? 1 : 0) - mat.uniforms.uHoverStrength.value) * 0.1

        // local bounding-box UV mouse (reference fix — prevents wrong distortion)
        const rect   = element.getBoundingClientRect()
        const localX = (pointerScreen.x - rect.left) / Math.max(rect.width,  1)
        const localY = (pointerScreen.y - rect.top)  / Math.max(rect.height, 1)
        mat.uniforms.uMouse.value.set(localX, 1.0 - localY)
      })

      // GPGPU compute
      if (gpuCompute && positionVariable && velocityVariable) {
        velocityVariable.material.uniforms.uMouse.value.copy(fboMouse)
        velocityVariable.material.uniforms.uTime.value  += 0.01
        positionVariable.material.uniforms.uTime.value  += 0.01
        gpuCompute.compute()
        if (pointsMaterial) {
          pointsMaterial.uniforms.uPositionTexture.value =
            gpuCompute.getCurrentRenderTarget(positionVariable).texture
        }
      }

      // Selective bloom render
      camera.layers.set(BLOOM_LAYER)
      bloomComposer.render()
      if (finalPass.uniforms.bloomTexture) {
        finalPass.uniforms.bloomTexture.value = bloomComposer.readBuffer.texture
      }
      camera.layers.set(0)
      finalComposer.render()

      onRafTick?.(t)
      rafId = requestAnimationFrame(raf)
    }

    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('touchmove',   onTouchMove)
      window.removeEventListener('touchstart',  onTouchStart)
      window.removeEventListener('resize',      onResize)
      renderer.dispose()
      bloomComposer.dispose()
      finalComposer.dispose()
    }
  }, [device, onSceneReady, onRafTick])

  return <canvas ref={canvasRef} className="scene-canvas" />
}
