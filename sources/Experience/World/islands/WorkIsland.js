import * as THREE from 'three';
import gsap from 'gsap';
import IslandBase from './IslandBase.js';
import { cloneModel, fitFootprint } from '../../Utils/models.js';
import Slideshow from '../../Utils/Slideshow.js';
import { PROJECTS } from '../../UI/panels/projects.js';

/**
 * The Shipyard — fortress walls, a watchtower, cannons and a pirate ship
 * under repair moored off the leeward side. This is where the work happens.
 */
export default class WorkIsland extends IslandBase {
    constructor(data) {
        super(data, { plateau: 2.2, plateauRadius: 0.58, seed: 7, rockiness: 0.08 });
    }

    dress() {
        // Fortress facing the dock: gate in the middle, walls either side
        const gatePos = this.polar(this.radius * 0.3, Math.PI);
        this.place('castle-gate', gatePos.x, gatePos.z, { footprint: 3.2, rotY: this.dockYaw });
        for (const side of [-1, 1]) {
            const w = this.polar(this.radius * 0.36, Math.PI + side * 0.42);
            this.place('castle-wall', w.x, w.z, { footprint: 3.0, rotY: this.dockYaw + side * 0.42 });
        }

        // Watchtower behind the wall
        const tower = this.polar(this.radius * 0.52, Math.PI * 1.1);
        this.place('tower-watch', tower.x, tower.z, { footprint: 2.6, rotY: this.dockYaw + Math.PI });

        // Cannons pointing to sea
        this.cannons = [];
        for (const [dist, ang] of [[0.62, Math.PI * 0.62], [0.62, -Math.PI * 0.62], [0.72, Math.PI * 0.85]]) {
            const p = this.polar(this.radius * dist, ang);
            const c = this.place('cannon', p.x, p.z, { scale: 1, rotY: Math.atan2(p.x, p.z) });
            if (c) this.cannons.push(c);
        }
        // The dock gun: the one the visitor fires
        const gun = this.polar(this.radius * 0.66, 0.42);
        this.dockGun = this.place('cannon', gun.x, gun.z, { scale: 1.1, rotY: this.dockYaw + 0.9 });
        this.buildCannonball();
        const mobile = this.polar(this.radius * 0.5, Math.PI * 0.35);
        this.place('cannon-mobile', mobile.x, mobile.z, { scale: 1, rotY: this.dockYaw + 0.5 });
        this.place('cannon-ball', mobile.x + 0.8, mobile.z + 0.3, { scale: 1 });
        this.place('cannon-ball', mobile.x + 1.1, mobile.z - 0.1, { scale: 1 });

        // Cargo by the pier
        for (let i = 0; i < 4; i++) {
            const p = this.polar(this.radius * (0.6 + this.rand(i) * 0.15), -Math.PI * (0.12 + i * 0.09));
            this.place(i % 2 ? 'crate' : 'barrel', p.x, p.z, { scale: 1, rotY: this.rand(i * 3) * 3 });
        }
        const bottles = this.polar(this.radius * 0.55, -Math.PI * 0.42);
        this.place('crate-bottles', bottles.x, bottles.z, { scale: 1, rotY: 1.2 });

        // Flags on the wall
        for (const side of [-1, 1]) {
            const f = this.polar(this.radius * 0.42, Math.PI + side * 0.75);
            const flag = this.place('flag-pirate-high', f.x, f.z, { scale: 1, rotY: this.dockYaw });
            if (flag) this.animated.push({ obj: flag, kind: 'sway', phase: side * 2 });
        }

        // Ship under repair, moored off the side, bobbing on the swell
        this.buildMooredShip();

        // Billboard by the pier cycling the shipyard's launches
        this.buildBillboard();

        this.palms(6, { start: 40, minR: this.radius * 0.7, maxR: this.radius * 0.85 });
        this.scatter(['rocks-a', 'rocks-b', 'rocks-c'], 5, { minR: 0.6, maxR: 0.9, start: 400, scale: 1 });
        this.scatter(['grass-patch', 'patch-grass'], 6, { minR: 0.3, maxR: 0.6, start: 500 });

        // Braziers on the gate
        const l1 = this.polar(this.radius * 0.3, Math.PI - 0.22);
        const l2 = this.polar(this.radius * 0.3, Math.PI + 0.22);
        this.addLight(l1.x, this.heightAt(l1.x, l1.z) + 2.6, l1.z, { intensity: 3.5, distance: 10, flicker: 0.15 });
        this.addLight(l2.x, this.heightAt(l2.x, l2.z) + 2.6, l2.z, { intensity: 3.5, distance: 10, flicker: 0.15 });
    }

