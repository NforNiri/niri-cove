/**
 * Behind-the-scenes notes, shown from the chart menu rather than an island.
 */
export default {
    title: "Captain's Log",
    kicker: 'How this cove was built',
    html: `
        <div class="panel-section">
            <p>You're sailing through a hand-built 3D world. No templates, no page builders: code, physics, shaders and a fondness for calm water.</p>
        </div>

        <div class="panel-section">
            <h4>Rigging</h4>
            <div class="panel-tags">
                <span class="tag">Three.js</span>
                <span class="tag">Rapier 3D (WASM)</span>
                <span class="tag">GLSL</span>
                <span class="tag">Vite</span>
                <span class="tag">GSAP</span>
                <span class="tag">Howler.js</span>
            </div>
        </div>

        <div class="panel-section">
            <h4>The water</h4>
            <p>The sea is a sum of four Gerstner waves evaluated in a vertex shader. The very same wave function runs on the CPU to float the boat, the barrels and the buoys, so what you see is what you sail on. Foam and shallows come from a baked distance-to-shore field; waves flatten as they reach the sand.</p>
        </div>

        <div class="panel-section">
            <h4>The boat</h4>
            <p>Four buoyancy springs (bow, stern, port, starboard) push the hull up wherever it sits below the surface, so it pitches and rolls with the swell. Steering is a rudder: it only bites when water is flowing past it.</p>
        </div>

        <div class="panel-section">
            <h4>Crew</h4>
            <div class="panel-tags">
                <span class="tag">Claude</span>
                <span class="tag">Cursor</span>
                <span class="tag">Kenney Pirate Kit (CC0)</span>
            </div>
            <p class="panel-footnote-inline">AI helped write and debug; every system was reviewed, tuned and sailed by hand.</p>
        </div>

        <div class="panel-stats">
            <div class="stat-item">
                <span class="stat-number">5</span>
                <span class="stat-label">Islands</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">4</span>
                <span class="stat-label">Waves summed</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">50</span>
                <span class="stat-label">Kit models</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">8</span>
                <span class="stat-label">Doubloons hidden</span>
            </div>
        </div>

        <div class="panel-section">
            <p class="panel-quote">"A portfolio should be somewhere you want to spend time."</p>
        </div>
    `,
};
