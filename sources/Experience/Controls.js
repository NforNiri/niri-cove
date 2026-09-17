import Experience from './Experience.js';

export default class Controls {
    constructor() {
        this.experience = Experience.getInstance();

        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            boost: false,
            brake: false
        };

        // Analog steering/throttle (-1..1) from the joystick; keyboard fills ±1
        this.axis = { x: 0, y: 0 };

        // While true (intro tour) the boat ignores input
        this.locked = false;
        // One-shot interact press (E / act button), consumed by Interactables
        this.interactQueued = false;

        this.isMobile = this.detectMobile();

        this.setKeyboard();
        if (this.isMobile) {
            this.setupTouchControls();
        }
    }

    detectMobile() {
        // A touchscreen alone is not "mobile": Windows laptops with touch and a
        // mouse should keep WASD. Require a coarse primary pointer or a mobile UA.
        const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        return (
            /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            (coarse && navigator.maxTouchPoints > 0) ||
            window.innerWidth < 768
        );
    }

    setKeyboard() {
        window.addEventListener('keydown', (event) => this.handleKey(event, true));
        window.addEventListener('keyup', (event) => this.handleKey(event, false));
    }

    handleKey(event, isPressed) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.forward = isPressed;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.backward = isPressed;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = isPressed;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = isPressed;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.boost = isPressed;
                break;
            case 'Space':
                event.preventDefault();
                this.keys.brake = isPressed;
                break;
            case 'KeyM':
                if (isPressed && this.experience.audio) {
                    this.experience.audio.toggleMute();
                }
                break;
            case 'KeyE':
                if (isPressed && !event.repeat) this.interactQueued = true;
                break;
        }
        this.syncAxisFromKeys();
    }

    /** Returns true once per interact press. */
    consumeInteract() {
        if (!this.interactQueued) return false;
        this.interactQueued = false;
        return true;
    }

    /** Mobile: show the act button only while something can be done. */
    setActVisible(visible) {
        if (this.actBtn) this.actBtn.classList.toggle('is-visible', visible);
    }

    syncAxisFromKeys() {
        this.axis.x = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
        this.axis.y = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    }

    // =============================================
    // MOBILE TOUCH CONTROLS — compass joystick + two wooden buttons
    // =============================================
    setupTouchControls() {
        this.touchContainer = document.createElement('div');
        this.touchContainer.id = 'touch-controls';
        this.touchContainer.innerHTML = `
            <div class="joystick-zone" id="joystick-zone">
                <div class="joystick-base" id="joystick-base">
                    <span class="compass-n">N</span>
                    <div class="joystick-knob" id="joystick-knob"></div>
                </div>
            </div>
            <div class="action-zone" id="action-zone">
                <button class="touch-btn act-btn" id="act-btn" aria-label="Act">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 5.4 5.8.5-4.4 3.8 1.3 5.7L12 15.4l-4.9 3 1.3-5.7L4 8.9l5.8-.5z"/></svg>
                </button>
                <button class="touch-btn boost-btn" id="boost-btn" aria-label="Full sail">
                    <svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 20h12M12 3v15M12 4c5 1 7 6 7 10H12z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                </button>
                <button class="touch-btn brake-btn" id="brake-btn" aria-label="Drop anchor">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13c0 4 3 7 7 7s7-3 7-7M8 11h8"/></svg>
                </button>
            </div>
        `;
        document.body.appendChild(this.touchContainer);

        this.injectTouchCSS();
        this.initJoystick();
        this.initActionButtons();
    }

    injectTouchCSS() {
        const style = document.createElement('style');
        style.textContent = `
            #touch-controls {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 38vh;
                z-index: 100;
                pointer-events: none;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                padding: 20px 26px calc(20px + env(safe-area-inset-bottom));
            }

            .joystick-zone {
                width: 150px;
                height: 150px;
                position: relative;
                pointer-events: auto;
                touch-action: none;
            }

            .joystick-base {
                width: 128px;
                height: 128px;
                border-radius: 50%;
                position: absolute;
                bottom: 10px;
                left: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                background:
                    radial-gradient(circle at 50% 50%, rgba(234,216,177,0.18) 0 38%, transparent 40%),
                    radial-gradient(circle, rgba(15,61,62,0.55), rgba(15,61,62,0.75));
                border: 3px solid rgba(234,216,177,0.55);
                box-shadow: inset 0 0 0 6px rgba(139,90,43,0.45), 0 6px 18px rgba(0,0,0,0.35);
            }

            .compass-n {
                position: absolute;
                top: 8px;
                font-family: 'Cinzel', serif;
                font-size: 11px;
                font-weight: 700;
                color: rgba(234,216,177,0.8);
                letter-spacing: 1px;
            }

            .joystick-knob {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: radial-gradient(circle at 35% 30%, #F2E2B1, #C9A46A 60%, #8B5A2B);
                border: 2px solid rgba(139,90,43,0.9);
                position: absolute;
                transition: none;
                box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            }

            .action-zone {
                display: flex;
                flex-direction: column;
                gap: 14px;
                pointer-events: auto;
                padding-bottom: 10px;
            }

            .touch-btn {
                width: 72px;
                height: 72px;
                border-radius: 50%;
                border: 3px solid rgba(234,216,177,0.55);
                background: radial-gradient(circle at 40% 35%, rgba(139,90,43,0.85), rgba(70,42,18,0.9));
                color: #EAD8B1;
                display: flex;
                align-items: center;
                justify-content: center;
                touch-action: none;
                -webkit-user-select: none;
                user-select: none;
                cursor: pointer;
                box-shadow: 0 6px 16px rgba(0,0,0,0.35);
                transition: transform 0.1s ease;
            }

            .touch-btn:active, .touch-btn.active {
                transform: scale(0.94);
                border-color: #FF8C42;
                color: #FFF3DC;
                box-shadow: 0 0 18px rgba(255,140,66,0.45);
            }

            .brake-btn:active, .brake-btn.active {
                border-color: #5FD3C2;
                box-shadow: 0 0 18px rgba(95,211,194,0.45);
            }

            .act-btn {
                display: none;
                border-color: #E3B341;
                color: #F6ECD4;
                box-shadow: 0 0 18px rgba(227,179,65,0.45);
                animation: act-glow 1.6s ease-in-out infinite;
            }
            .act-btn.is-visible { display: flex; }
            @keyframes act-glow {
                0%, 100% { box-shadow: 0 0 10px rgba(227,179,65,0.35); }
                50% { box-shadow: 0 0 24px rgba(227,179,65,0.75); }
            }

            @media (min-width: 769px) and (hover: hover) {
                #touch-controls { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    initJoystick() {
        const zone = document.getElementById('joystick-zone');
        const base = document.getElementById('joystick-base');
        const knob = document.getElementById('joystick-knob');

        let active = false;
        const maxDist = 42;
        const deadZone = 8;

        const getCenter = () => {
            const rect = base.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        };

        const handleMove = (clientX, clientY) => {
            const center = getCenter();
            let dx = clientX - center.x;
            let dy = clientY - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > maxDist) {
                dx = dx / dist * maxDist;
                dy = dy / dist * maxDist;
            }

            knob.style.transform = `translate(${dx}px, ${dy}px)`;

            if (dist < deadZone) {
                this.axis.x = 0;
                this.axis.y = 0;
                this.keys.forward = this.keys.backward = this.keys.left = this.keys.right = false;
                return;
            }

            const nx = dx / maxDist;
            const ny = -dy / maxDist;
            this.axis.x = nx;
            this.axis.y = ny;

            this.keys.forward = ny > 0.25;
            this.keys.backward = ny < -0.25;
            this.keys.left = nx < -0.3;
            this.keys.right = nx > 0.3;
        };

        const handleEnd = () => {
            active = false;
            knob.style.transform = 'translate(0, 0)';
            this.axis.x = 0;
            this.axis.y = 0;
            this.keys.forward = this.keys.backward = this.keys.left = this.keys.right = false;
        };

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            active = true;
            const t = e.touches[0];
            handleMove(t.clientX, t.clientY);
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!active) return;
            const t = e.touches[0];
            handleMove(t.clientX, t.clientY);
        }, { passive: false });

        zone.addEventListener('touchend', (e) => { e.preventDefault(); handleEnd(); }, { passive: false });
        zone.addEventListener('touchcancel', handleEnd);
    }

    initActionButtons() {
        const bind = (btn, key) => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[key] = true;
                btn.classList.add('active');
            }, { passive: false });
            const release = (e) => {
                e.preventDefault();
                this.keys[key] = false;
                btn.classList.remove('active');
            };
            btn.addEventListener('touchend', release, { passive: false });
            btn.addEventListener('touchcancel', release, { passive: false });
        };

        bind(document.getElementById('boost-btn'), 'boost');
        bind(document.getElementById('brake-btn'), 'brake');

        this.actBtn = document.getElementById('act-btn');
        this.actBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.interactQueued = true;
            this.actBtn.classList.add('active');
        }, { passive: false });
        const releaseAct = (e) => { e.preventDefault(); this.actBtn.classList.remove('active'); };
        this.actBtn.addEventListener('touchend', releaseAct, { passive: false });
        this.actBtn.addEventListener('touchcancel', releaseAct, { passive: false });
    }
}
