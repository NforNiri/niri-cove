import * as THREE from 'three';
import IslandBase from './IslandBase.js';

/**
 * Treasure Rock — a rocky islet with a dig site, X marks the spot,
 * open chests spilling doubloons. The career log lives here.
 */
export default class ResumeIsland extends IslandBase {
    constructor(data) {
        super(data, { plateau: 2.6, plateauRadius: 0.5, seed: 17, rockiness: 0.35 });
    }

    dress() {
        // Rock outcrop crown
        for (let i = 0; i < 5; i++) {
            const p = this.polar(this.radius * (0.18 + this.rand(i) * 0.15), Math.PI + (i - 2) * 0.55);
            const name = ['rocks-a', 'rocks-b', 'rocks-c'][i % 3];
            this.place(name, p.x, p.z, { scale: 1.4 + this.rand(i * 3) * 0.6, rotY: this.rand(i * 5) * 6 });
        }

        // Dig site facing the dock
        const dig = this.polar(this.radius * 0.3, Math.PI * 0.15);
        this.place('hole', dig.x, dig.z, { scale: 1.2 });
        this.place('tool-shovel', dig.x + 0.9, dig.z + 0.2, { scale: 1, rotY: 0.8 });
        this.buildXMark(dig.x - 1.4, dig.z + 1.1);

        // Treasure chests with coins
        const c1 = this.polar(this.radius * 0.42, -Math.PI * 0.3);
        this.place('chest', c1.x, c1.z, { scale: 1.1, rotY: this.dockYaw + 0.4 });
        this.buildCoins(c1.x, c1.z, 7);
        const c2 = this.polar(this.radius * 0.55, Math.PI * 0.72);
        this.place('chest', c2.x, c2.z, { scale: 1, rotY: this.dockYaw + 2.2 });
        this.buildCoins(c2.x, c2.z, 4);

        // Shipwreck on the far shore — the "past"
        const wreck = this.polar(this.radius * 0.88, Math.PI * 0.95);
        this.place('ship-wreck', wreck.x, wreck.z, { footprint: 5.2, rotY: this.dockYaw + Math.PI * 0.6, y: this.heightAt(wreck.x, wreck.z) - 0.6 });

        // Torch near the dig
        const torch = this.polar(this.radius * 0.38, Math.PI * 0.4);
        this.buildTorch(torch.x, torch.z);

        this.palms(6, { start: 90, minR: this.radius * 0.6, maxR: this.radius * 0.8 });
        this.scatter(['rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c'], 6, { minR: 0.65, maxR: 0.92, start: 900 });
        this.scatter(['patch-sand', 'grass-plant'], 6, { minR: 0.4, maxR: 0.7, start: 950 });
    }

    buildXMark(x, z) {
        const y = this.heightAt(x, z) + 0.03;
        const mat = new THREE.MeshStandardMaterial({ color: 0xB3322E, roughness: 0.8 });
        for (const rot of [Math.PI / 4, -Math.PI / 4]) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.28), mat);
            plank.position.set(x, y, z);
            plank.rotation.y = rot;
            plank.receiveShadow = true;
            this.group.add(plank);
        }
    }

    buildCoins(x, z, count) {
        const y = this.heightAt(x, z);
        const mat = new THREE.MeshStandardMaterial({ color: 0xF0C048, metalness: 0.3, roughness: 0.35, emissive: 0xB07A10, emissiveIntensity: 0.4 });
        this.coins = this.coins || [];
        for (let i = 0; i < count; i++) {
            const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), mat);
            const a = this.rand(i * 7 + x) * Math.PI * 2;
            const d = 0.5 + this.rand(i * 3 + z) * 0.7;
            coin.position.set(x + Math.cos(a) * d, y + 0.03, z + Math.sin(a) * d);
            coin.rotation.set((this.rand(i) - 0.5) * 0.6, this.rand(i * 2) * 3, (this.rand(i * 4) - 0.5) * 0.6);
            this.group.add(coin);
            this.coins.push(coin);
        }
    }

    buildTorch(x, z) {
        const y = this.heightAt(x, z);
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6),
            new THREE.MeshStandardMaterial({ color: 0x5A3A1E })
        );
        post.position.set(x, y + 0.8, z);
        this.group.add(post);
        this.torchFlame = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.4, 6),
            new THREE.MeshStandardMaterial({ color: 0xFF9A3C, emissive: 0xFF6A00, emissiveIntensity: 2 })
        );
        this.torchFlame.position.set(x, y + 1.8, z);
        this.group.add(this.torchFlame);
        this.addLight(x, y + 1.9, z, { intensity: 3.5, distance: 9, flicker: 0.2, essential: true });
    }

    update() {
        super.update();
        const t = this.time.elapsed / 1000;
        if (this.torchFlame) {
            this.torchFlame.scale.y = 1 + Math.sin(t * 13) * 0.15;
        }
        if (this.coins) {
            const glint = 0.3 + Math.max(0, Math.sin(t * 2.2)) * 0.5;
            this.coins[0].material.emissiveIntensity = glint;
        }
    }
}
