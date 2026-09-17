import * as THREE from 'three';
import Experience from '../Experience.js';

/**
 * Weather beats. Every few minutes a squall rolls through: the wave field
 * grows, the sky darkens, rain streaks past the camera, thunder cracks, and
 * once it clears a rainbow hangs opposite the sun. Wind gusts run all the
 * time and are read by the sail, pennant and palms.
 *
 * Exposes: intensity (0..1 squall), wind (0..1 gust), rainbow (0..1), flash (0..1).
 */
const FIRST_SQUALL_S = 170;
const SQUALL_EVERY_S = [260, 380];
const BUILD_S = 24;
const HOLD_S = 42;
const CLEAR_S = 26;
const RAINBOW_S = 48;

export default class Weather {
    constructor(ocean) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.renderer = this.experience.renderer;
        this.ocean = ocean;

        this.intensity = 0;
        this.wind = 0;
        this.rainbow = 0;
        this.flash = 0;
        this.phase = 'clear';
        this.phaseT = 0;
        this.enabled = false;
        this.nextSquall = FIRST_SQUALL_S;
        this.clock = 0;

        this.gustTarget = 0;
        this.nextGust = 12;
        this.gustEnd = 0;
        this.nextBolt = 0;

        this.buildRain();
        this.buildRainbow();

        this.experience.on('intro:done', () => { this.enabled = true; });
        this.renderer.onQualityChange(() => this.applyQuality());
        this.applyQuality();

