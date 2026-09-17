import * as THREE from 'three';
import Experience from '../Experience.js';
import { ISLANDS } from './layout.js';

/**
 * Seagulls wheeling over the islands. Each gull is two triangles that flap
 * around a shared body; flocks orbit an island on slightly different radii,
 * heights and speeds so they never look mechanical.
 */
export default class Gulls {
    constructor() {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.renderer = this.experience.renderer;

        this.group = new THREE.Group();
        this.group.name = 'gulls';
        this.scene.add(this.group);

        this.material = new THREE.MeshStandardMaterial({ color: 0xF4F1EA, roughness: 0.8, side: THREE.DoubleSide });
        this.gulls = [];

        // One flock per island on HIGH, three on LOW
        const islands = this.renderer.quality === 'low' ? ISLANDS.filter((_, i) => i % 2 === 0) : ISLANDS;
        islands.forEach((isl, fi) => {
            const count = 3 + (fi % 2);
            for (let i = 0; i < count; i++) {
                this.gulls.push(this.makeGull(isl, fi, i));
            }
        });

        this.nextCry = 6;

        // Companion gull: unlocked at 10 doubloons, follows the boat
        this.companion = null;
        const progress = this.experience.progress;
        if (progress && progress.hasReward('gull')) this.addCompanion();
        this.experience.on('progress:unlock', (r) => { if (r.id === 'gull') this.addCompanion(); });

        this.experience.addUpdate(7, () => this.update());
    }

    addCompanion() {
        if (this.companion) return;
        const g = this.makeGull({ x: 0, z: 0, radius: 4 }, 9, 0);
        g.companion = true;
        g.radius = 3.2;
        g.height = 3.6;
        g.speed = 0.9;
        g.flap = 7;
        this.gulls.push(g);
        this.companion = g;
    }

    makeGull(island, flockIndex, i) {
        const body = new THREE.Group();
        const wingGeo = new THREE.BufferGeometry();
        // Left wing: root at origin, tip out along -x, slightly swept back
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, -0.08,
            0, 0, 0.08,
            -0.55, 0.02, 0.12,
        ], 3));
        wingGeo.computeVertexNormals();

        const left = new THREE.Mesh(wingGeo, this.material);
        const right = new THREE.Mesh(wingGeo, this.material);
        right.scale.x = -1;
        body.add(left, right);

        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), this.material);
        beak.rotation.x = -Math.PI / 2;
        beak.position.z = -0.14;
        body.add(beak);

        this.group.add(body);

        const seed = flockIndex * 7.3 + i * 2.1;
        return {
            body,
            left,
            right,
            cx: island.x,
            cz: island.z,
            radius: island.radius * (0.7 + (i % 3) * 0.25),
            height: 7 + (i % 3) * 1.6 + flockIndex * 0.4,
            speed: (0.16 + (i % 2) * 0.05) * (flockIndex % 2 ? 1 : -1),
            phase: seed,
            flap: 5 + (i % 3),
        };
    }

    update() {
        const t = this.time.elapsed / 1000;

        // An occasional cry from wherever a gull happens to be
        if (t > this.nextCry && this.gulls.length) {
            this.nextCry = t + 5 + Math.random() * 9;
            const g = this.gulls[Math.floor(Math.random() * this.gulls.length)];
            const audio = this.experience.audio;
            if (audio) audio.playAt('gull', g.body.position.x, g.body.position.z, { maxDist: 70, volume: 0.9 });
        }

        const boat = this.experience.world ? this.experience.world.boat : null;
        if (this.companion && boat && boat.rigidBody) {
            const p = boat.getPosition();
            // Lag behind the boat a little so it reads as following
            this.companion.cx += (p.x - boat.forward.x * 2 - this.companion.cx) * 0.06;
            this.companion.cz += (p.z - boat.forward.z * 2 - this.companion.cz) * 0.06;
        }

        for (const g of this.gulls) {
            const a = t * g.speed + g.phase;
            const wobble = Math.sin(t * 0.7 + g.phase) * 1.5;
            const r = g.radius + wobble;
            const x = g.cx + Math.cos(a) * r;
            const z = g.cz + Math.sin(a) * r;
            const y = g.height + Math.sin(t * 0.9 + g.phase * 2) * 0.6;

            g.body.position.set(x, y, z);
            // Face along the direction of travel
            g.body.rotation.y = -a - (g.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
            g.body.rotation.z = Math.sin(t * 0.9 + g.phase) * 0.2;

            // Glide for a stretch, then a burst of flaps
            const cycle = Math.sin(t * 0.5 + g.phase);
            const flapAmt = cycle > 0.2 ? Math.sin(t * g.flap + g.phase) * 0.55 : 0.12;
            g.left.rotation.z = flapAmt;
            g.right.rotation.z = -flapAmt;
        }
    }
}
