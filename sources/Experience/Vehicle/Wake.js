import * as THREE from 'three';

/**
 * Foam particles trailing the hull. A ring buffer of soft round sprites laid
 * flat on the water; each fades and grows over its life.
 */
export default class Wake {
    constructor(scene, ocean, { count = 220 } = {}) {
        this.scene = scene;
        this.ocean = ocean;
        this.count = count;
        this.cursor = 0;

        this.positions = new Float32Array(count * 3);
        this.birth = new Float32Array(count).fill(-1e9);
        this.life = new Float32Array(count).fill(1);
        this.sizes = new Float32Array(count).fill(1);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1));
        geometry.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0xF7F3E8) },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
            },
            vertexShader: /* glsl */ `
                attribute float aBirth;
                attribute float aLife;
                attribute float aSize;
                uniform float uTime;
                uniform float uPixelRatio;
                varying float vAlpha;
                void main() {
                    float age = (uTime - aBirth) / aLife;
                    float alive = step(0.0, age) * step(age, 1.0);
                    vAlpha = alive * (1.0 - age) * 0.7;
                    float grow = 1.0 + age * 2.2;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = aSize * grow * uPixelRatio * (140.0 / -mv.z);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    float a = smoothstep(0.5, 0.15, d) * vAlpha;
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(uColor, a);
                }
            `,
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 2;
        scene.add(this.points);
    }

    emit(x, z, { size = 1, life = 1.6, jitter = 0.35 } = {}) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.count;

        const jx = (Math.random() - 0.5) * jitter;
        const jz = (Math.random() - 0.5) * jitter;
        const px = x + jx;
        const pz = z + jz;

        this.positions[i * 3] = px;
        this.positions[i * 3 + 1] = this.ocean.getHeight(px, pz) + 0.32;
        this.positions[i * 3 + 2] = pz;
        this.birth[i] = this.material.uniforms.uTime.value;
        this.life[i] = life * (0.8 + Math.random() * 0.4);
        this.sizes[i] = size * (0.8 + Math.random() * 0.5);

        const g = this.points.geometry;
        g.attributes.position.needsUpdate = true;
        g.attributes.aBirth.needsUpdate = true;
        g.attributes.aLife.needsUpdate = true;
        g.attributes.aSize.needsUpdate = true;
    }

    update(timeSec) {
        this.material.uniforms.uTime.value = timeSec;

        // Keep living particles riding the surface so the swell never hides them
        let touched = false;
        for (let i = 0; i < this.count; i++) {
            const age = (timeSec - this.birth[i]) / this.life[i];
            if (age < 0 || age > 1) continue;
            const px = this.positions[i * 3];
            const pz = this.positions[i * 3 + 2];
            // Sit clear of neighbouring crests: the sprites are wider than the
            // chop wavelength, so a low offset gets the top half clipped
            this.positions[i * 3 + 1] = this.ocean.getHeight(px, pz) + 0.32;
            touched = true;
        }
        if (touched) this.points.geometry.attributes.position.needsUpdate = true;
    }
}

/**
 * Airborne spray: droplets thrown up by the bow, falling back under gravity.
 * Fully GPU-driven from a birth time + velocity so emitting is just a write.
 */
export class Splash {
    constructor(scene, { count = 240 } = {}) {
        this.count = count;
        this.cursor = 0;

        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.birth = new Float32Array(count).fill(-1e9);
        this.life = new Float32Array(count).fill(1);
        this.sizes = new Float32Array(count).fill(1);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
        geometry.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1));
        geometry.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0xF7F6F0) },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
            },
            vertexShader: /* glsl */ `
                attribute vec3 aVelocity;
                attribute float aBirth;
                attribute float aLife;
                attribute float aSize;
                uniform float uTime;
                uniform float uPixelRatio;
                varying float vAlpha;
                void main() {
                    float age = uTime - aBirth;
                    float k = age / aLife;
                    float alive = step(0.0, k) * step(k, 1.0);
                    vec3 p = position + aVelocity * age + vec3(0.0, -6.5, 0.0) * age * age;
                    vAlpha = alive * (1.0 - k * k) * 0.85;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = aSize * (1.0 - k * 0.5) * uPixelRatio * (120.0 / -mv.z);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    float a = smoothstep(0.5, 0.2, d) * vAlpha;
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(uColor, a);
                }
            `,
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 3;
        scene.add(this.points);
    }

    /** Throw `n` droplets from (x, y, z) around a base velocity. */
    burst(x, y, z, vx, vy, vz, { n = 5, spread = 1.4, size = 0.5, life = 0.7 } = {}) {
        for (let k = 0; k < n; k++) {
            const i = this.cursor;
            this.cursor = (this.cursor + 1) % this.count;
            this.positions[i * 3] = x + (Math.random() - 0.5) * 0.2;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
            this.velocities[i * 3] = vx + (Math.random() - 0.5) * spread;
            this.velocities[i * 3 + 1] = vy * (0.7 + Math.random() * 0.6);
            this.velocities[i * 3 + 2] = vz + (Math.random() - 0.5) * spread;
            this.birth[i] = this.material.uniforms.uTime.value;
            this.life[i] = life * (0.7 + Math.random() * 0.6);
            this.sizes[i] = size * (0.6 + Math.random() * 0.8);
        }
        const g = this.points.geometry;
        for (const key of ['position', 'aVelocity', 'aBirth', 'aLife', 'aSize']) g.attributes[key].needsUpdate = true;
    }

    update(timeSec) {
        this.material.uniforms.uTime.value = timeSec;
    }
}
