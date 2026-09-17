import * as THREE from 'three';
import Experience from './Experience.js';
import CameraControls from 'camera-controls';

CameraControls.install({ THREE: THREE });

// Default follow framing: slightly lower and closer than the space build so the
// water surface fills more of the frame.
const FOLLOW = { distance: 22, elevation: 10 };

export default class Camera {
    constructor() {
        this.experience = Experience.getInstance();
        this.sizes = this.experience.sizes;
        this.scene = this.experience.scene;
        this.canvas = this.experience.canvas;
        this.time = this.experience.time;

        this.setInstance();
        this.setControls();

        this.experience.addUpdate(0, () => this.update());
        this.sizes.on('resize', () => this.resize());
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(42, this.sizes.width / this.sizes.height, 0.1, 400);
        this.instance.position.set(0, FOLLOW.elevation, FOLLOW.distance);
        this.scene.add(this.instance);
    }

    setControls() {
        this.controls = new CameraControls(this.instance, this.canvas);
        this.controls.smoothTime = 0.25;
        this.controls.draggingSmoothTime = 0.12;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 60;
        // Keep the camera above the water and below straight-down
        this.controls.minPolarAngle = 0.35;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.12;
        this.controls.setLookAt(0, FOLLOW.elevation, this.followDistance(), 0, 0, 0);
        this.resize();

        this.cinematicMode = false;
    }

    resize() {
        const aspect = this.sizes.width / this.sizes.height;
        this.instance.aspect = aspect;
        // Portrait phones lose most of the horizontal view; widen the lens so the
        // boat and the next island still fit in frame
        this.instance.fov = aspect < 0.9 ? 60 : 42;
        this.instance.updateProjectionMatrix();
    }

    /** Follow distance scaled for the current viewport shape. */
    followDistance() {
        const aspect = this.sizes.width / this.sizes.height;
        return aspect < 0.9 ? FOLLOW.distance * 1.15 : FOLLOW.distance;
    }

    /**
     * Intro: start high over the archipelago, glide down toward the boat in the lagoon.
     */
    cinematicFlyover() {
        this.cinematicMode = true;
        this.controls.smoothTime = 1.2;

        this.controls.setLookAt(-30, 55, 70, 0, 0, 0, false);

        setTimeout(() => {
            this.controls.setLookAt(10, 9, 18, 0, 0.5, 0, true);
        }, 400);

        setTimeout(() => {
            this.controls.smoothTime = 0.7;
            this.controls.setLookAt(0, FOLLOW.elevation, this.followDistance(), 0, 0, 0, true);
            setTimeout(() => {
                this.controls.smoothTime = 0.25;
                this.cinematicMode = false;
            }, 1200);
        }, 3800);
    }

    update() {
        if (this.cinematicMode) {
            this.controls.update(this.time.delta / 1000);
            return;
        }

        const world = this.experience.world;
        if (world && world.boat) {
            const p = world.boat.getPosition();
            // Follow the hull's XZ but keep the pivot on a steady height so the
            // camera does not bob with every wave.
            this.controls.moveTo(p.x, 0.6, p.z, true);
        }

        this.controls.update(this.time.delta / 1000);
    }
}
