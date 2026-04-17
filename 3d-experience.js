/* ====================================================================
   YUL 3D — Main Experience Orchestrator
   Camera path, scroll sync, scene transitions, UI controls
   ==================================================================== */
import './3d-experience.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { mapRange } from './3d-utils.js';
import {
    createMountains, createClouds, createStars, createPineForest,
    createWaterSurface, createBubbles, createCarton,
    createGrowingForest, createLighting, createSkyDome,
    createGodRays, createMistLayers, loadEnvironmentMap
} from './3d-scenes.js';

gsap.registerPlugin(ScrollTrigger);

// ── State ───────────────────────────────────────────────────────
let renderer, camera, scene, clock;
let scrollProgress = 0;
let isLoaded = false;
let audioMuted = true;

// Scene objects (populated after init)
let clouds, stars, water, bubbles, carton, forest, sky, lights, godRays, mist;

// ── Camera Path Keyframes ───────────────────────────────────────
// Each keyframe: { progress, position, lookAt }
const CAMERA_PATH = [
    { p: 0.00, pos: [0, 45, 60], look: [0, 15, 0] },
    { p: 0.08, pos: [0, 25, 40], look: [0, 10, -10] },
    { p: 0.15, pos: [0, 15, 20], look: [0, 5, -20] },
    { p: 0.22, pos: [0, 8, 0], look: [0, 2, -30] },
    { p: 0.30, pos: [0, 3, -25], look: [0, -1, -40] },
    { p: 0.35, pos: [0, 0, -32], look: [0, -2, -40] },
    { p: 0.42, pos: [0, -1.5, -36], look: [0, -3, -40] },
    { p: 0.48, pos: [0, -3.5, -38], look: [0, -0.5, -40] }, // Safe depth above -5 floor
    { p: 0.55, pos: [0, -1, -34], look: [0, 0, -40] },
    { p: 0.62, pos: [0, 2, -32], look: [0, 0, -40] },   // Carton hero framing
    { p: 0.68, pos: [0, 3, -30], look: [0, 0, -40] },
    { p: 0.75, pos: [0, 8, -20], look: [0, 1, -40] },
    { p: 0.85, pos: [0, 15, 0], look: [0, 0, -40] },
    { p: 0.95, pos: [0, 25, 20], look: [0, -5, -40] },
    { p: 1.00, pos: [0, 40, 40], look: [0, -5, -40] },
];

function getCameraState(progress) {
    let i = 0;
    for (; i < CAMERA_PATH.length - 1; i++) {
        if (progress <= CAMERA_PATH[i + 1].p) break;
    }
    const a = CAMERA_PATH[i];
    const b = CAMERA_PATH[Math.min(i + 1, CAMERA_PATH.length - 1)];
    const t = a.p === b.p ? 0 : (progress - a.p) / (b.p - a.p);
    // Smooth step
    const st = t * t * (3 - 2 * t);

    return {
        pos: a.pos.map((v, j) => v + (b.pos[j] - v) * st),
        look: a.look.map((v, j) => v + (b.look[j] - v) * st),
    };
}

// ── Init ────────────────────────────────────────────────────────
function init() {
    const canvas = document.getElementById('yul-3d-canvas');

    // Hyper-realistic Renderer
    renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene & camera
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0D1B2A, 0.006); // Dark cinematic fog for UI contrast
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 45, 60);

    clock = new THREE.Clock();

    // Build hyper-realistic scenes
    createMountains(scene);
    clouds = createClouds(scene); // Re-enabled soft distant clouds
    stars = createStars(scene);
    // createPineForest(scene); // Disabled to make mountains look like distant Himalayan peaks
    water = createWaterSurface(scene);
    bubbles = createBubbles(scene);
    carton = createCarton(scene);
    // forest = createGrowingForest(scene); // Disabled per 'Do not render the Trees' instruction
    lights = createLighting(scene);
    sky = createSkyDome(scene);
    // godRays = createGodRays(scene); // Disabled as they render as sharp transparent planes
    // mist = createMistLayers(scene); // Disabled as they render as sharp transparent planes too

    // Load environment map for PBR reflections
    loadEnvironmentMap(renderer, scene);

    // Position carton at spring location
    carton.position.set(0, 0, -40);

    // Events
    window.addEventListener('resize', onResize);

    // Smooth scroll
    setupScroll();
    setupUI();

    // Fake loading progress
    simulateLoading();

    // Render loop
    animate();
}

