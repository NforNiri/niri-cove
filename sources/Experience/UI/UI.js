import Experience from '../Experience.js';
import Panel from './Panel.js';
import GameMenu from './GameMenu.js';
import { getContent } from './panels/index.js';

export default class UI {
    constructor() {
        this.experience = Experience.getInstance();
        this.panel = new Panel();
        this.gameMenu = new GameMenu(this);
        this.exitTimeout = null;

        this.experience.on('zone:enter', (zoneId) => this.onZoneEnter(zoneId));
        this.experience.on('zone:exit', (zoneId) => this.onZoneExit(zoneId));
    }

    onZoneEnter(zoneId) {
        if (this.exitTimeout) {
            clearTimeout(this.exitTimeout);
            this.exitTimeout = null;
        }
        const content = getContent(zoneId);
        if (content) this.panel.show(zoneId, content);
    }

    onZoneExit() {
        // Small delay so brushing past a buoy doesn't flicker the panel
        this.exitTimeout = setTimeout(() => {
            this.panel.hide();
            this.exitTimeout = null;
        }, 600);
    }

    /** Open a non-zone panel (e.g. the Captain's Log from the menu). */
    openStatic(id) {
        const content = getContent(id);
        if (content) this.panel.show(id, content);
    }
}
