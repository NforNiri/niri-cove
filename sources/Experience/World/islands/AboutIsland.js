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

        this.group.add(group);
        this.addLight(x, y + 1.0, z, { color: 0xFF9A3C, intensity: 5, distance: 11, flicker: 0.18, essential: true });
    }

    update() {
        super.update();
        if (this.flame) {
            const t = this.time.elapsed / 1000;
            const s = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17) * 0.06;
            this.flame.scale.set(1, s, 1);
            this.flame.rotation.y = t * 1.5;
        }
    }
}