// ── Loading Simulation ──────────────────────────────────────────
function simulateLoading() {
    const fill = document.getElementById('preloader-fill');
    const text = document.getElementById('preloader-text');
    let progress = 0;
    const messages = [
        'Locating spring at 27°28\'N, 89°38\'E...',
        'Mapping Himalayan terrain...',
        'Rendering cloud formations...',
        'Initializing water shaders...',
        'Preparing experience...'
    ];

    const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress > 100) progress = 100;
        fill.style.width = progress + '%';
        text.textContent = messages[Math.min(Math.floor(progress / 25), messages.length - 1)];

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('preloader').classList.add('hidden');
                document.getElementById('yul-nav').classList.remove('hidden');
                isLoaded = true;
                // Animate hero content in
                gsap.to('#scene-1 .scene-content', {
                    opacity: 1, duration: 1.5, delay: 0.3, ease: 'power2.out'
                });
            }, 400);
        }
    }, 200);
}

// ── Smooth Scroll + ScrollTrigger ───────────────────────────────
function setupScroll() {
    const lenis = new Lenis({ smoothWheel: true, wheelMultiplier: 0.8 });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Master scroll progress
    ScrollTrigger.create({
        trigger: '#scroll-container',
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
            scrollProgress = self.progress;
            document.getElementById('nav-progress-fill').style.width = (scrollProgress * 100) + '%';
        }
    });

    // Scene content reveals
    setupSceneReveals();
}

function setupSceneReveals() {
    // Scene 1 hero — hide scroll cue after scrolling
    ScrollTrigger.create({
        trigger: '#scene-1',
        start: 'top top',
        end: '30% top',
        onLeave: () => document.getElementById('scroll-cue')?.classList.add('hidden'),
        onEnterBack: () => document.getElementById('scroll-cue')?.classList.remove('hidden'),
    });

    // Scene 2 panels
    createReveal('#panel-bhutan', '#scene-2', '10% top', '80% top');
    createReveal('#panel-gathered', '#scene-2', '40% top', '90% top');

    // Scene 3
    createReveal('#panel-alkaline', '#scene-3', '20% top', '80% top');

    // Scene 4
    createReveal('#panel-pure', '#scene-4', '20% top', '80% top');

    // Scene 5
    createReveal('#panel-carton', '#scene-5', '15% top', '70% top');

    // Scene 6
    createReveal('#panel-sustainability', '#scene-6', '10% top', '50% top');
    createReveal('#panel-stats', '#scene-6', '30% top', '90% top');

    // Scene 7
    createReveal('#panel-partners', '#scene-7', '15% top', '85% top');

    // Scene 8
    createReveal('#panel-footer', '#scene-8', '15% top', '90% top');

    // Nav scroll state
    ScrollTrigger.create({
        trigger: '#scroll-container',
        start: '100px top',
        onEnter: () => document.getElementById('yul-nav')?.classList.add('scrolled'),
        onLeaveBack: () => document.getElementById('yul-nav')?.classList.remove('scrolled'),
    });

    // Stats counter animation
    ScrollTrigger.create({
        trigger: '#scene-6',
        start: '30% top',
        once: true,
        onEnter: () => animateStats(),
    });
}

function createReveal(target, trigger, start, end) {
    ScrollTrigger.create({
        trigger,
        start,
        end,
        onEnter: () => document.querySelector(target)?.classList.add('visible'),
        onLeave: () => document.querySelector(target)?.classList.remove('visible'),
        onEnterBack: () => document.querySelector(target)?.classList.add('visible'),
        onLeaveBack: () => document.querySelector(target)?.classList.remove('visible'),
    });
}

function animateStats() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseFloat(el.dataset.value);
        const obj = { val: 0 };
        gsap.to(obj, {
            val: target,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => {
                el.textContent = target < 0 ? obj.val.toFixed(1)
                    : target > 100 ? Math.floor(obj.val)
                        : Math.floor(obj.val);
            }
        });
    });
}

