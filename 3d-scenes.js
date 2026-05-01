/* ====================================================================
   YUL 3D Scene Builders (Hyper-Realistic PBR Rendering)
   ==================================================================== */
import * as THREE from 'three';
import { SimplexNoise } from './3d-utils.js';

const noise = new SimplexNoise(42);
const textureLoader = new THREE.TextureLoader();

// ── Shared Environment Map ──────────────────────────────────────
let envMap = null;

export function loadEnvironmentMap(renderer, scene) {
  return new Promise((resolve) => {
    const tex = textureLoader.load('/assets/env-mountains.png', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      scene.environment = texture;
      scene.background = null; // We use sky dome
      envMap = texture;
      resolve(texture);
    });
  });
}

// ── Color Constants ─────────────────────────────────────────────
const COLORS = {
  deepForest: new THREE.Color(0x0D1F1A),
  moss: new THREE.Color(0x2D4A3E),
  mist: new THREE.Color(0xC8DDD6),
  glacierWhite: new THREE.Color(0xEEF5F3),
  springBlue: new THREE.Color(0x6DB8CC),
  gold: new THREE.Color(0xC9A96E),
  snow: new THREE.Color(0xF0F0F2),
  rock: new THREE.Color(0x5A4F47),
  deepWater: new THREE.Color(0x1A4A5A),
  skyDark: new THREE.Color(0x0D1B2A),
  skyHorizon: new THREE.Color(0xC8DDD6),
};

// ── Procedural Normal Map Generator ─────────────────────────────
function generateNormalMap(width, height, scale, intensity) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const nx = noise.noise2D(x * scale, y * scale) * intensity;
      const ny = noise.noise2D(x * scale + 100, y * scale + 100) * intensity;
      imgData.data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      imgData.data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      imgData.data[idx + 2] = 200;
      imgData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Scene 1: Hyper-Realistic Mountains ──────────────────────────
export function createMountains(scene) {
  const group = new THREE.Group();
  group.name = 'mountains';

  // Massive Himalayan terrain footprint
  const geo = new THREE.PlaneGeometry(800, 800, 128, 128);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const uvs = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // 1. Base valley curve (U-shape along X axis)
    const valleyCurve = Math.pow(Math.abs(x) / 150, 2) * 200;

    // 2. Large, smooth rolling hills
    const macro = noise.fbm(x * 0.003, z * 0.003, 4, 2.0, 0.4) * 120;

    // 3. Medium details
    const meso = noise.fbm(x * 0.015, z * 0.015, 3, 1.8, 0.4) * 20;

    let height = valleyCurve + macro + meso;

    // 4. Flatten the central path
    const distFromCenter = Math.abs(x);
    const flattenFactor = Math.max(0, 1.0 - (distFromCenter / 40.0));

    height = height * (1.0 - flattenFactor) + (-5 * flattenFactor);

    const micro = noise.fbm(x * 0.08, z * 0.08, 2, 2.0, 0.5) * 0.5;
    height += micro;

    pos.setY(i, height);

    // Photorealistic earth tones based on large height map scale
    const t = Math.max(0, Math.min(1, (height + 5) / 180));
    const color = new THREE.Color();
    if (t > 0.6) {
      color.lerpColors(new THREE.Color(0xAAB0B8), new THREE.Color(0xFFFFFF), (t - 0.6) * 2.5); // Snow peaks
    } else if (t > 0.3) {
      color.lerpColors(new THREE.Color(0x505750), new THREE.Color(0xAAB0B8), (t - 0.3) * 3.33); // Stone
    } else if (t > 0.1) {
      color.lerpColors(new THREE.Color(0x323E2A), new THREE.Color(0x505750), (t - 0.1) * 5.0);  // High moss
    } else {
      color.copy(new THREE.Color(0x222B1C)); // Valley floor
    }

    const colorNoise = noise.noise2D(x * 0.05, z * 0.05) * 0.05;
    color.r = Math.min(1, Math.max(0, color.r + colorNoise));
    color.g = Math.min(1, Math.max(0, color.g + colorNoise * 0.8));
    color.b = Math.min(1, Math.max(0, color.b + colorNoise * 0.6));

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    envMapIntensity: 0.8,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  scene.add(group);
  return group;
}

