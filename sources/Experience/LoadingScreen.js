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

        gsap.to(this.overlay, {
            opacity: 0,
            duration: 1.1,
            ease: 'power2.inOut',
            onComplete: () => this.overlay.remove()
        });

        // First user gesture unlocks the audio context
        if (this.experience.audio) {
            this.experience.audio.start();
        }

        this.camera.cinematicFlyover();
        this.experience.emit('launched');

        // Let the flyover settle before judging the frame budget
        setTimeout(() => this.experience.renderer.startAdaptiveQuality(), 5500);
    }
}