// ── UI Setup ────────────────────────────────────────────────────
function setupUI() {
    // Audio toggle
    document.getElementById('audio-toggle')?.addEventListener('click', () => {
        audioMuted = !audioMuted;
        const onIcon = document.querySelector('.audio-on');
        const offIcon = document.querySelector('.audio-off');
        if (audioMuted) {
            onIcon.style.display = 'none';
            offIcon.style.display = 'block';
        } else {
            onIcon.style.display = 'block';
            offIcon.style.display = 'none';
        }
    });

    // Custom cursor
    document.addEventListener('mousemove', (e) => {
        const cursor = document.getElementById('custom-cursor');
        if (cursor) {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        }
    });

    // Hover effect on interactive elements
    document.querySelectorAll('a, button, .cta-btn').forEach(el => {
        el.addEventListener('mouseenter', () =>
            document.getElementById('custom-cursor')?.classList.add('hover'));
        el.addEventListener('mouseleave', () =>
            document.getElementById('custom-cursor')?.classList.remove('hover'));
    });

    // Nav links — scroll to scene
    document.querySelectorAll('.nav-link[data-scene]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sceneId = link.dataset.scene;
            const target = document.getElementById('scene-' + sceneId);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Active nav highlighting
    document.querySelectorAll('.scene-section').forEach(section => {
        ScrollTrigger.create({
            trigger: section,
            start: 'top center',
            end: 'bottom center',
            onEnter: () => highlightNav(section.dataset.scene),
            onEnterBack: () => highlightNav(section.dataset.scene),
        });
    });
}

function highlightNav(sceneId) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const map = { '1': '1', '2': '1', '3': '1', '5': '5', '6': '5', '7': '7', '8': '7' };
    const target = map[sceneId] || sceneId;
    document.querySelector(`.nav-link[data-scene="${target}"]`)?.classList.add('active');
}

// ── Mouse Parallax Removed ──────────────────────────────────────

// ── Resize ──────────────────────────────────────────────────────
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ── Render Loop ─────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Update camera from scroll progress
    const camState = getCameraState(scrollProgress);

    camera.position.set(camState.pos[0], camState.pos[1], camState.pos[2]);
    camera.lookAt(camState.look[0], camState.look[1], camState.look[2]);

    // Update shader uniforms
    if (clouds?.material?.uniforms) clouds.material.uniforms.uTime.value = time;
    if (stars?.material?.uniforms) stars.material.uniforms.uTime.value = time;
    if (water?.material?.uniforms) {
        water.material.uniforms.uTime.value = time;
        water.material.uniforms.uCamPos.value.copy(camera.position);
    }
    if (bubbles?.material?.uniforms) bubbles.material.uniforms.uTime.value = time;
    if (sky?.material?.uniforms) sky.material.uniforms.uTime.value = time;

    // Scene-specific updates
    updateScene(time);

    renderer.render(scene, camera);
}

