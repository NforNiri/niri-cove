import * as THREE from 'three';
import IslandBase from './IslandBase.js';

/**
 * Home Cove — where the captain lives. A hut, a campfire on the beach,
 * a rowboat pulled up on the sand and a hammock's worth of calm.
 */
export default class AboutIsland extends IslandBase {
    constructor(data) {
        super(data, { plateau: 1.7, plateauRadius: 0.6, seed: 3 });
    }

    dress() {
        // Hut just inland from the dock, door facing the pier
        const hut = this.polar(this.radius * 0.35, Math.PI);
        this.place('structure', hut.x, hut.z, { footprint: 4.2, rotY: this.dockYaw + Math.PI });
        const roof = this.place('structure-roof', hut.x, hut.z, { footprint: 4.6, rotY: this.dockYaw + Math.PI });
        if (roof) roof.position.y += 2.35;

        // Campfire between hut and dock
        const fire = this.polar(this.radius * 0.28, Math.PI * 0.2);
        this.buildCampfire(fire.x, fire.z);

        // Rowboat pulled up on the beach
        const boat = this.polar(this.radius * 0.72, Math.PI * 0.55);
        this.place('boat-row-small', boat.x, boat.z, { footprint: 2.6, rotY: this.dockYaw + 0.9 });
        const paddle = this.polar(this.radius * 0.66, Math.PI * 0.62);
        this.place('tool-paddle', paddle.x, paddle.z, { scale: 1, rotY: 0.4 });

        // Supplies by the pier
        const b1 = this.polar(this.radius * 0.62, Math.PI * 0.12);
        this.place('barrel', b1.x, b1.z, { scale: 1 });
        const b2 = this.polar(this.radius * 0.6, -Math.PI * 0.12);
        this.place('crate', b2.x, b2.z, { scale: 1, rotY: 0.6 });
        const chest = this.polar(this.radius * 0.5, Math.PI * 0.85);
        this.place('chest', chest.x, chest.z, { scale: 1, rotY: this.dockYaw + 2.6 });

        // Flag on the dock
        const flag = this.polar(this.radius * 0.9, 0.18);
        const f = this.place('flag-high', flag.x, flag.z, { scale: 1, rotY: this.dockYaw });
        if (f) this.animated.push({ obj: f, kind: 'sway', phase: 1.2 });

        this.palms(10, { start: 10 });
        this.scatter(['grass-patch', 'grass-plant', 'patch-grass-foliage'], 10, { minR: 0.3, maxR: 0.75, start: 200 });
        this.scatter(['rocks-sand-a', 'rocks-sand-b'], 3, { minR: 0.78, maxR: 0.9, start: 300, scale: 0.9 });
    }

    buildCampfire(x, z) {
        const y = this.heightAt(x, z);
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const logMat = new THREE.MeshStandardMaterial({ color: 0x5A3A1E, roughness: 0.9 });
        for (let i = 0; i < 3; i++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6), logMat);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = (i / 3) * Math.PI;
            log.position.y = 0.1;
            log.castShadow = true;
            group.add(log);
        }

        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8C8578, roughness: 1 });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stoneMat);
            stone.position.set(Math.cos(a) * 0.72, 0.08, Math.sin(a) * 0.72);
            stone.rotation.set(a, a * 2, 0);
            group.add(stone);
        }

        this.flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, 0.75, 7),
            new THREE.MeshStandardMaterial({ color: 0xFF9A3C, emissive: 0xFF6A00, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 })
        );
        this.flame.position.y = 0.5;
        group.add(this.flame);

        // Embers drifting up once lit
        const emberGeo = new THREE.BufferGeometry();
        this.emberCount = 18;
        this.emberPos = new Float32Array(this.emberCount * 3);
        this.emberSeed = new Float32Array(this.emberCount);
        for (let i = 0; i < this.emberCount; i++) this.emberSeed[i] = Math.random();
        emberGeo.setAttribute('position', new THREE.BufferAttribute(this.emberPos, 3));
        this.embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xFFB060, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
        group.add(this.embers);

        this.group.add(group);
        this.fireLight = this.addLight(x, y + 1.0, z, { color: 0xFF9A3C, intensity: 5, distance: 11, flicker: 0.18, essential: true });
        this.campfirePos = { x: this.data.x + x, z: this.data.z + z };

        if (this.experience.audio) {
            this.fireEmitter = this.experience.audio.addEmitter({
                key: 'campfire', x: this.campfirePos.x, z: this.campfirePos.z, maxDist: 28, volume: 0.55, enabled: false,
            });
        }

        // Cold until the visitor lights it (or did on a previous visit)
        this.lit = 0;
        this.setLit(this.experience.progress && this.experience.progress.hasQuest('campfire') ? 1 : 0);
    }

    setLit(v) {
        this.lit = v;
        this.flame.visible = v > 0.02;
        this.embers.visible = v > 0.02;
        this.fireLight.visible = v > 0.02;
        for (const l of this.lights) if (l.light === this.fireLight) l.base = 5 * v;
        if (this.fireEmitter) this.fireEmitter.enabled = v > 0.5;
    }

    registerQuest(interactables) {
        interactables.add({
            id: 'campfire',
            x: this.data.dock.x,
            z: this.data.dock.z,
            radius: 9,
            label: 'Light the campfire',
            action: () => this.lightCampfire(),
        });
    }

    lightCampfire() {
        return new Promise((resolve) => {
            const state = { v: 0.01 };
            this.setLit(0.01);
            gsap.to(state, {
                v: 1, duration: 1.6, ease: 'power2.out',
                onUpdate: () => this.setLit(state.v),
                onComplete: resolve,
            });
        });
    }

    update() {
        // applyQuality may re-show the light; the fire decides
        if (this.fireLight) this.fireLight.visible = this.lit > 0.02;
        super.update();
        const t = this.time.elapsed / 1000;
        if (this.flame && this.flame.visible) {
            const s = (1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17) * 0.06) * this.lit;
            this.flame.scale.set(this.lit, s, this.lit);
            this.flame.rotation.y = t * 1.5;
        }
        if (this.embers && this.embers.visible) {
            for (let i = 0; i < this.emberCount; i++) {
                const k = (t * 0.35 + this.emberSeed[i]) % 1;
                this.emberPos[i * 3] = Math.sin(t * 1.3 + i) * 0.18 * k;
                this.emberPos[i * 3 + 1] = 0.5 + k * 2.4 * this.lit;
                this.emberPos[i * 3 + 2] = Math.cos(t * 1.1 + i * 2) * 0.18 * k;
            }
            this.embers.geometry.attributes.position.needsUpdate = true;
            this.embers.material.opacity = 0.9 * this.lit;
        }
    }
}
