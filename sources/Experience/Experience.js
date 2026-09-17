import { inject } from '@vercel/analytics';
inject();

import * as THREE from 'three';
import Sizes from './Utils/Sizes.js';
import Time from './Utils/Time.js';
import Resources from './Utils/Resources.js';
import EventEmitter from './Utils/EventEmitter.js';
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import Physics from './Physics.js';
import Controls from './Controls.js';
import LoadingScreen from './LoadingScreen.js';
import Audio from './Audio.js';
import World from './World/World.js';
import StatsGL from 'stats-gl';
import sources from './sources.js';
import { measure } from './Utils/models.js';

let instance = null;

/**
 * Singleton root. Owns the priority-ordered update loop:
 * 0 camera | 1 physics | 2 boat physics | 3 boat visual | 4 zones | 5 audio | 6 floaters | 7 animated world | 8 environment
 */
export default class Experience {
    constructor() {
        if (instance) return instance;
        instance = this;

        const emitter = new EventEmitter();
        this.on = emitter.on.bind(emitter);
        this.off = emitter.off.bind(emitter);
        this.emit = emitter.emit.bind(emitter);

        this.canvas = document.createElement('canvas');
        document.body.appendChild(this.canvas);

        this.updateCallbacks = [];

        this.sizes = new Sizes();
        this.time = new Time();
        this.resources = new Resources(sources);

        this.scene = new THREE.Scene();
        this.camera = new Camera();
        this.renderer = new Renderer();
        this.physics = new Physics();
        this.controls = new Controls();
        this.loadingScreen = new LoadingScreen();

        this.resources.on('ready', () => {
            this.audio = new Audio();
            this.world = new World();
        });

        if (import.meta.env?.DEV) {
            this.stats = new StatsGL({ container: document.body });
            window.__cove = this;
            window.__measure = (name) => {
                const g = this.resources.items[name];
                return g && g.scene ? measure(g.scene) : null;
            };
        }

        this.update = this.update.bind(this);
        window.requestAnimationFrame(this.update);
    }

    static getInstance() {
        return instance;
    }

    addUpdate(priority, callback) {
        this.updateCallbacks.push({ priority, callback });
        this.updateCallbacks.sort((a, b) => a.priority - b.priority);
    }

    update() {
        if (this.stats) this.stats.begin();

        this.time.update();

        for (const item of this.updateCallbacks) {
            item.callback();
        }

        if (this.renderer) {
            this.renderer.render();
        }

        if (this.stats) {
            this.stats.update();
            this.stats.end();
        }

        window.requestAnimationFrame(this.update);
    }
}
