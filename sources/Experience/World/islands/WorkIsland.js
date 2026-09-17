import * as THREE from 'three';
import IslandBase from './IslandBase.js';
import { cloneModel, fitFootprint } from '../../Utils/models.js';

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
        for (const [dist, ang] of [[0.62, Math.PI * 0.62], [0.62, -Math.PI * 0.62], [0.72, Math.PI * 0.85]]) {
            const p = this.polar(this.radius * dist, ang);
            this.place('cannon', p.x, p.z, { scale: 1, rotY: Math.atan2(p.x, p.z) });
        }
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

        this.palms(6, { start: 40, minR: this.radius * 0.7, maxR: this.radius * 0.85 });
        this.scatter(['rocks-a', 'rocks-b', 'rocks-c'], 5, { minR: 0.6, maxR: 0.9, start: 400, scale: 1 });
        this.scatter(['grass-patch', 'patch-grass'], 6, { minR: 0.3, maxR: 0.6, start: 500 });

        // Braziers on the gate
        const l1 = this.polar(this.radius * 0.3, Math.PI - 0.22);
        const l2 = this.polar(this.radius * 0.3, Math.PI + 0.22);
        this.addLight(l1.x, this.heightAt(l1.x, l1.z) + 2.6, l1.z, { intensity: 3.5, distance: 10, flicker: 0.15 });
        this.addLight(l2.x, this.heightAt(l2.x, l2.z) + 2.6, l2.z, { intensity: 3.5, distance: 10, flicker: 0.15 });
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
    }
}
