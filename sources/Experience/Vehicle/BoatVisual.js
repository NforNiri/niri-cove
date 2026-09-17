import * as THREE from 'three';
import Experience from '../Experience.js';
import { cloneModel, fitFootprint, bounds } from '../Utils/models.js';
import Wake, { Splash } from './Wake.js';
import { SAIL_COLORS, LANTERN_COLORS } from '../Utils/Progress.js';

const HULL_LENGTH = 4.2;

export default class BoatVisual {
    constructor(boat, ocean) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.time = this.experience.time;
        this.renderer = this.experience.renderer;
        this.boat = boat;
        this.ocean = ocean;

        this.container = new THREE.Group();
        this.container.name = 'boat';
        this.scene.add(this.container);

        // Inner pivot for visual-only lean (roll into turns)
        this.pivot = new THREE.Group();
        this.container.add(this.pivot);

        this.lean = 0;
        this.emitAccumulator = 0;
        this.splashAccumulator = 0;
        this.wind = 0.3;

        this.buildHull();
        this.buildSail();
        this.buildPennant();
        this.buildLantern();

        this.wake = new Wake(this.scene, this.ocean);
        this.splash = new Splash(this.scene);

        this.applyColours();
        this.experience.on('progress:select', () => this.applyColours());
        this.experience.on('progress:change', () => this.applyColours());
    }

    /** Sail dye + lantern hue chosen in the Chart menu (unlocked with doubloons). */
    applyColours() {
        const progress = this.experience.progress;
        if (!progress) return;
        const sel = progress.selected;
        const sail = SAIL_COLORS.find((c) => c.id === sel.sail) || SAIL_COLORS[0];
        if (this.sailMesh) this.sailMesh.material.color.setHex(sail.hex);
        const lan = LANTERN_COLORS.find((c) => c.id === sel.lantern) || LANTERN_COLORS[0];
        if (this.lantern) {
            this.lantern.color.setHex(lan.hex);
            this.lanternGlow.material.emissive.setHex(lan.hex);
        }
    }

    /**
     * Swap the kit's stiff sail for a cloth that bellies out with speed and
     * flutters in the wind. Same Standard material (so it still takes light and
     * shadow), with a vertex displacement injected before the model transform.
     */
    buildSail() {
        if (!this.model) return;
        const sail = this.model.getObjectByName('sail-a');
        if (!sail || !sail.isMesh) return;

        sail.geometry.computeBoundingBox();
        const bb = sail.geometry.boundingBox;
        this.sailUniforms = {
            uTime: { value: 0 },
            uWind: { value: 0.3 },
            uBox: { value: new THREE.Vector4(bb.min.x, bb.max.x, bb.min.y, bb.max.y) },
        };

        const mat = sail.material.clone();
        mat.side = THREE.DoubleSide;
        mat.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, this.sailUniforms);
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>
                    uniform float uTime;
                    uniform float uWind;
                    uniform vec4 uBox;`)
                .replace('#include <begin_vertex>', `
                    vec3 transformed = vec3(position);
                    float sx = clamp((position.x - uBox.x) / max(uBox.y - uBox.x, 0.001), 0.0, 1.0);
                    float sy = clamp((position.y - uBox.z) / max(uBox.w - uBox.z, 0.001), 0.0, 1.0);
                    // Corners stay laced to mast and boom; the middle bellies out
                    float belly = sin(sx * 3.14159) * sin(sy * 3.14159);
                    float flutter = sin(uTime * 5.0 + sx * 7.0 + sy * 3.0) * 0.08
                                  + sin(uTime * 8.3 + sy * 11.0 - sx * 2.0) * 0.04;
                    transformed.z += belly * (0.9 * uWind + flutter * (0.35 + uWind));
                `);
        };
        mat.customProgramCacheKey = () => 'cove-sail-cloth';
        sail.material = mat;
        this.sailMesh = sail;
    }

    buildHull() {
        const model = cloneModel(this.resources, 'ship-small');
        if (!model) {
            const fallback = new THREE.Mesh(
                new THREE.BoxGeometry(1.8, 0.9, HULL_LENGTH),
                new THREE.MeshStandardMaterial({ color: 0x8B5A2B })
            );
            this.pivot.add(fallback);
            this.mastTop = 2.5;
            return;
        }

        fitFootprint(model, HULL_LENGTH, -0.5);
        // Kenney ships point along +Z; our forward is -Z
        model.rotation.y = Math.PI;
        this.pivot.add(model);
        this.model = model;

        this.pivot.updateMatrixWorld(true);
        const b = bounds(model);
        this.mastTop = b.max.y;
    }

    buildPennant() {
        const geo = new THREE.PlaneGeometry(0.95, 0.42, 12, 3);
        geo.translate(0.475, 0, 0);

        this.pennantMat = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0xB3322E) },
                uColor2: { value: new THREE.Color(0xEAD8B1) },
                uWind: { value: 1 },
            },
            vertexShader: /* glsl */ `
                uniform float uTime;
                uniform float uWind;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 p = position;
                    float t = uTime * 6.0;
                    float w = p.x / 0.95;
                    p.z += sin(t + w * 5.0) * 0.08 * w * uWind;
                    p.y += cos(t * 0.8 + w * 4.0) * 0.03 * w * uWind;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                uniform vec3 uColor2;
                varying vec2 vUv;
                void main() {
                    float stripe = step(0.5, fract(vUv.y * 2.0));
                    vec3 c = mix(uColor, uColor2, stripe * 0.35);
                    gl_FragColor = vec4(c, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        });

        this.pennant = new THREE.Mesh(geo, this.pennantMat);
        this.pennant.position.set(0, this.mastTop - 0.05, 0.05);
        this.pivot.add(this.pennant);
    }

    buildLantern() {
        this.lanternGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0xFFD9A0, emissive: 0xFFA640, emissiveIntensity: 0 })
        );
        this.lanternGlow.position.set(0, 1.05, 1.75);
        this.pivot.add(this.lanternGlow);

        this.lantern = new THREE.PointLight(0xFFB067, 0, 9, 1.6);
        this.lantern.position.copy(this.lanternGlow.position);
        this.pivot.add(this.lantern);
    }

    update(controls) {
        const rb = this.boat.rigidBody;
        if (!rb) return;

        const pos = rb.translation();
        const rot = rb.rotation();
        this.container.position.set(pos.x, pos.y, pos.z);
        this.container.quaternion.set(rot.x, rot.y, rot.z, rot.w);

        // Lean into turns and squat a touch under full sail
        const targetLean = -this.boat.turnRate * 0.16;
        this.lean += (targetLean - this.lean) * 0.08;
        this.pivot.rotation.z = this.lean;
        const boosting = controls.keys.boost && this.boat.forwardSpeed > 0.5;
        const targetPitch = boosting ? -0.035 : 0;
        this.pivot.rotation.x += (targetPitch - this.pivot.rotation.x) * 0.05;

        const t = this.time.elapsed / 1000;
        const dt = this.time.delta / 1000;
        this.pennantMat.uniforms.uTime.value = t;
        this.pennantMat.uniforms.uWind.value = 0.6 + Math.min(this.boat.speed / 7, 1) * 0.9;

        // Sail fills with forward speed (and a bit of ambient wind when idle)
        const world = this.experience.world;
        const gust = world && world.weather ? world.weather.wind : 0;
        const targetWind = 0.25 + Math.max(this.boat.forwardSpeed, 0) / 11.5 * 0.75 + gust * 0.4;
        this.wind += (targetWind - this.wind) * Math.min(1, dt * 2.5);
        if (this.sailUniforms) {
            this.sailUniforms.uTime.value = t;
            this.sailUniforms.uWind.value = this.wind;
        }

        // Night lantern with a candle flicker
        const env = world ? world.environment : null;
        const night = env ? env.nightFactor : 0;
        const high = this.renderer.quality === 'high';
        const flicker = 0.82 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 23.7) * 0.06 + Math.sin(t * 3.3) * 0.04;
        this.lantern.intensity = high ? night * 6 * flicker : 0;
        this.lanternGlow.material.emissiveIntensity = night * 2.5 * flicker;

        // Wake + spray
        this.wake.update(t);
        this.splash.update(t);
        const speed = this.boat.speed;
        if (speed > 1.0) {
            const rate = THREE.MathUtils.mapLinear(Math.min(speed, 11), 1, 11, 6, 30);
            this.emitAccumulator += rate * dt;
            while (this.emitAccumulator >= 1) {
                this.emitAccumulator -= 1;
                this.emitFoam(speed);
            }
        }
        if (speed > 5) {
            // Bow bursts get denser toward full sail
            const rate = THREE.MathUtils.mapLinear(Math.min(speed, 11.5), 5, 11.5, 2, 9);
            this.splashAccumulator += rate * dt;
            while (this.splashAccumulator >= 1) {
                this.splashAccumulator -= 1;
                this.emitSpray(speed);
            }
        }
    }

    emitSpray(speed) {
        const q = this.container.quaternion;
        const side = Math.random() < 0.5 ? -1 : 1;
        const bow = new THREE.Vector3(side * 0.55, 0.1, -1.9).applyQuaternion(q).add(this.container.position);
        // Outward + up + a little forward, in world space
        const dir = new THREE.Vector3(side * 1.6, 0, -0.6).applyQuaternion(q);
        const k = THREE.MathUtils.mapLinear(Math.min(speed, 11.5), 5, 11.5, 0.6, 1.2);
        this.splash.burst(bow.x, bow.y, bow.z, dir.x * k, 2.4 * k, dir.z * k, {
            n: 3 + Math.floor(Math.random() * 3),
            spread: 1.1,
            size: 0.45,
            life: 0.65,
        });
    }

    emitFoam(speed) {
        const q = this.container.quaternion;
        const side = Math.random() < 0.5 ? -0.42 : 0.42;

        // Stern wash
        const stern = new THREE.Vector3(side, 0, 2.0).applyQuaternion(q).add(this.container.position);
        this.wake.emit(stern.x, stern.z, { size: 1.6 + speed * 0.12, life: 1.8, jitter: 0.4 });

        // Bow spray once the hull is pushing water
        if (speed > 3.5 && Math.random() < 0.5) {
            const bow = new THREE.Vector3(side * 1.4, 0, -1.6).applyQuaternion(q).add(this.container.position);
            this.wake.emit(bow.x, bow.z, { size: 0.9, life: 0.9, jitter: 0.25 });
        }

        // Rudder wash: the turning side churns extra foam off the stern quarter
        const turn = this.boat.turnRate;
        if (Math.abs(turn) > 0.3 && speed > 2) {
            const outer = turn > 0 ? 0.7 : -0.7;
            const quarter = new THREE.Vector3(outer, 0, 2.3).applyQuaternion(q).add(this.container.position);
            this.wake.emit(quarter.x, quarter.z, { size: 1.1 + Math.abs(turn) * 0.6, life: 1.2, jitter: 0.5 });
        }
    }
}
