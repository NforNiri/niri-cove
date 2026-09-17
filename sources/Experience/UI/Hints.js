import gsap from 'gsap';
import Experience from '../Experience.js';

/**
 * Contextual onboarding. One hint at a time, each dismissed by doing the thing
 * (not by a timer), so nobody is nagged about a control they already used.
 */
export default class Hints {
    constructor(ui) {
        this.experience = Experience.getInstance();
        this.ui = ui;
        this.mobile = this.experience.controls ? this.experience.controls.isMobile : false;
        this.current = null;
        this.queue = [];
        this.startPos = null;
        this.active = false;

        this.createElement();

        this.experience.on('intro:done', () => this.begin());
        this.experience.on('zone:enter', () => this.satisfy('compass'));
        this.experience.on('quest:interact', () => this.satisfy('interact'));
        // The interact prompt is self-explanatory (it shows the key); only hint on
        // touch, where the act button is new
        this.experience.on('quest:prompt', (visible) => { if (visible && this.mobile) this.pushOnce('interact'); });

        this.experience.addUpdate(9, () => this.update());
    }

    createElement() {
        this.el = document.createElement('div');
        this.el.id = 'hint-bar';
        this.el.className = 'parchment';
        this.el.innerHTML = `<span class="hint-keys"></span><span class="hint-text"></span>`;
        document.body.appendChild(this.el);
        gsap.set(this.el, { opacity: 0, y: 14 });
    }

    hints() {
        const m = this.mobile;
        return {
            sail:     { keys: m ? '' : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', text: m ? 'Drag the compass to sail' : 'Sail the boat' },
            boost:    { keys: m ? '' : '<kbd>Shift</kbd>', text: m ? 'Hold the sail button for full sail' : 'Hold for full sail' },
            compass:  { keys: '', text: 'Follow the red needle on the chart to Home Cove' },
            interact: { keys: m ? '' : '<kbd>E</kbd>', text: m ? 'Tap the glowing button to act' : 'Act when a marker glows' },
            chart:    { keys: m ? '' : '<kbd>C</kbd>', text: m ? 'Tap the chart to open the treasure map' : 'Open the treasure map' },
        };
    }

    begin() {
        this.active = true;
        const world = this.experience.world;
        this.startPos = world && world.boat ? { ...world.boat.getPosition() } : null;
        this.queue = ['sail', 'boost', 'compass'];
        this.shown = new Set(this.queue);
        this.next();
    }

    pushOnce(id) {
        if (!this.active || this.shown.has(id)) return;
        this.shown.add(id);
        // Interact hint jumps the queue: it is relevant right now
        this.queue.unshift(id);
        if (!this.current) this.next();
        else if (this.current !== id) this.show(id);
    }

    next() {
        const id = this.queue.shift();
        if (!id) { this.hide(); return; }
        this.show(id);
    }

    show(id) {
        const h = this.hints()[id];
        if (!h) return;
        this.current = id;
        this.el.querySelector('.hint-keys').innerHTML = h.keys;
        this.el.querySelector('.hint-text').textContent = h.text;
        gsap.killTweensOf(this.el);
        gsap.to(this.el, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    }

    hide() {
        this.current = null;
        gsap.killTweensOf(this.el);
        gsap.to(this.el, { opacity: 0, y: 14, duration: 0.35, ease: 'power2.in' });
    }

    satisfy(id) {
        this.queue = this.queue.filter((k) => k !== id);
        if (this.current === id) {
            gsap.to(this.el, { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' });
            setTimeout(() => { if (this.current === id) this.next(); }, 500);
        }
    }

    update() {
        if (!this.active || !this.current) return;
        const world = this.experience.world;
        const boat = world ? world.boat : null;
        const controls = this.experience.controls;
        if (!boat || !controls) return;

        if (this.current === 'sail' && this.startPos) {
            const p = boat.getPosition();
            if (Math.hypot(p.x - this.startPos.x, p.z - this.startPos.z) > 4) this.satisfy('sail');
        } else if (this.current === 'boost') {
            if (controls.keys.boost && boat.forwardSpeed > 1) this.satisfy('boost');
        }
    }
}
