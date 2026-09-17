import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import gsap from 'gsap';
import Experience from '../Experience.js';
import { cloneModel, fitFootprint } from '../Utils/models.js';
import { DOUBLOONS } from './layout.js';
import { DOUBLOON_TOTAL } from '../Utils/Progress.js';

/**
 * Things that float in the lagoon:
 *  - pushable barrels/crates (dynamic bodies with single-point buoyancy)
 *  - twenty collectible doubloons that bob on the swell (persisted in Progress)
 */
export default class Floaters {
    constructor(ocean, boat) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.physics = this.experience.physics;
        this.resources = this.experience.resources;
        this.time = this.experience.time;
        this.progress = this.experience.progress;
        this.ocean = ocean;
        this.boat = boat;

        this.pushables = [];
        this.coins = [];

        this.createPushables();
        this.createDoubloons();

        this.experience.addUpdate(6, () => this.update());
    }

    createPushables() {
        const items = [
            { model: 'barrel', x: 6, z: -8 },
            { model: 'barrel', x: -7, z: 10 },
            { model: 'crate-bottles', x: 12, z: 6 },
            { model: 'barrel', x: -14, z: -4 },
            { model: 'chest', x: 4, z: 16 },
            { model: 'barrel', x: 18, z: -18 },
            { model: 'crate-bottles', x: -20, z: 16 },
            { model: 'barrel', x: 22, z: 14 },
            { model: 'barrel', x: -24, z: -22 },
            { model: 'chest', x: 0, z: -14 },
        ];

        for (const item of items) {
            const mesh = cloneModel(this.resources, item.model);
            if (!mesh) continue;
            fitFootprint(mesh, 1.0, -0.38);
            const holder = new THREE.Group();
            holder.add(mesh);
            holder.position.set(item.x, 0, item.z);
            this.scene.add(holder);

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(item.x, 0.2, item.z)
                .setAdditionalMass(0.6)
                .setLinearDamping(1.2)
                .setAngularDamping(1.6);
            const rigidBody = this.physics.world.createRigidBody(bodyDesc);
            const collider = RAPIER.ColliderDesc.ball(0.42).setRestitution(0.35).setFriction(0.3);
            this.physics.world.createCollider(collider, rigidBody);

            this.pushables.push({ mesh: holder, rigidBody, phase: Math.random() * 6 });
        }
    }

    createDoubloons() {
        const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18);
        // No environment map, so keep metalness low or the coin renders black
        const mat = new THREE.MeshStandardMaterial({
            color: 0xF0C048,
            metalness: 0.3,
            roughness: 0.35,
            emissive: 0xB07A10,
            emissiveIntensity: 0.6,
        });

        for (const d of DOUBLOONS) {
            // Already found on a previous visit
            if (this.progress.hasDoubloon(d.id)) continue;
            const { x, z } = d;
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const coin = new THREE.Mesh(geo, mat.clone());
            coin.rotation.x = Math.PI / 2;
            coin.castShadow = true;
            group.add(coin);

            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.7, 0.85, 24),
                new THREE.MeshBasicMaterial({ color: 0xFFE2B0, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = -0.3;
            group.add(ring);

            this.scene.add(group);
            this.coins.push({ id: d.id, group, coin, ring, collected: false, phase: Math.random() * 6 });
        }
    }

    collect(c) {
        c.collected = true;

        gsap.to(c.group.position, { y: c.group.position.y + 2.2, duration: 0.6, ease: 'power2.out' });
        gsap.to(c.group.scale, {
            x: 0.01, y: 0.01, z: 0.01, duration: 0.6, ease: 'power2.in',
            onComplete: () => this.scene.remove(c.group),
        });

        if (this.experience.audio) this.experience.audio.playCollect();
        this.progress.collectDoubloon(c.id);

        const ui = this.experience.world ? this.experience.world.ui : null;
        const n = this.progress.doubloons;
        if (ui) {
            if (n >= DOUBLOON_TOTAL) ui.toast('ALL DOUBLOONS RECOVERED — THE COVE IS YOURS', 3600);
            else ui.toast(`${n} / ${DOUBLOON_TOTAL} DOUBLOONS`);
            if (ui.treasureMap) ui.treasureMap.bumpCounter();
        }
    }

    update() {
        const t = this.time.elapsed / 1000;

        // Barrels: buoyancy force at the body centre, then sync the visual
        for (const obj of this.pushables) {
            const rb = obj.rigidBody;
            rb.resetForces(true);
            const pos = rb.translation();
            const vel = rb.linvel();
            const waterY = this.ocean.getHeight(pos.x, pos.z);
            const depth = (waterY - pos.y) + 0.12;
            if (depth > -0.6) {
                const f = Math.max(depth, -0.2) * 70 - vel.y * 6;
                rb.addForce({ x: 0, y: f, z: 0 }, true);
            }
            const rot = rb.rotation();
            obj.mesh.position.set(pos.x, pos.y, pos.z);
            obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        }

        if (!this.boat || !this.boat.rigidBody) return;
        const p = this.boat.getPosition();

        for (const c of this.coins) {
            if (c.collected) continue;
            const g = c.group;
            const h = this.ocean.getHeight(g.position.x, g.position.z);
            g.position.y = h + 0.55 + Math.sin(t * 1.6 + c.phase) * 0.12;
            c.coin.rotation.z = t * 1.4 + c.phase;
            c.ring.material.opacity = 0.25 + Math.sin(t * 2 + c.phase) * 0.12;

            const dist = Math.hypot(p.x - g.position.x, p.z - g.position.z);
            if (dist < 2.6) this.collect(c);
        }
    }
}