    buildBillboard() {
        // Facing the lagoon, just off the pier so the boat sees it on approach
        const p = this.polar(this.radius * 0.58, -0.55);
        const y = this.heightAt(p.x, p.z);
        const holder = new THREE.Group();
        holder.position.set(p.x, y, p.z);
        holder.rotation.y = this.dockYaw - 0.55;

        const postMat = new THREE.MeshStandardMaterial({ color: 0x6B4423, roughness: 0.9 });
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 7), postMat);
            post.position.set(side * 1.25, 1.3, 0);
            post.castShadow = true;
            holder.add(post);
        }
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.75, 0.08), postMat);
        frame.position.set(0, 1.95, 0);
        frame.castShadow = true;
        holder.add(frame);

        const urls = PROJECTS.filter((pr) => pr.slug).map((pr) => `/thumbs/${pr.slug}.jpg`);
        this.board = new Slideshow(urls, { width: 512, height: 320, hold: 3.2, fade: 0.8, fit: 'cover' });
        this.boardMat = new THREE.MeshStandardMaterial({
            map: this.board.texture,
            emissiveMap: this.board.texture,
            emissive: 0xFFFFFF,
            emissiveIntensity: 0.0,
            roughness: 0.6,
        });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.56), this.boardMat);
        face.position.set(0, 1.95, 0.05);
        holder.add(face);

        // A little lamp over the board so it reads at night
        const lampMat = new THREE.MeshStandardMaterial({ color: 0xFFE2B0, emissive: 0xFFA640, emissiveIntensity: 0.3 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat);
        lamp.position.set(0, 2.95, 0.25);
        holder.add(lamp);
        this.boardLamp = lampMat;
        this.group.add(holder);
        this.boardWorld = { x: this.data.x + p.x, z: this.data.z + p.z };
        this.addLight(p.x, y + 2.9, p.z, { intensity: 2.2, distance: 6, flicker: 0.05 });
    }

    buildCannonball() {
        this.ball = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0x2A2A2A, roughness: 0.6, metalness: 0.4 })
        );
        this.ball.visible = false;
        this.scene.add(this.ball);

        // Muzzle flash
        this.flash = new THREE.PointLight(0xFFC070, 0, 14, 2);
        this.flash.visible = false;
        this.scene.add(this.flash);

        this.smoke = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xE8E4DA, transparent: true, opacity: 0, depthWrite: false })
        );
        this.smoke.visible = false;
        this.scene.add(this.smoke);
    }

    registerQuest(interactables) {
        interactables.add({
            id: 'cannon',
            x: this.data.dock.x,
            z: this.data.dock.z,
            radius: 9,
            label: 'Fire the cannon',
            repeatLabel: 'Fire again',
            action: () => this.fireCannon(),
        });
    }

    fireCannon() {
        if (!this.dockGun || this.firing) return Promise.resolve();
        this.firing = true;
        const gun = this.dockGun;
        gun.updateMatrixWorld(true);
        const muzzle = new THREE.Vector3(0, 0.9, 1.1).applyMatrix4(gun.matrixWorld);
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
        // Aim past the dock so the splash lands in open water
        const target = muzzle.clone().add(dir.multiplyScalar(26));
        target.y = 0;

        const audio = this.experience.audio;
        const cam = this.experience.camera;
        if (audio) audio.playAt('cannon', muzzle.x, muzzle.z, { maxDist: 90, volume: 1 });
        if (cam) cam.addShake(0.8);

        // Recoil
        const rest = gun.position.clone();
        const back = new THREE.Vector3(0, 0, -0.35).applyQuaternion(gun.quaternion);
        gsap.fromTo(gun.position, { x: rest.x + back.x, z: rest.z + back.z }, { x: rest.x, z: rest.z, duration: 0.6, ease: 'power2.out' });

        this.flash.position.copy(muzzle);
        this.flash.visible = true;
        this.flash.intensity = 40;
        gsap.to(this.flash, { intensity: 0, duration: 0.25, onComplete: () => { this.flash.visible = false; } });

        this.smoke.position.copy(muzzle);
        this.smoke.scale.setScalar(0.6);
        this.smoke.material.opacity = 0.8;
        this.smoke.visible = true;
        gsap.to(this.smoke.scale, { x: 3.5, y: 3.5, z: 3.5, duration: 1.6, ease: 'power1.out' });
        gsap.to(this.smoke.material, { opacity: 0, duration: 1.6, ease: 'power1.in', onComplete: () => { this.smoke.visible = false; } });

        this.ball.visible = true;
        const flight = { t: 0 };
        return new Promise((resolve) => {
            gsap.to(flight, {
                t: 1, duration: 1.3, ease: 'none',
                onUpdate: () => {
                    const k = flight.t;
                    this.ball.position.lerpVectors(muzzle, target, k);
                    this.ball.position.y = muzzle.y * (1 - k) + Math.sin(k * Math.PI) * 5.5;
                },
                onComplete: () => {
                    this.ball.visible = false;
                    const ocean = this.experience.world ? this.experience.world.ocean : null;
                    const bv = this.experience.world ? this.experience.world.boatVisual : null;
                    if (bv && bv.splash) {
                        const y = ocean ? ocean.getHeight(target.x, target.z) : 0;
                        bv.splash.burst(target.x, y, target.z, 0, 4.5, 0, { n: 26, spread: 3.2, size: 0.9, life: 0.9 });
                        for (let i = 0; i < 6; i++) bv.wake.emit(target.x, target.z, { size: 2.6, life: 2.2, jitter: 1.4 });
                    }
                    if (audio) audio.playAt('splash', target.x, target.z, { maxDist: 70, volume: 1.2 });
                    this.firing = false;
                    resolve();
                },
            });
        });
    }

    buildMooredShip() {
        const model = cloneModel(this.resources, 'ship-pirate-medium');
        if (!model) return;
        fitFootprint(model, 8.5, -0.9);

        // World position just off the island, 90° round from the dock
        const a = Math.atan2(this.dockDir.y, this.dockDir.x) + Math.PI * 0.55;
        const d = this.radius + 6.5;
        this.mooredPos = new THREE.Vector3(this.data.x + Math.cos(a) * d, 0, this.data.z + Math.sin(a) * d);

        this.moored = new THREE.Group();
        this.moored.position.copy(this.mooredPos);
        this.moored.rotation.y = a + Math.PI / 2;
        this.moored.add(model);
        this.scene.add(this.moored);

        this.physics.addStaticShapes([
            { type: 'box', pos: [this.mooredPos.x, 0, this.mooredPos.z], size: [1.8, 1.5, 4.2], rotY: a + Math.PI / 2 },
        ]);
    }

    update() {
        super.update();
        if (this.moored && this.experience.world?.ocean) {
            const ocean = this.experience.world.ocean;
            const p = this.mooredPos;
            const h = ocean.getHeight(p.x, p.z);
            this.moored.position.y = h * 0.6;
            const t = this.time.elapsed / 1000;
            this.moored.rotation.z = Math.sin(t * 0.5) * 0.02;
            this.moored.rotation.x = Math.cos(t * 0.37) * 0.015;
        }
        if (this.board) {
            // Cycle only on HIGH and when the camera is close enough to read it
            const high = this.experience.renderer && this.experience.renderer.quality === 'high';
            const cam = this.experience.camera ? this.experience.camera.instance : null;
            const near = cam ? Math.hypot(cam.position.x - this.boardWorld.x, cam.position.z - this.boardWorld.z) < 60 : true;
            this.board.enabled = high && near;
            if (this.board.enabled) this.board.update(Math.min(this.time.delta / 1000, 0.1));
            const night = this.experience.world?.environment?.nightFactor ?? 0;
            this.boardMat.emissiveIntensity = 0.15 + night * 0.7;
            if (this.boardLamp) this.boardLamp.emissiveIntensity = 0.3 + night * 1.8;
        }
    }
}