export function createClouds(scene) {
  const group = new THREE.Group();
  group.name = 'clouds';

  const count = 45; // Optimized for performance, using larger planes
  const geo = new THREE.PlaneGeometry(350, 350);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uSunColor: { value: new THREE.Color(0xFFE8C0) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.3, -0.3).normalize() },
      uCloudColor: { value: new THREE.Color(0xEEF2F5) },
      uShadowColor: { value: new THREE.Color(0x6D8499) },
    },
    vertexShader: `
      attribute vec3 aOffset;
      attribute float aScale;
      attribute float aOpacity;
      attribute float aPhase;
      varying vec2 vUv;
      varying float vOpacity;
      varying vec3 vWorldPos;
      uniform float uTime;
      
      void main() {
        vUv = uv;
        vOpacity = aOpacity;
        
        vec3 offset = aOffset;
        offset.x += sin(uTime * 0.05 + aPhase) * 8.0;
        offset.z += cos(uTime * 0.04 + aPhase * 1.5) * 6.0;
        
        // Billboard rotation (faces camera strictly)
        vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0);
        mvPosition.xyz += position * aScale;
        
        vWorldPos = (modelMatrix * vec4(offset, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec3 uCloudColor;
      uniform vec3 uShadowColor;
      varying vec2 vUv;
      varying float vOpacity;
      varying vec3 vWorldPos;

      void main() {
        float d = length(vUv - 0.5);
        if (d > 0.5) discard;
        float texAlpha = smoothstep(0.5, 0.1, d); // Mathematical soft circle

        // Sub-surface scattering & volumetric light approximation
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float lightScattered = pow(max(dot(viewDir, uSunDir), 0.0), 3.0);
        
        vec3 finalColor = mix(uShadowColor, uCloudColor, texAlpha * 0.8 + 0.2);
        finalColor += uSunColor * lightScattered * 0.5 * texAlpha;
        
        gl_FragColor = vec4(finalColor, texAlpha * vOpacity * 0.8);
      }
    `
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);

  const offsets = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const opacities = new Float32Array(count);
  const phases = new Float32Array(count);

  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const r = 15 + Math.random() * 160;
    const theta = Math.random() * Math.PI * 2;
    // Lower altitude for dense fog feel in valleys, clustering up around peaks
    const y = 8 + Math.random() * 20 + Math.sin(r * 0.04) * 8;

    offsets[i * 3] = Math.cos(theta) * r;
    offsets[i * 3 + 1] = y;
    offsets[i * 3 + 2] = Math.sin(theta) * r;

    scales[i] = 1.5 + Math.random() * 3.5;
    opacities[i] = 0.3 + Math.random() * 0.6;
    phases[i] = Math.random() * Math.PI * 2;

    // Set identity matrix to bypass built-in instanced positioning (handled in vertexShader)
    dummy.position.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  group.add(mesh);
  scene.add(group);
  return { group, material: mat };
}

