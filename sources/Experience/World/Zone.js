import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Experience from '../Experience.js';
import { ISLANDS } from './layout.js';

/**
 * Island arrival zones. Each dock has a striped mooring buoy that rides the
 * swell and carries the island's name. Sailing inside the trigger radius
 * opens the island's panel.
 */
export default class Zone {
    constructor(boat, ocean) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.boat = boat;
        this.ocean = ocean;

        this.activeZone = null;
        this.markers = [];

        this.zoneData = ISLANDS.map((i) => ({
            id: i.id,
            label: i.label,
            subtitle: i.subtitle,
            position: new THREE.Vector3(i.dock.x, 0, i.dock.z),
            island: new THREE.Vector3(i.x, 0, i.z),
            radius: i.triggerRadius,
            color: i.color,
        }));

        this._n = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);
        this._q = new THREE.Quaternion();

        this.createMarkers();
    }

    createMarkers() {
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xF7F3E8, roughness: 0.6 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xB3322E, roughness: 0.6 });

        for (const zone of this.zoneData) {
            const group = new THREE.Group();
            // Buoy marks the trigger centre, on open water past the pier tip
            group.position.copy(zone.position);

            const body = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.45, 12), redMat);
            base.position.y = 0.1;
            body.add(base);
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.42, 0.28, 12), whiteMat);
            band.position.y = 0.45;
            body.add(band);
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), redMat);
            post.position.y = 1.1;
            body.add(post);
            const lampMat = new THREE.MeshStandardMaterial({ color: zone.color, emissive: zone.color, emissiveIntensity: 0.4 });
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampMat);
            lamp.position.y = 1.72;
            body.add(lamp);
            body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            group.add(body);

            const labelDiv = document.createElement('div');
            labelDiv.className = 'zone-label';
            labelDiv.innerHTML = `<span class="zone-label-name">${zone.label}</span><span class="zone-label-sub">${zone.subtitle}</span>`;
            const label = new CSS2DObject(labelDiv);
            label.position.y = 2.6;
            group.add(label);

            this.scene.add(group);
            this.markers.push({ group, body, lamp, lampMat, labelDiv, zone, phase: Math.random() * 6 });
        }
    }

    update() {
        if (!this.boat || !this.boat.rigidBody) return;

        const t = this.time.elapsed / 1000;
        const p = this.boat.getPosition();
        const night = this.experience.world?.environment?.nightFactor ?? 0;

        let closest = null;
        let closestDist = Infinity;

        for (const m of this.markers) {
            const { group, zone } = m;

            // Ride the swell
            const h = this.ocean.getHeight(group.position.x, group.position.z);
            group.position.y = h - 0.15;
            this.ocean.getNormal(group.position.x, group.position.z, this._n);
            this._q.setFromUnitVectors(this._up, this._n);
            m.body.quaternion.slerp(this._q, 0.15);
            m.body.rotation.y = Math.sin(t * 0.6 + m.phase) * 0.15;

            const dist = Math.hypot(p.x - zone.position.x, p.z - zone.position.z);
            const near = Math.max(0, 1 - dist / (zone.radius * 2));
            m.lampMat.emissiveIntensity = 0.4 + near * 1.4 + night * 1.2 + Math.sin(t * 3 + m.phase) * 0.15;
            m.labelDiv.classList.toggle('is-near', near > 0.35);

            // Hysteresis: a zone you're already in stays active a little further out
            const limit = zone.id === this.activeZone ? zone.radius + 2.5 : zone.radius;
            if (dist < limit && dist < closestDist) {
                closestDist = dist;
                closest = zone;
            }
        }

        if (closest && closest.id !== this.activeZone) {
            if (this.activeZone) this.experience.emit('zone:exit', this.activeZone);
            this.activeZone = closest.id;
            this.experience.emit('zone:enter', closest.id);
            if (this.experience.audio) this.experience.audio.playZoneEnter();
        } else if (!closest && this.activeZone) {
            this.experience.emit('zone:exit', this.activeZone);
            this.activeZone = null;
        }
    }
}
