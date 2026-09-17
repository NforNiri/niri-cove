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
        this.positions[i * 3 + 1] = this.ocean.getHeight(px, pz) + 0.06;
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
            this.positions[i * 3 + 1] = this.ocean.getHeight(px, pz) + 0.12;
            touched = true;
        }
        if (touched) this.points.geometry.attributes.position.needsUpdate = true;
    }
}
