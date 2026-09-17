import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Experience from './Experience.js';

// Film look: warm grade by day, cooler at night, soft vignette, a whisper of grain.
// Runs in linear HDR before the OutputPass tone-maps.
const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uNight: { value: 0 },
        uVignette: { value: 0.9 },
        uGrain: { value: 0.035 },
        uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uNight;
        uniform float uVignette;
        uniform float uGrain;
        uniform vec2 uResolution;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            vec3 col = c.rgb;

            // Grade: sun-warmed by day, moonlit teal at night
            vec3 warm = col * vec3(1.045, 1.0, 0.955);
            vec3 cool = col * vec3(0.92, 0.985, 1.09);
            col = mix(warm, cool, uNight);

            // Gentle S-curve on the displayable range, HDR highlights untouched
            vec3 s = clamp(col, 0.0, 1.0);
            col = mix(col, s * s * (3.0 - 2.0 * s) + max(col - 1.0, 0.0), 0.16);

            // Vignette
            vec2 q = vUv - 0.5;
            q.x *= uResolution.x / uResolution.y;
            float v = 1.0 - dot(q, q) * uVignette * 0.55;
            col *= clamp(v, 0.0, 1.0);

            // Grain
            float g = hash(vUv * uResolution + fract(uTime * 7.31) * 113.0) - 0.5;
            col += g * uGrain * (0.6 + uNight * 0.8);

            gl_FragColor = vec4(col, c.a);
        }
    `,
};

export default class Renderer {
    constructor() {
        this.experience = Experience.getInstance();
        this.canvas = this.experience.canvas;
        this.sizes = this.experience.sizes;
        this.scene = this.experience.scene;
        this.camera = this.experience.camera;

        this.quality = this.detectQuality();
        this.listeners = [];
        this.preRenderCallbacks = [];
        this.night = 0;

        this.setInstance();
        this.createQualityToggle();

        this.sizes.on('resize', () => this.resize());
    }

    onQualityChange(cb) {
        this.listeners.push(cb);
    }

    /** Runs right before the main render (reflections, video textures...). */
    addPreRender(cb) {
        this.preRenderCallbacks.push(cb);
    }

    /**
     * Night mood 0..1 from Environment: lanterns, campfire and the lighthouse
     * need to bloom after dark, while the day stays crisp.
     */
    setMood(night) {
        this.night = night;
        if (this.bloomPass) {
            this.bloomPass.threshold = THREE.MathUtils.lerp(1.6, 0.75, night);
            this.bloomPass.strength = THREE.MathUtils.lerp(0.25, 0.7, night);
            this.bloomPass.radius = THREE.MathUtils.lerp(0.5, 0.7, night);
        }
        if (this.gradePass) this.gradePass.uniforms.uNight.value = night;
    }

    detectQuality() {
        const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            (coarse && navigator.maxTouchPoints > 0) ||
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

        this.gradePass = new ShaderPass(GradeShader);
        this.gradePass.uniforms.uResolution.value.set(this.sizes.width, this.sizes.height);
        this.composer.addPass(this.gradePass);

        this.composer.addPass(new OutputPass());
        this.setMood(this.night);
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

    toggleQuality() {
        this.quality = this.quality === 'high' ? 'low' : 'high';
        this.updateToggleLabel();
        this.experience.emit('quality:change', this.quality);

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
        if (this.gradePass) {
            this.gradePass.uniforms.uResolution.value.set(this.sizes.width, this.sizes.height);
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
        for (const cb of this.preRenderCallbacks) cb();

        if (this.quality === 'high' && this.composer) {
            if (this.gradePass) this.gradePass.uniforms.uTime.value = performance.now() / 1000;
            this.composer.render();
        } else {
            this.instance.render(this.scene, this.camera.instance);
        }

        if (this.css2dRenderer) {
            this.css2dRenderer.render(this.scene, this.camera.instance);
        }
    }
}
