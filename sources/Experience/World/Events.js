import Experience from '../Experience.js';
import Wake, { Splash } from '../Vehicle/Wake.js';
import Dolphins from './events/Dolphins.js';
import Whale from './events/Whale.js';
import Merchant from './events/Merchant.js';
import Bottle from './events/Bottle.js';
import Kraken from './events/Kraken.js';

/**
 * Ambient event scheduler: things that happen on the water so idling is
 * enjoyable. Each event owns its own trigger rules; this class owns the
 * shared clock (starts after the intro) and the shared foam/spray pools.
 */
export default class Events {
    constructor(ocean) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.ocean = ocean;

        this.clock = 0;
        this.running = false;

        this.wake = new Wake(this.scene, ocean, { count: 260 });
        this.splash = new Splash(this.scene, { count: 320 });

        this.merchant = new Merchant(this);
        this.dolphins = new Dolphins(this);
        this.whale = new Whale(this);
        this.bottle = new Bottle(this);
        this.kraken = new Kraken(this);
        this.list = [this.merchant, this.dolphins, this.whale, this.bottle, this.kraken];

        this.experience.on('intro:done', () => { this.running = true; });
        this.experience.addUpdate(7, () => this.update());
    }

    update() {
        const dt = Math.min(this.time.delta / 1000, 0.1);
        const t = this.time.elapsed / 1000;
        this.wake.update(t);
        this.splash.update(t);

        // The merchant sails during the intro too (she is part of the view)
        this.merchant.update(dt);
        if (!this.running) return;
        this.clock += dt;
        for (const e of this.list) {
            if (e === this.merchant) continue;
            e.update(dt);
        }
    }
}