function updateScene(time) {
    // Fog density and color based on scene
    if (scrollProgress < 0.12) {
        // Above clouds 
        scene.fog.color.set(0x0D1B2A);
        scene.fog.density = mapRange(scrollProgress, 0, 0.12, 0.005, 0.02);
    } else if (scrollProgress < 0.3) {
        // Mountains
        scene.fog.color.set(0x0D1B2A);
        scene.fog.density = mapRange(scrollProgress, 0.12, 0.3, 0.02, 0.008);
    } else if (scrollProgress < 0.48) {
        // Spring
        scene.fog.color.set(0x0A1F2D);
        scene.fog.density = 0.01;
    } else if (scrollProgress < 0.58) {
        // Underwater
        scene.fog.color.set(0x05131C);
        scene.fog.density = mapRange(scrollProgress, 0.48, 0.55, 0.01, 0.05);
    } else {
        // Carton & Beyond 
        scene.fog.color.set(0x0D1B2A);
        scene.fog.density = mapRange(scrollProgress, 0.58, 1.0, 0.015, 0.004);
    }

    // Carton visibility and animation
    if (scrollProgress > 0.55 && scrollProgress < 0.75) {
        carton.visible = true;
        const cartonProgress = mapRange(scrollProgress, 0.58, 0.72, 0, 1);
        const scale = mapRange(cartonProgress, 0, 0.5, 0.3, 1.0);
        carton.scale.setScalar(Math.min(scale, 1.0));
        carton.rotation.y = time * 0.3 + cartonProgress * Math.PI;
        carton.position.y = mapRange(cartonProgress, 0, 0.3, -5, 12);

        // Update hotspots
        updateHotspots(cartonProgress);
    } else {
        carton.visible = false;
        hideHotspots();
    }

    // Growing forest (Scene 6) — dual mesh system
    if (forest) {
        if (scrollProgress > 0.72 && scrollProgress < 0.85) {
            forest.trunkMesh.visible = true;
            forest.leafMesh.visible = true;
            const forestProgress = mapRange(scrollProgress, 0.72, 0.82, 0, 1);
            const dummy = forest.dummy;

            forest.treeData.forEach((tree, i) => {
                const treeT = Math.max(0, Math.min(1, (forestProgress - tree.delay * 0.3) * 3));
                const s = tree.targetScale * treeT;
                // Trunk
                dummy.position.set(tree.x, -5 + s * 0.6, tree.z);
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                forest.trunkMesh.setMatrixAt(i, dummy.matrix);
                // Leaf canopy
                dummy.position.set(tree.x, -5 + s * 1.8, tree.z);
                dummy.updateMatrix();
                forest.leafMesh.setMatrixAt(i, dummy.matrix);
            });
            forest.trunkMesh.instanceMatrix.needsUpdate = true;
            forest.leafMesh.instanceMatrix.needsUpdate = true;
        } else {
            forest.trunkMesh.visible = false;
            forest.leafMesh.visible = false;
        }
    }

    // Sky color transition for sustainability scene
    if (sky?.material?.uniforms) {
        if (scrollProgress > 0.72 && scrollProgress < 0.85) {
            const skyT = mapRange(scrollProgress, 0.72, 0.80, 0, 1);
            sky.material.uniforms.uBottomColor.value.lerpColors(
                new THREE.Color(0xC8DDD6), new THREE.Color(0x87CEEB), skyT
            );
        }
    }

    // Water visibility
    if (water?.mesh) {
        water.mesh.visible = (scrollProgress > 0.28 && scrollProgress < 0.60);
    }

    // Bubbles visibility
    if (bubbles?.mesh) {
        bubbles.mesh.visible = (scrollProgress > 0.45 && scrollProgress < 0.60);
    }

    // Stars brightness based on altitude
    if (stars?.mesh) {
        stars.mesh.visible = (scrollProgress < 0.15 || scrollProgress > 0.92);
    }
}

// ── Hotspot Positioning ─────────────────────────────────────────
function updateHotspots(cartonProgress) {
    if (cartonProgress < 0.5 || cartonProgress > 0.95) {
        hideHotspots();
        return;
    }

    const hotspotPositions = [
        { id: 'hs-1', offset: [0, 0.5, 0.6] },
        { id: 'hs-2', offset: [0, -0.5, 0.6] },
        { id: 'hs-3', offset: [0, 1.7, 0] },
        { id: 'hs-4', offset: [-0.6, 0, 0] },
        { id: 'hs-5', offset: [0.6, 0, 0] },
    ];

    hotspotPositions.forEach(hs => {
        const el = document.getElementById(hs.id);
        if (!el) return;

        const worldPos = new THREE.Vector3(
            carton.position.x + hs.offset[0],
            carton.position.y + hs.offset[1],
            carton.position.z + hs.offset[2]
        );
        const screenPos = worldPos.project(camera);
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        if (screenPos.z < 1 && x > 0 && x < window.innerWidth && y > 0 && y < window.innerHeight) {
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.classList.add('visible');
        } else {
            el.classList.remove('visible');
        }
    });
}

function hideHotspots() {
    document.querySelectorAll('.hotspot').forEach(h => h.classList.remove('visible'));
}

// ── Start ───────────────────────────────────────────────────────
init();
