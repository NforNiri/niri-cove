import * as THREE from 'three';
import IslandBase from './IslandBase.js';

/**
 * Lighthouse Point — a tall lighthouse with a sweeping beam, bottles with
 * messages washed up on the sand, and a bell on the pier. Get in touch.
 */
export default class ContactIsland extends IslandBase {
    constructor(data) {
        super(data, { plateau: 2.0, plateauRadius: 0.55, seed: 23, rockiness: 0.12 });
    }

    dress() {
        // Lighthouse on the high point, opposite the dock
        const lh = this.polar(this.radius * 0.3, Math.PI);
        const tower = this.place('tower-complete-large', lh.x, lh.z, { footprint: 3.4, rotY: this.dockYaw });
        this.buildBeacon(lh, tower);

        // Keeper's fence and supplies
        const fence = this.polar(this.radius * 0.52, Math.PI * 0.8);
        this.place('structure-fence', fence.x, fence.z, { footprint: 3, rotY: this.dockYaw + 0.6 });
        const fence2 = this.polar(this.radius * 0.52, -Math.PI * 0.8);
        this.place('structure-fence-sides', fence2.x, fence2.z, { footprint: 3, rotY: this.dockYaw - 0.6 });
        const crate = this.polar(this.radius * 0.6, Math.PI * 0.2);
        this.place('crate-bottles', crate.x, crate.z, { scale: 1, rotY: 0.3 });

        // Messages in bottles along the tide line
        for (let i = 0; i < 6; i++) {
            const a = this.rand(i * 9) * Math.PI * 2;
            const d = this.radius * (0.86 + this.rand(i * 4) * 0.06);
            const name = i % 3 === 0 ? 'bottle-large' : 'bottle';
            const b = this.place(name, Math.cos(a) * d, Math.sin(a) * d, { scale: 1, rotY: this.rand(i) * 6 });
            if (b) b.rotation.z = (this.rand(i * 2) - 0.5) * 0.9;
        }

        // Bell post at the pier
        const bell = this.polar(this.radius * 0.86, -0.2);
        this.buildBell(bell.x, bell.z);

        // Rowboat + paddle on the beach
        const rb = this.polar(this.radius * 0.72, Math.PI * 0.5);
        this.place('boat-row-large', rb.x, rb.z, { footprint: 3.0, rotY: this.dockYaw + 1.4 });

        this.palms(8, { start: 120 });
        this.scatter(['rocks-sand-a', 'rocks-sand-c', 'rocks-b'], 5, { minR: 0.7, maxR: 0.92, start: 1200 });
        this.scatter(['grass-patch', 'patch-grass-foliage'], 7, { minR: 0.35, maxR: 0.7, start: 1250 });
    }

    buildBeacon(lh, tower) {
        // Lamp room height comes from the placed tower's bounds
        let top = this.heightAt(lh.x, lh.z) + 6;
        if (tower) {
            tower.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(tower);
            top = box.max.y - this.group.position.y - 0.6;
        }

        this.lampMat = new THREE.MeshStandardMaterial({ color: 0xFFF3DC, emissive: 0xFFD27A, emissiveIntensity: 0.6 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), this.lampMat);
        lamp.position.set(lh.x, top, lh.z);
        this.group.add(lamp);

        this.beam = new THREE.SpotLight(0xFFE2B0, 0, 90, 0.32, 0.6, 1.2);
        this.beam.position.copy(lamp.position);
        this.beamTarget = new THREE.Object3D();
        this.group.add(this.beam);
        this.group.add(this.beamTarget);
        this.beam.target = this.beamTarget;

        this.beamGlow = this.addLight(lh.x, top, lh.z, { color: 0xFFE2B0, intensity: 2.5, distance: 14, essential: true });
        this.beamAngle = 0;
        this.lampPos = lamp.position.clone();
    }

    buildBell(x, z) {
        const y = this.heightAt(x, z);
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = this.dockYaw;

        const wood = new THREE.MeshStandardMaterial({ color: 0x6B4423, roughness: 0.9 });
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.12), wood);
            post.position.set(side * 0.45, 0.85, 0);
            g.add(post);
        }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 0.12), wood);
        bar.position.y = 1.7;
        g.add(bar);

        this.bell = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.26, 0.38, 12),
            new THREE.MeshStandardMaterial({ color: 0xC9A46A, metalness: 0.85, roughness: 0.35 })
        );
        this.bell.position.y = 1.42;
        g.add(this.bell);
        this.group.add(g);
        this.bellWorld = { x: this.data.x + x, z: this.data.z + z };
        this.bellSwing = 0;
    }

    registerQuest(interactables) {
        interactables.add({
            id: 'bell',
            x: this.data.dock.x,
            z: this.data.dock.z,
            radius: 9,
            label: 'Ring the bell',
            repeatLabel: 'Ring again',
            action: () => this.ringBell(),
        });
    }

    ringBell() {
        const audio = this.experience.audio;
        if (audio) audio.playAt('bell', this.bellWorld.x, this.bellWorld.z, { maxDist: 80, volume: 1.4 });
        this.bellSwing = 1;
        // The keeper answers with a flash of the lamp
        this.lampFlash = 1;
        const ui = this.experience.world ? this.experience.world.ui : null;
        if (ui && !this.experience.progress.hasQuest('bell')) {
            setTimeout(() => ui.toast('THE KEEPER IS LISTENING — SAY HELLO', 2600), 1200);
        }
        return new Promise((resolve) => setTimeout(resolve, 900));
    }

    update() {
        super.update();
        const t = this.time.elapsed / 1000;
        const night = this.experience.world?.environment?.nightFactor ?? 0;
        const high = this.renderer.quality === 'high';

        if (this.beam) {
            this.beamAngle = t * 0.55;
            const r = 40;
            this.beamTarget.position.set(
                this.lampPos.x + Math.cos(this.beamAngle) * r,
                this.lampPos.y - 4,
                this.lampPos.z + Math.sin(this.beamAngle) * r
            );
            const flash = this.lampFlash || 0;
            this.beam.intensity = high ? night * 60 + flash * 40 : 0;
            this.lampMat.emissiveIntensity = 0.6 + night * 2.5 + Math.sin(t * 3) * 0.2 * night + flash * 4;
            if (flash > 0) this.lampFlash = Math.max(0, flash - this.time.delta / 1000 / 1.2);
        }
        if (this.bell) {
            const swing = this.bellSwing || 0;
            this.bell.rotation.x = Math.sin(t * 1.3) * 0.08 + Math.sin(t * 14) * 0.55 * swing;
            if (swing > 0) this.bellSwing = Math.max(0, swing - this.time.delta / 1000 / 2.2);
        }
    }
}
