import gsap from 'gsap';
import Experience from '../Experience.js';

/**
 * Proximity actions. Islands register a spot (usually their dock water) with a
 * label and an action; when the boat is inside the radius a prompt appears and
 * E / the act button runs it. Completed quests are written to Progress.
 */
export default class Interactables {
    constructor(boat) {
        this.experience = Experience.getInstance();
        this.controls = this.experience.controls;
        this.progress = this.experience.progress;
        this.boat = boat;

        this.items = [];
        this.active = null;
        this.busy = false;

        this.createPrompt();
        this.experience.addUpdate(6, () => this.update());
    }

    createPrompt() {
        this.prompt = document.createElement('div');
        this.prompt.id = 'interact-prompt';
        this.prompt.className = 'parchment';
        this.prompt.innerHTML = `<kbd>E</kbd><span class="interact-label"></span>`;
        document.body.appendChild(this.prompt);
        gsap.set(this.prompt, { opacity: 0, y: 10 });
        this.prompt.addEventListener('click', () => this.trigger());
    }

    /**
     * @param {{id:string, x:number, z:number, radius?:number, label:string, action:Function, quest?:boolean, repeatLabel?:string}} item
     */
    add(item) {
        const entry = { radius: 9, quest: true, ...item };
        entry.done = entry.quest ? this.progress.hasQuest(entry.id) : false;
        this.items.push(entry);
        return entry;
    }

    showPrompt(item) {
        const label = item.done && item.repeatLabel ? item.repeatLabel : item.label;
        this.prompt.querySelector('.interact-label').textContent = label;
        this.prompt.classList.toggle('is-done', item.done);
        gsap.killTweensOf(this.prompt);
        gsap.to(this.prompt, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
        if (this.controls.setActVisible) this.controls.setActVisible(true);
        this.experience.emit('quest:prompt', true);
    }

    hidePrompt() {
        gsap.killTweensOf(this.prompt);
        gsap.to(this.prompt, { opacity: 0, y: 10, duration: 0.25, ease: 'power2.in' });
        if (this.controls.setActVisible) this.controls.setActVisible(false);
        this.experience.emit('quest:prompt', false);
    }

    update() {
        if (!this.boat || !this.boat.rigidBody || this.controls.locked) return;
        const p = this.boat.getPosition();

        let best = null;
        let bestD = Infinity;
        for (const it of this.items) {
            if (it.done && !it.repeatLabel) continue;
            const d = Math.hypot(p.x - it.x, p.z - it.z);
            if (d < it.radius && d < bestD) { bestD = d; best = it; }
        }

        if (best !== this.active) {
            this.active = best;
            if (best) this.showPrompt(best);
            else this.hidePrompt();
        }

        if (this.active && this.controls.consumeInteract()) this.trigger();
    }

    async trigger() {
        const it = this.active;
        if (!it || this.busy) return;
        this.busy = true;
        this.experience.emit('quest:interact', it.id);
        try {
            await it.action(it.done);
        } catch (e) {
            console.warn('[Interactable]', it.id, e);
        }
        if (!it.done && it.quest) {
            it.done = true;
            this.progress.completeQuest(it.id);
            const audio = this.experience.audio;
            if (audio) setTimeout(() => audio.playQuest(), 250);
            const ui = this.experience.world ? this.experience.world.ui : null;
            if (ui) ui.toast(`DEED DONE — ${it.label.toUpperCase()}`, 2800);
            const cam = this.experience.camera;
            if (cam) cam.addShake(0.25);
        }
        this.busy = false;
        // Refresh the prompt (repeatable or gone) only if we are still there
        if (this.active !== it) return;
        if (it.done && !it.repeatLabel) { this.active = null; this.hidePrompt(); }
        else this.showPrompt(it);
    }
}
