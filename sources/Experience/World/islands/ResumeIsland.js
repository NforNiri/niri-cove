import * as THREE from 'three';
import gsap from 'gsap';
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
        this.shovel = this.place('tool-shovel', dig.x + 0.9, dig.z + 0.2, { scale: 1, rotY: 0.8 });
        this.xPos = { x: dig.x - 1.4, z: dig.z + 1.1 };
        this.buildXMark(this.xPos.x, this.xPos.z);
        this.buildBuriedChest(this.xPos.x, this.xPos.z);

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
        this.xPlanks = [];
        for (const rot of [Math.PI / 4, -Math.PI / 4]) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.28), mat);
            plank.position.set(x, y, z);
            plank.rotation.y = rot;
            plank.receiveShadow = true;
            this.group.add(plank);
            this.xPlanks.push(plank);
        }
    }

    buildBuriedChest(x, z) {
        const y = this.heightAt(x, z);
        this.buriedChest = this.place('chest', x, z, { scale: 1.1, rotY: this.dockYaw, y: y - 1.2 });
        if (!this.buriedChest) return;
        this.buriedChest.visible = false;
        this.chestRestY = y - 0.05;
        this.dugUp = !!(this.experience.progress && this.experience.progress.hasQuest('dig'));
        if (this.dugUp) this.setDug();
    }

    setDug() {
        this.dugUp = true;
        if (this.buriedChest) {
            this.buriedChest.visible = true;
            this.buriedChest.position.y = this.chestRestY;
        }
        for (const p of this.xPlanks || []) p.visible = false;
    }

    registerQuest(interactables) {
        interactables.add({
            id: 'dig',
            x: this.data.dock.x,
            z: this.data.dock.z,
            radius: 9,
            label: 'Dig at the X',
            action: () => this.dig(),
        });
    }

    dig() {
        if (this.dugUp || !this.buriedChest) return Promise.resolve();
        const audio = this.experience.audio;
        const world = { x: this.data.x + this.xPos.x, z: this.data.z + this.xPos.z };
        if (audio) audio.playAt('dig', world.x, world.z, { maxDist: 60, volume: 1.2 });

        return new Promise((resolve) => {
            // Planks kicked aside
            this.xPlanks.forEach((p, i) => {
                gsap.to(p.position, { x: p.position.x + (i ? 0.9 : -0.9), y: p.position.y + 0.3, duration: 0.5, ease: 'power2.out', delay: 0.5 });
                gsap.to(p.rotation, { z: (i ? 1 : -1) * 0.7, duration: 0.5, delay: 0.5 });
            });
            // Shovel works
            if (this.shovel) {
                gsap.to(this.shovel.rotation, { x: -0.5, duration: 0.2, yoyo: true, repeat: 3, ease: 'power1.inOut' });
            }
            // Chest rises
            this.buriedChest.visible = true;
            gsap.to(this.buriedChest.position, {
                y: this.chestRestY, duration: 1.1, delay: 0.9, ease: 'back.out(1.6)',
                onComplete: () => {
                    this.dugUp = true;
                    if (audio) audio.playAt('chest', world.x, world.z, { maxDist: 60, volume: 1.2 });
                    this.burstCoins();
                    const ui = this.experience.world ? this.experience.world.ui : null;
                    if (ui) {
                        ui.openStatic('resume');
                        ui.toast("THE CAPTAIN'S PAPERS — READ THEM ON THE RIGHT", 3200);
                    }
                    this.experience.emit('quest:dig');
                    resolve();
                },
            });
        });
    }

    burstCoins() {
        const y = this.heightAt(this.xPos.x, this.xPos.z);
        const mat = new THREE.MeshStandardMaterial({ color: 0xF0C048, metalness: 0.3, roughness: 0.35, emissive: 0xB07A10, emissiveIntensity: 0.8 });
        for (let i = 0; i < 12; i++) {
            const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), mat);
            coin.position.set(this.xPos.x, y + 0.6, this.xPos.z);
            this.group.add(coin);
            const a = Math.random() * Math.PI * 2;
            const d = 0.6 + Math.random() * 1.1;
            gsap.to(coin.position, {
                x: this.xPos.x + Math.cos(a) * d, z: this.xPos.z + Math.sin(a) * d, duration: 0.7, ease: 'power1.out',
            });
            gsap.to(coin.position, { y: y + 1.6 + Math.random(), duration: 0.32, ease: 'power2.out', yoyo: true, repeat: 1 });
            gsap.to(coin.rotation, { x: Math.random() * 6, z: Math.random() * 6, duration: 0.7 });
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
