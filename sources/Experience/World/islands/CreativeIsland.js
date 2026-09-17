import * as THREE from 'three';
import IslandBase from './IslandBase.js';

/**
 * Lantern Bay — an open-air stage strung with lanterns, a sailcloth screen
 * for projections and a ring of pennants. Video art, film, motion.
 */
export default class CreativeIsland extends IslandBase {
    constructor(data) {
        super(data, { plateau: 1.5, plateauRadius: 0.66, seed: 11 });
    }

    dress() {
        // Stage platform opposite the dock
        const stage = this.polar(this.radius * 0.32, Math.PI);
        const platform = this.place('structure-platform', stage.x, stage.z, { footprint: 5.2, rotY: this.dockYaw });
        this.buildScreen(stage, platform);

        // Lantern posts around the stage
        this.lanterns = [];
        for (let i = 0; i < 6; i++) {
            const ang = Math.PI + (i - 2.5) * 0.42;
            const p = this.polar(this.radius * 0.55, ang);
            this.buildLantern(p.x, p.z, i);
        }

        // Pennant ring near the dock (festive)
        for (let i = 0; i < 4; i++) {
            const p = this.polar(this.radius * 0.74, (i - 1.5) * 0.36);
            const f = this.place('flag-pennant', p.x, p.z, { scale: 1, rotY: this.dockYaw + (i - 1.5) * 0.3 });
            if (f) this.animated.push({ obj: f, kind: 'sway', phase: i * 1.3 });
        }

        // Audience: crates and barrels as seats, a rowboat as the "green room"
        for (let i = 0; i < 5; i++) {
            const p = this.polar(this.radius * (0.42 + this.rand(i * 3) * 0.1), Math.PI * 0.45 + i * 0.16);
            this.place(i % 2 ? 'crate' : 'barrel', p.x, p.z, { scale: 0.9, rotY: this.rand(i) * 3 });
        }
        const rb = this.polar(this.radius * 0.7, -Math.PI * 0.6);
        this.place('boat-row-small', rb.x, rb.z, { footprint: 2.4, rotY: this.dockYaw - 1.1 });
        const bottles = this.polar(this.radius * 0.5, -Math.PI * 0.35);
        this.place('bottle-large', bottles.x, bottles.z, { scale: 1 });
        this.place('bottle', bottles.x + 0.5, bottles.z + 0.2, { scale: 1 });

        this.palms(9, { start: 70 });
        this.scatter(['grass-plant', 'grass-patch', 'patch-sand-foliage'], 9, { minR: 0.35, maxR: 0.8, start: 700 });
    }

    buildScreen(stage, platform) {
        // Sailcloth screen on two posts behind the stage
        const y = this.heightAt(stage.x, stage.z) + (platform ? 0.9 : 0.2);
        const holder = new THREE.Group();
        holder.position.set(stage.x, y, stage.z);
        holder.rotation.y = this.dockYaw;

        const postMat = new THREE.MeshStandardMaterial({ color: 0x6B4423, roughness: 0.9 });
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 7), postMat);
            post.position.set(side * 1.9, 1.6, -1.4);
            post.castShadow = true;
            holder.add(post);
        }

        this.screenMat = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
            vertexShader: /* glsl */ `
                uniform float uTime;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 p = position;
                    p.z += sin(uTime * 2.0 + uv.x * 6.0) * 0.04 * (1.0 - uv.y);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uTime;
                uniform float uNight;
                varying vec2 vUv;
                void main() {
                    vec3 cloth = vec3(0.93, 0.88, 0.76);
                    // A slow "projection": drifting colour bands that only glow at night
                    float band = sin(vUv.x * 8.0 + uTime * 0.8) * 0.5 + 0.5;
                    float band2 = sin(vUv.y * 5.0 - uTime * 0.6 + vUv.x * 3.0) * 0.5 + 0.5;
                    vec3 proj = mix(vec3(1.0, 0.55, 0.26), vec3(0.37, 0.83, 0.76), band) * (0.5 + 0.5 * band2);
                    float vignette = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
                    vec3 col = mix(cloth, cloth * 0.4 + proj * 1.1, uNight * vignette);
                    gl_FragColor = vec4(col, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1, 12, 6), this.screenMat);
        screen.position.set(0, 1.85, -1.4);
        holder.add(screen);
        this.group.add(holder);

        // Screen glow onto the stage at night
        this.screenLight = this.addLight(stage.x, y + 1.5, stage.z, { color: 0xFFB27A, intensity: 3, distance: 9 });
    }

    buildLantern(x, z, i) {
        const y = this.heightAt(x, z);
        const g = new THREE.Group();
        g.position.set(x, y, z);

        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6),
            new THREE.MeshStandardMaterial({ color: 0x5A3A1E, roughness: 0.9 })
        );
        post.position.y = 1.2;
        post.castShadow = true;
        g.add(post);

        const lampMat = new THREE.MeshStandardMaterial({ color: 0xFFE2B0, emissive: 0xFFA640, emissiveIntensity: 0.2 });
        const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), lampMat);
        lamp.position.y = 2.45;
        g.add(lamp);
        this.group.add(g);

        this.lanterns.push(lamp);
        this.addLight(x, y + 2.45, z, { intensity: 2.6, distance: 8, flicker: 0.08 });
    }

    update() {
        super.update();
        const t = this.time.elapsed / 1000;
        const night = this.experience.world?.environment?.nightFactor ?? 0;
        if (this.screenMat) {
            this.screenMat.uniforms.uTime.value = t;
            this.screenMat.uniforms.uNight.value = night;
        }
        if (this.lanterns) {
            for (let i = 0; i < this.lanterns.length; i++) {
                this.lanterns[i].material.emissiveIntensity = 0.2 + night * (1.6 + Math.sin(t * 6 + i) * 0.3);
            }
        }
    }
}