        this.experience.addUpdate(7, () => this.update());
    }

    // ── Rain ─────────────────────────────────────────────────────────────

    buildRain() {
        this.rainCount = 2200;
        this.rainBox = new THREE.Vector3(42, 26, 42);
        const pos = new Float32Array(this.rainCount * 3);
        const seed = new Float32Array(this.rainCount);
        for (let i = 0; i < this.rainCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * this.rainBox.x;
            pos[i * 3 + 1] = Math.random() * this.rainBox.y;
            pos[i * 3 + 2] = (Math.random() - 0.5) * this.rainBox.z;
            seed[i] = Math.random();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

        this.rainMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 0 },
                uHeight: { value: this.rainBox.y },
                uPixelRatio: { value: this.renderer.instance.getPixelRatio() },
                uWind: { value: new THREE.Vector2(0.6, 0.2) },
            },
            vertexShader: /* glsl */ `
                attribute float aSeed;
                uniform float uTime;
                uniform float uHeight;
                uniform float uPixelRatio;
                uniform vec2 uWind;
                varying float vAlpha;
                void main() {
                    vec3 p = position;
                    float speed = 16.0 + aSeed * 8.0;
                    // Fall and wrap within the box; drift with the wind
                    p.y = mod(position.y - uTime * speed, uHeight);
                    p.x += uWind.x * (uHeight - p.y) * 0.35;
                    p.z += uWind.y * (uHeight - p.y) * 0.35;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    gl_Position = projectionMatrix * mv;
                    float dist = -mv.z;
                    gl_PointSize = clamp(160.0 / dist, 3.0, 26.0) * uPixelRatio;
                    vAlpha = smoothstep(1.5, 5.0, dist) * (0.35 + aSeed * 0.4);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uOpacity;
                varying float vAlpha;
                void main() {
                    // Thin vertical streak inside the point sprite
                    vec2 c = gl_PointCoord - 0.5;
                    if (abs(c.x) > 0.07) discard;
                    float a = (1.0 - abs(c.y) * 2.0) * vAlpha * uOpacity;
                    gl_FragColor = vec4(0.82, 0.9, 0.96, a);
                }
            `,
        });
        this.rain = new THREE.Points(geo, this.rainMat);
        this.rain.frustumCulled = false;
        this.rain.visible = false;
        this.rain.renderOrder = 5;
        this.scene.add(this.rain);
    }

    // ── Rainbow ──────────────────────────────────────────────────────────

    buildRainbow() {
        const geo = new THREE.RingGeometry(58, 66, 72, 1, 0, Math.PI);
        this.rainbowMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: { uOpacity: { value: 0 }, uInner: { value: 58 }, uOuter: { value: 66 } },
            vertexShader: /* glsl */ `
                varying vec2 vPos;
                void main() {
                    vPos = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uOpacity;
                uniform float uInner;
                uniform float uOuter;
                varying vec2 vPos;
                vec3 hue(float h) {
                    vec3 c = abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0;
                    return clamp(c, 0.0, 1.0);
                }
                void main() {
                    float r = length(vPos);
                    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
                    // Red on the outside, violet inside; soft edges; fade near the sea
                    vec3 col = hue(0.78 - t * 0.78);
                    float band = sin(t * 3.14159);
                    float base = smoothstep(0.0, 0.25, vPos.y / uInner);
                    gl_FragColor = vec4(col, band * base * uOpacity * 0.42);
                }
            `,
        });
        this.rainbowMesh = new THREE.Mesh(geo, this.rainbowMat);
        this.rainbowMesh.frustumCulled = false;
        this.rainbowMesh.visible = false;
        this.rainbowMesh.renderOrder = 2;
        this.scene.add(this.rainbowMesh);
    }

    applyQuality() {
        const high = this.renderer.quality === 'high';
        this.rain.geometry.setDrawRange(0, high ? this.rainCount : Math.floor(this.rainCount * 0.4));
        this.rainMat.uniforms.uPixelRatio.value = this.renderer.instance.getPixelRatio();
    }

    // ── Squall control ───────────────────────────────────────────────────

    /** Start a squall now (also used from the console for testing). */
    startSquall() {
        if (this.phase !== 'clear' && this.phase !== 'rainbow') return;
        this.phase = 'building';
        this.phaseT = 0;
        this.rainbow = 0;
        this.nextBolt = 6;
        const ui = this.experience.world ? this.experience.world.ui : null;
        if (ui) ui.toast('A SQUALL ROLLS IN — HOLD HER STEADY', 3200);
        this.experience.emit('weather:squall');
        const audio = this.experience.audio;
        if (audio) audio.setRain(true);
    }

    bolt() {
        this.flash = 1;
        const audio = this.experience.audio;
        const cam = this.experience.camera;
        const delay = 350 + Math.random() * 1200;
        setTimeout(() => {
            if (audio) audio.playSFX('thunder');
            if (cam) cam.addShake(0.35);
        }, delay);
    }

    update() {
        const dt = Math.min(this.time.delta / 1000, 0.1);
        const t = this.time.elapsed / 1000;
        const env = this.experience.world ? this.experience.world.environment : null;
        const sunUp = env ? env.sunElevation().elevation > 0.12 : true;

        // ── Gusts (always on) ────────────────────────────────────────────
        if (this.enabled) this.clock += dt;
        if (this.clock > this.nextGust) {
            this.gustTarget = 0.45 + Math.random() * 0.55;
            this.gustEnd = this.clock + 4 + Math.random() * 5;
            this.nextGust = this.gustEnd + 14 + Math.random() * 26;
        }
        if (this.clock > this.gustEnd) this.gustTarget = 0;
        const windGoal = Math.max(this.gustTarget, this.intensity * 0.75);
        this.wind += (windGoal - this.wind) * Math.min(1, dt * (windGoal > this.wind ? 1.4 : 0.6));

        // ── Squall state machine ─────────────────────────────────────────
        if (this.enabled && this.phase === 'clear' && this.clock > this.nextSquall) this.startSquall();

        this.phaseT += dt;
        switch (this.phase) {
            case 'building':
                this.intensity = THREE.MathUtils.smoothstep(this.phaseT / BUILD_S, 0, 1);
                if (this.phaseT > BUILD_S) { this.phase = 'squall'; this.phaseT = 0; }
                break;
            case 'squall':
                this.intensity = 1;
                if (this.phaseT > this.nextBolt) {
                    this.bolt();
                    this.nextBolt = this.phaseT + 7 + Math.random() * 12;
                }
                if (this.phaseT > HOLD_S) { this.phase = 'clearing'; this.phaseT = 0; }
                break;
            case 'clearing':
                this.intensity = 1 - THREE.MathUtils.smoothstep(this.phaseT / CLEAR_S, 0, 1);
                if (this.phaseT > CLEAR_S) {
                    this.phase = 'rainbow';
                    this.phaseT = 0;
                    this.intensity = 0;
                    const audio = this.experience.audio;
                    if (audio) audio.setRain(false);
                    this.nextSquall = this.clock + SQUALL_EVERY_S[0] + Math.random() * (SQUALL_EVERY_S[1] - SQUALL_EVERY_S[0]);
                    this.experience.emit('weather:clear');
                }
                break;
            case 'rainbow': {
                const k = this.phaseT / RAINBOW_S;
                this.rainbow = sunUp ? Math.sin(Math.min(k, 1) * Math.PI) : 0;
                if (this.phaseT > RAINBOW_S) { this.phase = 'clear'; this.phaseT = 0; this.rainbow = 0; }
                break;
            }
            default:
                this.intensity = 0;
        }

        this.flash *= Math.exp(-dt * 9);
        if (this.flash < 0.003) this.flash = 0;

        // ── Apply ────────────────────────────────────────────────────────
        this.ocean.waveScale = 1 + this.intensity * 0.85;

        const audio = this.experience.audio;
        if (audio) audio.setRainLevel(this.intensity);

        const cam = this.experience.camera ? this.experience.camera.instance : null;
        const raining = this.intensity > 0.02;
        this.rain.visible = raining;
        if (raining && cam) {
            this.rain.position.set(cam.position.x, cam.position.y - this.rainBox.y * 0.6, cam.position.z);
            this.rainMat.uniforms.uTime.value = t;
            this.rainMat.uniforms.uOpacity.value = this.intensity;
            this.rainMat.uniforms.uWind.value.set(0.4 + this.wind * 0.6, 0.15);
        }

        const showBow = this.rainbow > 0.01;
        this.rainbowMesh.visible = showBow;
        if (showBow && cam && env) {
            // Opposite the sun, standing on the horizon, facing the camera
            const anti = env.sunDir;
            const dx = -anti.x, dz = -anti.z;
            const len = Math.hypot(dx, dz) || 1;
            this.rainbowMesh.position.set(cam.position.x + (dx / len) * 150, -6, cam.position.z + (dz / len) * 150);
            this.rainbowMesh.lookAt(cam.position.x, -6, cam.position.z);
            this.rainbowMat.uniforms.uOpacity.value = this.rainbow;
        }
    }
}
