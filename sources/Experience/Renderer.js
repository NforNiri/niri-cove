import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Experience from './Experience.js';

export default class Renderer {
    constructor() {
        this.experience = Experience.getInstance();
        this.canvas = this.experience.canvas;
        this.sizes = this.experience.sizes;
        this.scene = this.experience.scene;
        this.camera = this.experience.camera;

        this.quality = this.detectQuality();
        this.listeners = [];

        this.setInstance();
        this.createQualityToggle();
        this.createControlsHint();

        this.sizes.on('resize', () => this.resize());
    }

    onQualityChange(cb) {
        this.listeners.push(cb);
    }

    detectQuality() {
        const isMobile = navigator.maxTouchPoints > 1 ||
            /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            window.innerWidth < 1024;

        let gpuTier = 'mid';
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (gl) {
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            if (info) {
                const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL).toLowerCase();
                if (name.includes('intel') || name.includes('mesa') || name.includes('swiftshader')) gpuTier = 'low';
                if (name.includes('nvidia') || name.includes('radeon') || name.includes('geforce') || name.includes('apple m')) gpuTier = 'high';
            }
        }

        if (isMobile || gpuTier === 'low') return 'low';
        return 'high';
    }

    setInstance() {
        this.instance = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.quality === 'high',
            powerPreference: this.quality === 'low' ? 'low-power' : 'high-performance',
        });

        this.instance.outputColorSpace = THREE.SRGBColorSpace;
        this.instance.toneMapping = THREE.ACESFilmicToneMapping;
        this.instance.toneMappingExposure = 1.05;

        this.instance.shadowMap.enabled = this.quality === 'high';
        this.instance.shadowMap.type = THREE.PCFShadowMap;

        // Horizon haze color; the sky dome covers it but it shows during load
        this.instance.setClearColor(0xBFE3E6, 1);

        if (this.quality === 'high') {
            this.setPostProcessing();
        }

        this.setCSS2DRenderer();
        this.resize();
    }

    setPostProcessing() {
        this.composer = new EffectComposer(this.instance);
        this.composer.addPass(new RenderPass(this.scene, this.camera.instance));

        // Very gentle bloom. Threshold is in linear HDR (pre-tonemap), so it must sit
        // above sunlit sand (~1.2) and only catch glints, lanterns and emissives.
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.sizes.width, this.sizes.height),
            0.25,
            0.5,
            1.6
        );
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());
    }

    setCSS2DRenderer() {
        this.css2dRenderer = new CSS2DRenderer();
        this.css2dRenderer.setSize(this.sizes.width, this.sizes.height);
        const el = this.css2dRenderer.domElement;
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.pointerEvents = 'none';
        document.body.appendChild(el);
    }

    createQualityToggle() {
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.id = 'quality-toggle';
        this.toggleBtn.className = 'hud-chip';
        this.toggleBtn.title = 'Toggle quality (H key)';
        this.updateToggleLabel();
        document.body.appendChild(this.toggleBtn);

        this.toggleBtn.addEventListener('click', () => this.toggleQuality());
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyH') this.toggleQuality();
        });
    }

    updateToggleLabel() {
        this.toggleBtn.textContent = this.quality === 'high' ? 'Quality: Fine' : 'Quality: Swift';
    }

    createControlsHint() {
        const hint = document.createElement('div');
        hint.id = 'controls-hint';
        hint.innerHTML = `
            <div class="hint-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Sail</span></div>
            <div class="hint-row"><kbd>Shift</kbd><span>Full sail</span></div>
            <div class="hint-row"><kbd>Space</kbd><span>Drop anchor</span></div>
        `;
        document.body.appendChild(hint);
    }

    toggleQuality() {
        this.quality = this.quality === 'high' ? 'low' : 'high';
        this.updateToggleLabel();

        this.instance.shadowMap.enabled = this.quality === 'high';
        this.instance.shadowMap.needsUpdate = true;

        if (this.quality === 'high' && !this.composer) {
            this.setPostProcessing();
        }

        this.resize();
        for (const cb of this.listeners) cb(this.quality);
    }

    resize() {
        this.instance.setSize(this.sizes.width, this.sizes.height);

        const pr = this.quality === 'low' ? 1 : this.sizes.pixelRatio;
        this.instance.setPixelRatio(pr);

        if (this.composer) {
            this.composer.setSize(this.sizes.width, this.sizes.height);
            this.composer.setPixelRatio(pr);
        }

        if (this.css2dRenderer) {
            this.css2dRenderer.setSize(this.sizes.width, this.sizes.height);
        }
    }

    /**
     * Adaptive tier: once the player is sailing, watch the frame budget for a
     * few seconds. If HIGH cannot hold ~30 fps we drop to LOW on their behalf
     * (they can always flip it back with the chip).
     */
    startAdaptiveQuality() {
        if (this.quality !== 'high' || this.adaptiveArmed) return;
        this.adaptiveArmed = true;
        const samples = [];
        let last = performance.now();
        const started = last;
        const tick = () => {
            const now = performance.now();
            samples.push(now - last);
            last = now;
            if (now - started < 6000 && this.quality === 'high') {
                requestAnimationFrame(tick);
                return;
            }
            if (this.quality !== 'high') return;
            // Skip the first second (shader compile / GC spikes), then take the median
            const steady = samples.slice(Math.min(60, samples.length - 1)).sort((a, b) => a - b);
            const median = steady[Math.floor(steady.length / 2)] || 0;
            if (median > 32) {
                console.info(`[Renderer] median frame ${median.toFixed(1)}ms on HIGH — switching to Swift`);
                this.toggleQuality();
                this.toggleBtn.classList.add('hud-chip-pulse');
                setTimeout(() => this.toggleBtn.classList.remove('hud-chip-pulse'), 2400);
            }
        };
        requestAnimationFrame(tick);
    }

    render() {
        if (this.quality === 'high' && this.composer) {
            this.composer.render();
        } else {
            this.instance.render(this.scene, this.camera.instance);
        }

        if (this.css2dRenderer) {
            this.css2dRenderer.render(this.scene, this.camera.instance);
        }
    }
}
