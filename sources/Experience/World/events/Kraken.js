import * as THREE from 'three';
import Experience from '../../Experience.js';

// Far past the east shoal, in deep water
export const KRAKEN_SPOT = { x: 82, z: 30 };
const RISE_S = 4.5;
const HOLD_S = 14;
const SINK_S = 4;
const SEEN_DIST = 42;

/**
 * Easter egg: after dark, two tentacles rise far offshore, sway, and slip back
 * under. Sail out close enough while they are up and the Log gets a secret.
 */
export default class Kraken {
    constructor(events) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.events = events;
        this.ocean = events.ocean;

        this.active = false;
        this.t = 0;
        this.wasNight = false;
        this.doneThisNight = false;
        this.nightClock = 0;
        this.delay = 30;
        this.seen = false;

        this.group = new THREE.Group();
        this.group.name = 'kraken';
        this.group.position.set(KRAKEN_SPOT.x, -14, KRAKEN_SPOT.z);
        this.group.visible = false;
        this.scene.add(this.group);

        this.uniforms = { uTime: { value: 0 }, uCurl: { value: 0 } };
        this.tentacles = [
            this.makeTentacle(0, 0, 0, 1.0, 0),
            this.makeTentacle(4.5, 0, 2.5, 0.8, 2.1),
        ];
    }

    makeTentacle(x, y, z, scale, phase) {
        const geo = new THREE.CylinderGeometry(0.18, 1.0, 11, 12, 48, false);
        geo.translate(0, 5.5, 0); // base at the origin, tip at +11
        const mat = new THREE.MeshStandardMaterial({ color: 0x4B2A5C, roughness: 0.55, metalness: 0.05 });
        const u = this.uniforms;
        mat.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, u, { uPhase: { value: phase } });
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>
                    uniform float uTime;
                    uniform float uCurl;
                    uniform float uPhase;`)
                .replace('#include <begin_vertex>', `
                    vec3 transformed = vec3(position);
                    float h = clamp(position.y / 11.0, 0.0, 1.0);
                    // Slow sway that grows with height, plus a curl at the tip
                    float sway = sin(uTime * 0.7 + uPhase + h * 2.2) * h * h * 3.2;
                    float sway2 = cos(uTime * 0.5 + uPhase * 1.7 + h * 1.6) * h * h * 2.2;
                    float curl = h * h * h * (2.2 + 1.4 * sin(uTime * 0.45 + uPhase)) * uCurl;
                    transformed.x += sway + curl;
                    transformed.z += sway2;
                    transformed.y -= curl * 0.6;
                `);
        };
        mat.customProgramCacheKey = () => 'cove-tentacle-' + phase;

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = false;
        mesh.position.set(x, y, z);
        mesh.scale.setScalar(scale);
        mesh.rotation.y = phase;
        this.group.add(mesh);
        return mesh;
    }

    start() {
        this.active = true;
        this.t = 0;
        this.seen = false;
        this.doneThisNight = true;
        this.group.visible = true;
        this.group.position.y = -14;
        this.experience.emit('event:kraken');
        const audio = this.experience.audio;
        if (audio) audio.playAt('kraken', KRAKEN_SPOT.x, KRAKEN_SPOT.z, { maxDist: 130, volume: 1.2 });
    }

    stop() {
        this.active = false;
        this.group.visible = false;
    }

    update(dt) {
        const world = this.experience.world;
        const env = world.environment;
        const boat = world.boat;
        if (!env || !boat || !boat.rigidBody) return;

        const night = env.nightFactor > 0.8;
        if (night && !this.wasNight) {
            this.doneThisNight = false;
            this.nightClock = 0;
            this.delay = 25 + Math.random() * 60;
        }
        this.wasNight = night;

        if (!this.active) {
            if (!night || this.doneThisNight) return;
            this.nightClock += dt;
            if (this.nightClock > this.delay) this.start();
            return;
        }

        this.t += dt;
        const total = RISE_S + HOLD_S + SINK_S;
        const tSec = this.time.elapsed / 1000;
        this.uniforms.uTime.value = tSec;

        let y;
        if (this.t < RISE_S) {
            const k = THREE.MathUtils.smoothstep(this.t / RISE_S, 0, 1);
            y = THREE.MathUtils.lerp(-14, -1.5, k);
            this.uniforms.uCurl.value = k;
        } else if (this.t < RISE_S + HOLD_S) {
            y = -1.5 + Math.sin(tSec * 0.6) * 0.4;
            this.uniforms.uCurl.value = 1;
        } else {
            const k = THREE.MathUtils.smoothstep((this.t - RISE_S - HOLD_S) / SINK_S, 0, 1);
            y = THREE.MathUtils.lerp(-1.5, -16, k * k);
        }
        this.group.position.y = y;

        // Churn at the waterline while anything is above it
        if (y > -6 && Math.random() < 0.5) {
            for (const tn of this.tentacles) {
                const wx = this.group.position.x + tn.position.x + (Math.random() - 0.5) * 2;
                const wz = this.group.position.z + tn.position.z + (Math.random() - 0.5) * 2;
                this.events.wake.emit(wx, wz, { size: 2.4, life: 2.4, jitter: 2 });
            }
        }
        if (this.t < RISE_S + 0.6 && Math.random() < 0.7) {
            this.events.splash.burst(this.group.position.x, 0.2, this.group.position.z, 0, 4.5, 0, { n: 6, spread: 4, size: 1.0, life: 1.1 });
        }

        if (!this.seen) {
            const p = boat.getPosition();
            if (Math.hypot(p.x - KRAKEN_SPOT.x, p.z - KRAKEN_SPOT.z) < SEEN_DIST) {
                this.seen = true;
                const first = this.experience.progress.addSecret('kraken');
                const ui = world.ui;
                if (ui) ui.toast(first ? 'SOMETHING STIRS IN THE DEEP — LOGGED' : 'THE DEEP REMEMBERS YOU', 3600);
                const cam = this.experience.camera;
                if (cam) cam.addShake(0.5);
            }
        }

        if (this.t > total) this.stop();
    }
}
