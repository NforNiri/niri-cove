import gsap from 'gsap';
import Experience from './Experience.js';

export default class LoadingScreen {
    constructor() {
        this.experience = Experience.getInstance();
        this.resources = this.experience.resources;
        this.camera = this.experience.camera;

        this.overlay = document.getElementById('loading-screen');
        this.barFill = this.overlay.querySelector('.loading-bar-fill');
        this.subtitle = this.overlay.querySelector('.loading-subtitle');
        this.launchBtn = this.overlay.querySelector('.loading-launch');

        this.resources.on('progress', () => this.updateProgress());
        this.resources.on('ready', () => this.onReady());

        this.launchBtn.addEventListener('click', () => this.launch());
    }

    updateProgress() {
        const percent = (this.resources.loaded / this.resources.toLoad) * 100;
        this.barFill.style.width = `${percent}%`;
        this.subtitle.textContent = `Loading the fleet... ${Math.round(percent)}%`;
    }

    onReady() {
        this.barFill.style.width = '100%';
        this.subtitle.textContent = 'Fair winds. The tide is right.';

        gsap.set(this.launchBtn, { display: 'inline-block', opacity: 0, y: 10 });
        gsap.to(this.launchBtn, { opacity: 1, y: 0, duration: 0.6, delay: 0.4, ease: 'power2.out' });
    }

    launch() {
        this.launchBtn.style.pointerEvents = 'none';

        // First user gesture unlocks the audio context
        if (this.experience.audio) {
            this.experience.audio.start();
        }
        if (this.experience.controls) this.experience.controls.locked = true;
        document.body.classList.add('intro-active');

        this.buildIntroOverlay();

        // The loading "parchment" rolls up from top and bottom to reveal the sea
        const content = this.overlay.querySelector('.loading-content');
        gsap.to(content, { opacity: 0, scale: 0.94, duration: 0.5, ease: 'power2.in' });
        gsap.set(this.overlay, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.to(this.overlay, {
            clipPath: 'inset(50% 0% 50% 0%)',
            duration: 1.3,
            delay: 0.35,
            ease: 'power3.inOut',
            onComplete: () => this.overlay.remove()
        });

        this.camera.cinematicFlyover({ onDone: () => this.onIntroDone() });
        this.experience.emit('launched');

        // Title card over the establishing shot
        const title = this.intro.querySelector('.intro-title');
        const eyebrow = this.intro.querySelector('.intro-eyebrow');
        const byline = this.intro.querySelector('.intro-byline');
        const skip = this.intro.querySelector('.intro-skip');
        gsap.set([title, eyebrow, byline], { opacity: 0, y: 14 });
        gsap.to(eyebrow, { opacity: 1, y: 0, duration: 0.8, delay: 0.9, ease: 'power2.out' });
        gsap.to(title, { opacity: 1, y: 0, duration: 1.1, delay: 1.1, ease: 'power2.out' });
        gsap.to(byline, { opacity: 1, y: 0, duration: 0.8, delay: 1.5, ease: 'power2.out' });
        gsap.to([title, eyebrow, byline], { opacity: 0, y: -10, duration: 0.9, delay: 4.6, ease: 'power2.in' });
        gsap.fromTo(skip, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 1.6 });

        // Let the flyover settle before judging the frame budget
        setTimeout(() => this.experience.renderer.startAdaptiveQuality(), 16000);
    }

    buildIntroOverlay() {
        this.intro = document.createElement('div');
        this.intro.id = 'intro-overlay';
        this.intro.innerHTML = `
            <div class="intro-vignette"></div>
            <div class="intro-card">
                <p class="intro-eyebrow">A portfolio you can sail</p>
                <h1 class="intro-title">Niri's Cove</h1>
                <p class="intro-byline">Niri Levy &mdash; Head of Creative &amp; PMO</p>
            </div>
            <button class="intro-skip" type="button">Skip the tour <span>&#9656;</span></button>
        `;
        document.body.appendChild(this.intro);

        const skip = () => this.camera.skipCinematic();
        this.intro.querySelector('.intro-skip').addEventListener('click', skip);
        this._onKey = (e) => {
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') skip();
        };
        window.addEventListener('keydown', this._onKey);
        // Any tap on the water skips too (touch devices have no keyboard)
        this._onTap = () => skip();
        this.experience.canvas.addEventListener('pointerdown', this._onTap, { once: true });
    }

    onIntroDone() {
        if (this.experience.controls) this.experience.controls.locked = false;
        document.body.classList.remove('intro-active');
        window.removeEventListener('keydown', this._onKey);
        this.experience.canvas.removeEventListener('pointerdown', this._onTap);
        if (!this.intro) return;
        gsap.to(this.intro, {
            opacity: 0,
            duration: 1.2,
            ease: 'power2.inOut',
            onComplete: () => { this.intro.remove(); this.intro = null; },
        });
    }
}
