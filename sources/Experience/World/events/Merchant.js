import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import gsap from 'gsap';
import Experience from '../../Experience.js';
import { cloneModel, fitFootprint, bounds } from '../../Utils/models.js';

// Closed loop that threads the gaps between islands and shoals and crosses the
// lagoon once per lap (validated: >= 5 units from every shore, >= 11 from docks).
const ROUTE = [
    [-22, -28], [-4, -6], [12, 6], [37, 12], [58, 34], [38, 60], [14, 74],
    [-14, 70], [-40, 56], [-52, 30], [-54, 8], [-62, -8], [-62, -26], [-42, -40],
];
const SPEED = 2.7;
const LENGTH = 7.2;
const HAIL_DIST = 15;
const HAIL_COOLDOWN = 70;

/**
 * A merchant brig on a fixed run around the archipelago. Rides the swell,
 * pushes the player aside with a kinematic hull, and dips her colours with a
 * horn when hailed up close.
 */
export default class Merchant {
    constructor(events) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.physics = this.experience.physics;
        this.renderer = this.experience.renderer;
        this.time = this.experience.time;
        this.events = events;
        this.ocean = events.ocean;

        this.curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal', 0.5);
        this.length = this.curve.getLength();
        this.u = 0.32; // start on the east leg, away from the spawn
        this.lastHail = -1e9;

        this._pos = new THREE.Vector3();
        this._tan = new THREE.Vector3();
        this._n = new THREE.Vector3();
        this._m = new THREE.Matrix4();
        this._zero = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this.foamAcc = 0;

        this.group = new THREE.Group();
        this.group.name = 'merchant';
        this.scene.add(this.group);
        this.build();
        this.buildBody();
        this.renderer.onQualityChange((q) => this.applyQuality(q));
        this.applyQuality(this.renderer.quality);
    }

    build() {
        const model = cloneModel(this.resources, 'ship-medium') || cloneModel(this.resources, 'ship-pirate-medium');
        if (model) {
            fitFootprint(model, LENGTH, -0.55);
            this.group.add(model);
            model.updateMatrixWorld(true);
            const b = bounds(model);
            this.mastTop = b.max.y;
        } else {
            const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, LENGTH), new THREE.MeshStandardMaterial({ color: 0x6B4226 }));
            this.group.add(hull);
            this.mastTop = 3;
        }

        // Colours: a pennant that dips when hailed
        this.flag = new THREE.Mesh(
            new THREE.PlaneGeometry(1.1, 0.5, 8, 2),
            new THREE.MeshStandardMaterial({ color: 0x2E6F73, side: THREE.DoubleSide, roughness: 0.9 })
        );
        this.flag.geometry.translate(0.55, 0, 0);
        this.flag.position.set(0, this.mastTop - 0.05, 0);
        this.flagPivot = new THREE.Group();
        this.flagPivot.add(this.flag);
        this.group.add(this.flagPivot);

        // Stern lantern for the night run
        this.lantern = new THREE.PointLight(0xFFB067, 0, 10, 1.7);
        this.lantern.position.set(0, 1.6, LENGTH * 0.42);
        this.group.add(this.lantern);
        this.lanternGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xFFD9A0, emissive: 0xFFA640, emissiveIntensity: 0 })
        );
        this.lanternGlow.position.copy(this.lantern.position);
        this.group.add(this.lanternGlow);
    }

    buildBody() {
        if (!this.physics.world) return;
        const desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0);
        this.rigidBody = this.physics.world.createRigidBody(desc);
        const col = RAPIER.ColliderDesc.cuboid(1.3, 0.9, LENGTH * 0.46).setFriction(0.2).setRestitution(0.1);
        this.physics.world.createCollider(col, this.rigidBody);
    }

    applyQuality(q) {
        this.high = q === 'high';
    }

    hail() {
        this.lastHail = this.events.clock;
        const audio = this.experience.audio;
        if (audio) audio.playAt('horn', this.group.position.x, this.group.position.z, { maxDist: 60 });
        gsap.killTweensOf(this.flagPivot.scale);
        gsap.to(this.flagPivot.scale, { y: 0.15, duration: 0.9, ease: 'power2.inOut', yoyo: true, repeat: 1, repeatDelay: 0.6 });
        const first = this.experience.progress.addSecret('merchant');
        const ui = this.experience.world.ui;
        if (ui) ui.toast(first ? 'THE MERCHANT DIPS HER COLOURS' : 'THE MERCHANT SALUTES', 2800);
        this.experience.emit('event:merchant');
    }

    update(dt) {
        this.u = (this.u + (SPEED * dt) / this.length) % 1;
        this.curve.getPointAt(this.u, this._pos);
        this.curve.getTangentAt(this.u, this._tan);

        const x = this._pos.x, z = this._pos.z;
        const y = this.ocean.getHeight(x, z) - 0.05;
        this.group.position.set(x, y, z);

        // Heading from the tangent (+Z-forward model), tilt from the swell normal
        this.ocean.getNormal(x, z, this._n);
        const yaw = Math.atan2(this._tan.x, this._tan.z);
        this._look.set(Math.sin(yaw), 0, Math.cos(yaw));
        // Project forward onto the water plane defined by the normal
        this._look.addScaledVector(this._n, -this._look.dot(this._n)).normalize();
        // Matrix4.lookAt(eye, target, up) puts +Z along (eye - target): +Z = heading
        this._m.lookAt(this._look, this._zero, this._n);
        this.group.quaternion.setFromRotationMatrix(this._m);

        if (this.rigidBody) {
            this.rigidBody.setNextKinematicTranslation({ x, y: y + 0.3, z });
            const q = this.group.quaternion;
            this.rigidBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        }

        // Wake foam off the stern
        this.foamAcc += dt * 5;
        while (this.foamAcc >= 1) {
            this.foamAcc -= 1;
            const sx = x - this._tan.x * LENGTH * 0.45 + (Math.random() - 0.5) * 1.2;
            const sz = z - this._tan.z * LENGTH * 0.45 + (Math.random() - 0.5) * 1.2;
            this.events.wake.emit(sx, sz, { size: 1.6, life: 2.2, jitter: 0.5 });
        }

        // Flag flutters along the wind
        const t = this.time.elapsed / 1000;
        this.flagPivot.rotation.y = Math.PI * 0.5 + Math.sin(t * 1.3) * 0.25;
        this.flag.rotation.x = Math.sin(t * 6) * 0.08;

        const env = this.experience.world.environment;
        const night = env ? env.nightFactor : 0;
        this.lantern.intensity = this.high ? night * 5 : 0;
        this.lanternGlow.material.emissiveIntensity = night * 2.2;

        // Hail when the player comes alongside
        const boat = this.experience.world.boat;
        if (boat && boat.rigidBody && !this.experience.controls.locked) {
            const p = boat.getPosition();
            const d = Math.hypot(p.x - x, p.z - z);
            if (d < HAIL_DIST && this.events.clock - this.lastHail > HAIL_COOLDOWN) this.hail();
        }
    }
}