// ── Starfield with Milky Way ────────────────────────────────────
export function createStars(scene) {
  const count = 5000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightnesses = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const r = 180 + Math.random() * 30;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + 30;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    sizes[i] = 0.3 + Math.random() * 2.0;
    brightnesses[i] = 0.3 + Math.random() * 0.7;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute float aBrightness;
      varying float vBrightness;
      varying float vSize;
      void main() {
        vBrightness = aBrightness;
        vSize = size;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (120.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vBrightness;
      varying float vSize;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + vSize * 0.5) + vSize * 17.0);
        float core = smoothstep(0.5, 0.0, d);
        float glow = smoothstep(0.5, 0.15, d) * 0.3;
        float alpha = (core + glow) * twinkle * vBrightness;
        vec3 starColor = mix(vec3(0.9, 0.92, 1.0), vec3(1.0, 0.95, 0.85), vSize * 0.3);
        gl_FragColor = vec4(starColor, alpha);
      }
    `
  });

  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
  return { mesh: stars, material: mat };
}

// ── Hyper-Real Pine Forest ──────────────────────────────────────
export function createPineForest(scene) {
  // Load bark texture
  const barkTex = textureLoader.load('https://unpkg.com/three@0.160.0/examples/textures/wood/hardwood2_diffuse.jpg');
  barkTex.colorSpace = THREE.SRGBColorSpace;
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(1, 4);

  // More detailed tree geometry
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.14, 1.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: 0x5D4837, roughness: 0.95, metalness: 0.0,
    envMapIntensity: 0.4,
  });

  // Multi-layer foliage for realism
  const cone1 = new THREE.ConeGeometry(0.8, 1.8, 7);
  const cone2 = new THREE.ConeGeometry(0.6, 1.4, 7);
  const cone3 = new THREE.ConeGeometry(0.4, 1.0, 7);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x1A4A2A, roughness: 0.85, metalness: 0.0,
    envMapIntensity: 0.3,
  });
  const foliageDark = new THREE.MeshStandardMaterial({
    color: 0x0F3018, roughness: 0.9, metalness: 0.0,
    envMapIntensity: 0.2,
  });

  const count = 450; // Reduced for performance, positioned accurately
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const layer1Mesh = new THREE.InstancedMesh(cone1, foliageMat, count);
  const layer2Mesh = new THREE.InstancedMesh(cone2, foliageDark, count);
  const layer3Mesh = new THREE.InstancedMesh(cone3, foliageMat, count);

  // Shadows enabled for ultra-realism since count is lower
  trunkMesh.castShadow = true; trunkMesh.receiveShadow = true;
  layer1Mesh.castShadow = true; layer1Mesh.receiveShadow = true;
  layer2Mesh.castShadow = true; layer2Mesh.receiveShadow = true;
  layer3Mesh.castShadow = true; layer3Mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;

  for (let i = 0; i < count * 3; i++) {
    const x = (Math.random() - 0.5) * 120;
    const z = (Math.random() - 0.5) * 120;
    // Match the new terrain generation logic
    const valleyCurve = Math.pow(Math.abs(x) / 80, 2) * 50;
    const macro = noise.fbm(x * 0.003, z * 0.003, 4, 2.0, 0.4) * 40;
    const meso = noise.fbm(x * 0.015, z * 0.015, 3, 1.8, 0.4) * 6;
    let height = valleyCurve + macro + meso;

    const distFromCenter = Math.abs(x);
    const flattenFactor = Math.max(0, 1.0 - (distFromCenter / 25.0));
    height = height * (1.0 - flattenFactor) + (-5 * flattenFactor);
    const micro = noise.fbm(x * 0.08, z * 0.08, 2, 2.0, 0.5) * 0.5;
    height += micro;

    if (height < 3 || height > 25) continue;

    const scale = 0.4 + Math.random() * 0.9;
    const rotY = Math.random() * Math.PI * 2;

    // Trunk
    dummy.position.set(x, height + 0.6 * scale, z);
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.set(0, rotY, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(idx, dummy.matrix);

    // Bottom foliage layer
    dummy.position.set(x, height + 1.5 * scale, z);
    dummy.updateMatrix();
    layer1Mesh.setMatrixAt(idx, dummy.matrix);

    // Mid foliage
    dummy.position.set(x, height + 2.2 * scale, z);
    dummy.updateMatrix();
    layer2Mesh.setMatrixAt(idx, dummy.matrix);

    // Top foliage
    dummy.position.set(x, height + 2.7 * scale, z);
    dummy.updateMatrix();
    layer3Mesh.setMatrixAt(idx, dummy.matrix);

    idx++;
    if (idx >= count) break;
  }

  trunkMesh.count = idx;
  layer1Mesh.count = idx;
  layer2Mesh.count = idx;
  layer3Mesh.count = idx;

  [trunkMesh, layer1Mesh, layer2Mesh, layer3Mesh].forEach(m => {
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
  });

  return { trunkMesh, layer1Mesh, layer2Mesh, layer3Mesh };
}

// ── Hyper-Realistic Water Shader ────────────────────────────────
export function createWaterSurface(scene) {
  // Optimized segment count to prevent WebGL lockups
  const geo = new THREE.PlaneGeometry(60, 100, 60, 100);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x0A3040) },
      uShallowColor: { value: new THREE.Color(0x6DB8CC) },
      uFoamColor: { value: new THREE.Color(0xCCEEF5) },
      uOpacity: { value: 0.88 },
      uCamPos: { value: new THREE.Vector3() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vHeight;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying float vFoam;

      // Simplex-like hash noise
      vec2 hash(vec2 p) {
        p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
        return fract(sin(p)*43758.5453);
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Multiple wave octaves for realistic water
        float w1 = sin(pos.x * 1.5 + uTime * 0.8) * 0.06;
        float w2 = sin(pos.z * 2.1 + uTime * 1.1) * 0.04;
        float w3 = sin((pos.x + pos.z) * 3.5 + uTime * 1.6) * 0.02;
        float w4 = sin(pos.x * 0.3 + pos.z * 0.5 + uTime * 0.4) * 0.1;
        float w5 = cos(pos.z * 4.0 + pos.x * 2.0 + uTime * 2.0) * 0.01;
        float wave = w1 + w2 + w3 + w4 + w5;

        pos.y += wave;
        vHeight = wave;
        vFoam = smoothstep(0.08, 0.14, abs(wave));

        // Compute tangent-space normal from wave derivatives
        float dx = 1.5*cos(pos.x*1.5+uTime*0.8)*0.06 + 3.5*cos((pos.x+pos.z)*3.5+uTime*1.6)*0.02;
        float dz = 2.1*cos(pos.z*2.1+uTime*1.1)*0.04 + 3.5*cos((pos.x+pos.z)*3.5+uTime*1.6)*0.02;
        vNormal = normalize(vec3(-dx, 1.0, -dz));

        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform float uOpacity;
      uniform vec3 uCamPos;
      varying vec2 vUv;
      varying float vHeight;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying float vFoam;

      void main() {
        // View direction & Fresnel
        vec3 viewDir = normalize(uCamPos - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 4.0);

        // Caustics animated interference patterns
        float c1 = sin(vUv.x * 30.0 + uTime * 0.6) * sin(vUv.y * 30.0 + uTime * 0.4);
        float c2 = sin(vUv.x * 20.0 - uTime * 0.3 + vUv.y * 15.0) * sin(vUv.y * 25.0 + uTime * 0.5);
        float caustic = pow(abs(c1 + c2) * 0.5, 0.6) * 0.15;

        // Depth-based color
        float depth = smoothstep(-0.3, 0.7, vUv.y - 0.5);
        vec3 waterCol = mix(uShallowColor, uDeepColor, depth);

        // Add caustics
        waterCol += caustic * vec3(0.6, 0.9, 1.0);

        // Fresnel reflection bright sky reflection at edges
        vec3 reflColor = mix(vec3(0.7, 0.82, 0.88), vec3(0.95, 0.97, 1.0), fresnel);
        waterCol = mix(waterCol, reflColor, fresnel * 0.6);

        // Foam on wave peaks
        waterCol = mix(waterCol, uFoamColor, vFoam * 0.15);

        // Specular highlight (approximate sun)
        vec3 lightDir = normalize(vec3(0.5, 0.8, -0.3));
        vec3 halfVec = normalize(viewDir + lightDir);
        float spec = pow(max(dot(vNormal, halfVec), 0.0), 256.0);
        waterCol += spec * vec3(1.0, 0.98, 0.9) * 0.8;

        // Sub-surface scattering approximation
        float sss = pow(max(dot(-viewDir, vNormal), 0.0), 2.0) * 0.15;
        waterCol += sss * uShallowColor;

        gl_FragColor = vec4(waterCol, uOpacity + fresnel * 0.1);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -2, -15);
  scene.add(mesh);
  return { mesh, material: mat };
}

// ── Underwater Environment ──────────────────────────────────────
export function createBubbles(scene) {
  const count = 300;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = -12 + Math.random() * 24;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    speeds[i] = 0.3 + Math.random() * 1.2;
    sizes[i] = 1.0 + Math.random() * 3.0;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSpeed;
      attribute float aSize;
      uniform float uTime;
      varying float vAlpha;
      varying float vSize;
      void main() {
        vec3 pos = position;
        pos.y = mod(pos.y + uTime * aSpeed, 24.0) - 12.0;
        pos.x += sin(uTime * 0.7 + position.z * 0.5) * 0.5;
        pos.z += cos(uTime * 0.5 + position.x * 0.3) * 0.4;
        vAlpha = smoothstep(-12.0, 0.0, pos.y) * 0.5;
        vSize = aSize;
        vec4 mvp = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (100.0 / -mvp.z);
        gl_Position = projectionMatrix * mvp;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vSize;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        // Bubble with rim highlight
        float rim = smoothstep(0.25, 0.45, d) * 0.6;
        float inner = smoothstep(0.5, 0.0, d) * 0.3;
        float highlight = smoothstep(0.35, 0.2, length(gl_PointCoord - vec2(0.35, 0.35))) * 0.8;
        vec3 col = vec3(0.6, 0.85, 0.95) * inner + vec3(1.0) * highlight + vec3(0.7, 0.9, 1.0) * rim;
        float alpha = (rim + inner + highlight * 0.3) * vAlpha;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { mesh: points, material: mat };
}

// ── Photorealistic YUL Carton (using actual product images) ─────
export function createCarton(scene) {
  const group = new THREE.Group();
  group.name = 'carton';

  // Load actual product textures
  // Paper normal map for realistic texture feel
  const paperNormal = generateNormalMap(256, 256, 0.15, 0.3);
  paperNormal.repeat.set(2, 3);

  // ── Main Body ──
  const bodyW = 1.0, bodyH = 2.2, bodyD = 1.0;

  // Front face
  const frontMat = new THREE.MeshStandardMaterial({
    color: 0xE8E2D8, normalMap: paperNormal, normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.72, metalness: 0.0, envMapIntensity: 0.4,
  });

  // Back face
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xE8E2D8, normalMap: paperNormal, normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.72, metalness: 0.0, envMapIntensity: 0.4,
  });

  // Side faces plain paper material
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xE8E2D8, normalMap: paperNormal, normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.75, metalness: 0.0, envMapIntensity: 0.3,
  });

  // Top / bottom
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xDDD7CC, normalMap: paperNormal, normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.7, metalness: 0.0, envMapIntensity: 0.3,
  });

  // BoxGeometry with 6 materials: [+X, -X, +Y, -Y, +Z, -Z]
  const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  const materials = [
    paperMat,   // right
    paperMat,   // left
    topMat,     // top
    topMat,     // bottom
    frontMat,   // front
    backMat,    // back
  ];
  const body = new THREE.Mesh(bodyGeo, materials);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // ── Gable Top ──
  const gableGeo = new THREE.BufferGeometry();
  const hw = bodyW / 2, hd = bodyD / 2;
  const gableH = 0.5;
  const topY = bodyH / 2;

  const gableVerts = new Float32Array([
    // Left slope
    -hw, topY, -hd, 0, topY + gableH, -hd, -hw, topY, hd,
    0, topY + gableH, -hd, 0, topY + gableH, hd, -hw, topY, hd,
    // Right slope
    hw, topY, -hd, hw, topY, hd, 0, topY + gableH, -hd,
    0, topY + gableH, -hd, hw, topY, hd, 0, topY + gableH, hd,
    // Front triangle
    -hw, topY, -hd, hw, topY, -hd, 0, topY + gableH, -hd,
    // Back triangle
    -hw, topY, hd, 0, topY + gableH, hd, hw, topY, hd,
  ]);
  gableGeo.setAttribute('position', new THREE.BufferAttribute(gableVerts, 3));
  gableGeo.computeVertexNormals();

  const gableMat = new THREE.MeshStandardMaterial({
    color: 0xE0DAD0, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide,
    envMapIntensity: 0.8,
  });
  const gable = new THREE.Mesh(gableGeo, gableMat);
  gable.castShadow = true;
  group.add(gable);

  // ── Cap (metallic screw cap) ──
  const capBase = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 24);
  const capTop = new THREE.CylinderGeometry(0.11, 0.13, 0.1, 24);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xC0C0C8, roughness: 0.25, metalness: 0.85,
    envMapIntensity: 1.2,
  });
  const capBaseMesh = new THREE.Mesh(capBase, capMat);
  capBaseMesh.position.set(0, topY + gableH - 0.15, 0);
  capBaseMesh.castShadow = true;
  group.add(capBaseMesh);

  const capTopMesh = new THREE.Mesh(capTop, capMat);
  capTopMesh.position.set(0, topY + gableH - 0.03, 0);
  capTopMesh.castShadow = true;
  group.add(capTopMesh);

  // Cap ring detail
  const ringGeo = new THREE.TorusGeometry(0.12, 0.01, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xA0A0A8, roughness: 0.3, metalness: 0.9,
    envMapIntensity: 1.0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, topY + gableH - 0.08, 0);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Dedicated Product Lighting
  const topLight = new THREE.DirectionalLight(0xFFF0E0, 4.0);
  topLight.position.set(3, 4, 3);
  group.add(topLight);

  const fillLight = new THREE.DirectionalLight(0x6DB8CC, 2.0);
  fillLight.position.set(-2, 1, 2);
  group.add(fillLight);
  
  const frontLight = new THREE.DirectionalLight(0xFFFFFF, 1.5);
  frontLight.position.set(0, 0, 5);
  group.add(frontLight);

  group.position.set(0, 0, 0);
  group.visible = false;
  scene.add(group);
  return group;
}

// ── Sustainability Forest ───────────────────────────────────────
export function createGrowingForest(scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.1, 1.2, 6);
  const coneGeo = new THREE.ConeGeometry(0.5, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3D2817, roughness: 0.9, envMapIntensity: 0.2,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x1A5A2E, roughness: 0.8, envMapIntensity: 0.3,
  });

  const count = 500;
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leafMesh = new THREE.InstancedMesh(coneGeo, leafMat, count);
  trunkMesh.castShadow = true;
  leafMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  const treeData = [];

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    const targetScale = 0.3 + Math.random() * 1.2;

    dummy.position.set(x, -5, z);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    leafMesh.setMatrixAt(i, dummy.matrix);

    treeData.push({ x, z, targetScale, delay: Math.random() });
  }

  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.visible = false;
  leafMesh.visible = false;
  scene.add(trunkMesh);
  scene.add(leafMesh);
  return { trunkMesh, leafMesh, treeData, dummy };
}

// ── Hyper-Realistic Lighting ────────────────────────────────────
export function createLighting(scene) {
  // Main sun warm golden hour
  const sun = new THREE.DirectionalLight(0xFFD580, 1.2);
  sun.position.set(60, 50, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Fill light cool blue from opposite side
  const fillLight = new THREE.DirectionalLight(0x4488AA, 0.3);
  fillLight.position.set(-40, 30, 30);
  scene.add(fillLight);

  // Rim light subtle back lighting for depth
  const rimLight = new THREE.DirectionalLight(0xFFEECC, 0.2);
  rimLight.position.set(-10, 20, 60);
  scene.add(rimLight);

  // Ambient very subtle
  const ambient = new THREE.AmbientLight(0x1A2A3A, 0.25);
  scene.add(ambient);

  // Hemisphere for sky/ground bounce
  const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x1A3D2A, 0.35);
  scene.add(hemiLight);

  return { sun, fillLight, rimLight, ambient, hemiLight };
}

// ── Atmospheric Sky Dome ────────────────────────────────────────
export function createSkyDome(scene) {
  const geo = new THREE.SphereGeometry(3000, 64, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    uniforms: {
      uTopColor: { value: new THREE.Color(0x0D1B2A) },
      uMidColor: { value: new THREE.Color(0x2A4A6A) },
      uBottomColor: { value: new THREE.Color(0xC8DDD6) },
      uSunColor: { value: new THREE.Color(0xFFD580) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.3, -0.3).normalize() },
      uMixFactor: { value: 1.0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vDir;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uBottomColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uMixFactor;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vDir;

      void main() {
        float h = normalize(vWorldPos).y;

        // Multi-gradient sky
        vec3 col;
        if (h > 0.3) {
          col = mix(uMidColor, uTopColor, smoothstep(0.3, 0.8, h));
        } else {
          col = mix(uBottomColor, uMidColor, smoothstep(-0.1, 0.3, h));
        }

        // Sun glow
        float sunDot = max(dot(normalize(vDir), uSunDir), 0.0);
        float sunGlow = pow(sunDot, 8.0) * 0.4;
        float sunDisc = pow(sunDot, 128.0) * 2.0;
        col += uSunColor * (sunGlow + sunDisc);

        // Atmospheric scattering at horizon
        float horizonGlow = exp(-abs(h) * 8.0) * 0.2;
        col += vec3(1.0, 0.85, 0.6) * horizonGlow;

        col *= uMixFactor;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return { mesh, material: mat };
}

// ── God Rays (Volumetric Light Shafts) ──────────────────────────
export function createGodRays(scene) {
  const count = 8;
  const group = new THREE.Group();
  group.name = 'godRays';

  for (let i = 0; i < count; i++) {
    const geo = new THREE.PlaneGeometry(1.5, 25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xFFE8C0,
      transparent: true,
      opacity: 0.03 + Math.random() * 0.04,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ray = new THREE.Mesh(geo, mat);
    ray.position.set(
      (Math.random() - 0.5) * 30,
      15 + Math.random() * 10,
      -10 + Math.random() * 20
    );
    ray.rotation.set(
      Math.random() * 0.2,
      Math.random() * Math.PI,
      Math.random() * 0.3
    );
    group.add(ray);
  }

  scene.add(group);
  return group;
}

// ── Mist Layers (Ground Fog) ────────────────────────────────────
export function createMistLayers(scene) {
  const group = new THREE.Group();
  group.name = 'mist';

  for (let i = 0; i < 12; i++) {
    const geo = new THREE.PlaneGeometry(40 + Math.random() * 30, 3 + Math.random() * 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xC8DDD6,
      transparent: true,
      opacity: 0.04 + Math.random() * 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(
      (Math.random() - 0.5) * 100,
      2 + Math.random() * 6,
      (Math.random() - 0.5) * 100
    );
    plane.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    plane.rotation.z = Math.random() * Math.PI;
    group.add(plane);
  }

  scene.add(group);
  return group;
}
