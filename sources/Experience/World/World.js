import Experience from '../Experience.js';
import Ocean from './Ocean.js';
import Environment from './Environment.js';
import Zone from './Zone.js';
import Floaters from './Floaters.js';
import Shoals from './Shoals.js';
import Gulls from './Gulls.js';
import Interactables from './Interactable.js';
import Boat from '../Vehicle/Boat.js';
import BoatVisual from '../Vehicle/BoatVisual.js';
import { buildIslands } from './islands/index.js';
import UI from '../UI/UI.js';

export default class World {
    constructor() {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;

        this.ocean = new Ocean();
        this.environment = new Environment(this.ocean);

        if (this.experience.physics.world) {
            this.spawn();
        } else {
            this.experience.physics.on('ready', () => this.spawn());
        }
    }

    spawn() {
        const exp = this.experience;

        this.boat = new Boat(this.ocean);
        this.boatVisual = new BoatVisual(this.boat, this.ocean);

        exp.addUpdate(2, () => this.boat.update(exp.controls, exp.time.delta));
        exp.addUpdate(3, () => this.boatVisual.update(exp.controls));

        this.islands = buildIslands();
        this.shoals = new Shoals();
        this.gulls = new Gulls();

        this.zones = new Zone(this.boat, this.ocean);
        exp.addUpdate(4, () => this.zones.update());

        if (exp.audio) {
            exp.addUpdate(5, () => exp.audio.update(this.boat.speed, exp.controls.keys.boost));
        }

        this.floaters = new Floaters(this.ocean, this.boat);

        exp.addUpdate(7, () => {
            for (const island of this.islands) island.update();
        });

        this.ui = new UI();

        // Island deeds (micro-quests)
        this.interactables = new Interactables(this.boat);
        for (const island of this.islands) island.registerQuest(this.interactables);
    }
}
