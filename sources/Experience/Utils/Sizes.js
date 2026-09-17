import EventEmitter from './EventEmitter.js';

console.log('Sizes initialization');

export default class Sizes extends EventEmitter {
    constructor() {
        super();
        console.log('✅ Sizes initialized');

        // Setup
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);

        // Resize event
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);

            this.emit('resize');
        });
    }
}
