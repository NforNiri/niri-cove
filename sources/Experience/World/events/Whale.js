import * as THREE from 'three';
import Experience from '../../Experience.js';
import { shoreDistance } from '../layout.js';

const DURATION = 18;
const COOLDOWN = 280;

/**
 * A whale that surfaces off the bow after dark: back rises, spout, a slow
 * roll, flukes up, and it is gone. Once per night while the boat is idling.
 */
export default class Whale {
    constructor(events) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.events = events;
        this.ocean = events.ocean;

        this.active = false;
        this.t = 0;
        this.cooldownUntil = 60;
        this.wasNight = false;
        this.shownThisNight = false;

        this.group = new THREE.Group();
        this.group.name = 'whale';
        this.group.visible = false;
        this.scene.add(this.group);

        const mat = new THREE.MeshStandardMaterial({ color: 0x2C3B4B, roughness: 0.55, metalness: 0.05 });
        const light = new THREE.MeshStandardMaterial({ color: 0x8FA1AD, roughness: 0.7 });

        this.body = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.SphereGeometry(1.7, 18, 12), mat);
        torso.scale.set(1, 0.6, 3.4);
        torso.castShadow = true;
        this.body.add(torso);
        const chin = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), light);
        chin.scale.set(1, 0.55, 2.6);
        chin.position.set(0, -0.55, -1.2);
        this.body.add(chin);
        const hump = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 6), mat);
        hump.position.set(0, 1.05, 1.6);
        hump.rotation.x = 0.4;
        this.body.add(hump);

        this.tail = new THREE.Group();
        this.tail.position.set(0, 0.1, 5.4);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 1.8, 8), mat);
        stem.rotation.x = Math.PI / 2;
        stem.position.z = -0.6;
        this.tail.add(stem);
        const flukes = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.1), mat);
        flukes.position.z = 0.5;
        this.tail.add(flukes);
        this.body.add(this.tail);

        this.group.add(this.body);
        this.heading = 0;
    }

    findSpot(boatPos) {
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 26 + Math.random() * 8;
            const x = boatPos.x + Math.cos(a) * r;
            const z = boatPos.z + Math.sin(a) * r;
            if (shoreDistance(x, z) > 12 && Math.hypot(x, z) < 110) return { x, z };
        }
        return null;
    }

    start(spot) {
        this.active = true;
        this.t = 0;
        this.shownThisNight = true;
        this.group.visible = true;
        this.group.position.set(spot.x, -8, spot.z);
        this.heading = Math.random() * Math.PI * 2;
        this.group.rotation.y = this.heading;
        this.spouted = false;
        this.called = false;
        this.experience.emit('event:whale');
    }

    stop() {
        this.active = false;
        this.group.visible = false;
        this.cooldownUntil = this.events.clock + COOLDOWN;
    }

    update(dt) {
        const world = this.experience.world;
        const boat = world.boat;
        const env = world.environment;
        if (!boat || !boat.rigidBody || !env) return;

        const night = env.nightFactor > 0.7;
        if (night && !this.wasNight) this.shownThisNight = false;
        this.wasNight = night;

        if (!this.active) {
            if (!night || this.shownThisNight || this.events.clock < this.cooldownUntil) return;
            if (boat.speed > 4.5 || this.experience.controls.locked) return;
            if (world.weather && world.weather.intensity > 0.3) return;
            const spot = this.findSpot(boat.getPosition());
            if (spot) this.start(spot);
            return;
        }

        this.t += dt;
        const k = this.t / DURATION;
        const tSec = this.time.elapsed / 1000;

        // Rise (0-0.2), cruise (0.2-0.7), flukes + sink (0.7-1)
        const rise = THREE.MathUtils.smoothstep(k, 0, 0.2);
        const sink = THREE.MathUtils.smoothstep(k, 0.72, 1);
        const water = this.ocean.getHeight(this.group.position.x, this.group.position.z);
        const surface = water - 0.15 + Math.sin(tSec * 0.9) * 0.15;
        this.group.position.y = THREE.MathUtils.lerp(-8, surface, rise) - sink * 9;

        // Slow forward drift
        const speed = 1.3 * (1 - sink);
        this.group.position.x += Math.sin(this.heading) * speed * dt;
        this.group.position.z += Math.cos(this.heading) * speed * dt;

        // Nose down as the flukes lift on the way out
        const dive = THREE.MathUtils.smoothstep(k, 0.68, 0.85);
        this.body.rotation.x = -dive * 0.55;
        this.tail.rotation.x = -dive * 0.6 + Math.sin(tSec * 1.6) * 0.08;
        this.body.rotation.z = Math.sin(tSec * 0.7) * 0.05;

        if (!this.called && k > 0.1) {
            this.called = true;
            const audio = this.experience.audio;
            if (audio) audio.playAt('whale', this.group.position.x, this.group.position.z, { maxDist: 80 });
            const progress = this.experience.progress;
            const first = progress.addSecret('whale');
            const ui = world.ui;
            if (ui) ui.toast(first ? 'A WHALE SURFACES OFF THE BOW' : 'THE NIGHT WHALE, AGAIN', 3000);
        }

        // Spout: a column of spray from the blowhole
        if (k > 0.22 && k < 0.34) {
            const bx = this.group.position.x + Math.sin(this.heading) * -1.4;
            const bz = this.group.position.z + Math.cos(this.heading) * -1.4;
            if (Math.random() < 0.6) this.events.splash.burst(bx, this.group.position.y + 1.0, bz, 0, 6.5, 0, { n: 4, spread: 0.9, size: 0.9, life: 1.1 });
        }
        // Foam along the flanks while the back is up
        if (rise > 0.5 && sink < 0.6 && Math.random() < 0.25) {
            const side = Math.random() < 0.5 ? -2.1 : 2.1;
            const sx = this.group.position.x + Math.cos(this.heading) * side;
            const sz = this.group.position.z - Math.sin(this.heading) * side;
            this.events.wake.emit(sx, sz, { size: 2.2, life: 2.0, jitter: 2.5 });
        }
        if (dive > 0.9 && sink > 0.2 && Math.random() < 0.5) {
            const tx = this.group.position.x + Math.sin(this.heading) * 5;
            const tz = this.group.position.z + Math.cos(this.heading) * 5;
            this.events.splash.burst(tx, water + 0.2, tz, 0, 3.5, 0, { n: 6, spread: 3, size: 0.8, life: 0.9 });
        }

        if (this.t > DURATION) this.stop();
    }
}
