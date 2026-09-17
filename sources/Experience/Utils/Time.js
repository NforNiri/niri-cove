import EventEmitter from './EventEmitter.js';

console.log('Time initialization');

export default class Time extends EventEmitter {
    constructor() {
        super();
        console.log('✅ Time initialized');

        // Setup
        this.start = performance.now();
        this.current = this.start;
        this.elapsed = 0;
        this.delta = 16;
    }

    update() {
        const currentTime = performance.now();
        this.delta = currentTime - this.current;
        this.current = currentTime;
        this.elapsed = this.current - this.start;

        this.emit('tick');
    }
}
