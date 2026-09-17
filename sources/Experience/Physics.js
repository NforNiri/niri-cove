import Experience from './Experience.js';
import * as RAPIER from '@dimforge/rapier3d';
import EventEmitter from './Utils/EventEmitter.js';

export const SEA_LEVEL = 0;
export const SEABED_Y = -6;

export default class Physics extends EventEmitter {
    constructor() {
        super();
        this.experience = Experience.getInstance();
        this.time = this.experience.time;

        this.world = null;
        this.init();
    }

    async init() {
        this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

        // Fixed-step accumulator so 120 Hz phones don't run physics at 2x speed
        this._accumulator = 0;
        this._fixedStep = 1000 / 60;

        this.createSeabed();

        this.experience.addUpdate(1, () => this.step());
        this.emit('ready');
    }

    // Safety net far below the water surface. Buoyancy keeps everything afloat,
    // but if a body ever sinks it stops here instead of falling forever.
    createSeabed() {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, SEABED_Y, 0);
        this.seabedBody = this.addRigidBody(bodyDesc);
        this.addCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200), this.seabedBody);
    }

    addRigidBody(desc) {
        if (!this.world) return null;
        return this.world.createRigidBody(desc);
    }

    addCollider(desc, body) {
        if (!this.world) return null;
        return this.world.createCollider(desc, body);
    }

    /**
     * Static compound collider helper for islands/docks.
     * @param {Array<{type:'box'|'cylinder', pos:[x,y,z], size:[hx,hy,hz]|[radius,halfHeight], rotY?:number}>} shapes
     */
    addStaticShapes(shapes) {
        if (!this.world) return null;
        const body = this.addRigidBody(RAPIER.RigidBodyDesc.fixed());
        for (const s of shapes) {
            let desc;
            if (s.type === 'cylinder') {
                desc = RAPIER.ColliderDesc.cylinder(s.size[1], s.size[0]);
            } else {
                desc = RAPIER.ColliderDesc.cuboid(s.size[0], s.size[1], s.size[2]);
            }
            desc.setTranslation(s.pos[0], s.pos[1], s.pos[2]);
            if (s.rotY) {
                const half = s.rotY / 2;
                desc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
            }
            desc.setFriction(0.4);
            this.addCollider(desc, body);
        }
        return body;
    }

    step() {
        if (!this.world) return;

        const delta = Math.min(this.experience.time.delta, 100);
        this._accumulator += delta;
        let steps = 0;
        while (this._accumulator >= this._fixedStep && steps < 2) {
            this.world.step();
            this._accumulator -= this._fixedStep;
            steps++;
        }
    }
}
