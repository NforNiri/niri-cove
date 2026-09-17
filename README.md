# Niri's Cove

A portfolio you can sail. Pilot a small ship across a calm Caribbean archipelago
and dock at five islands: Home Cove (about), The Shipyard (work), Lantern Bay
(creative), Treasure Rock (résumé) and Lighthouse Point (contact). Built with
Three.js, Rapier physics and Vite. Works on desktop (WASD) and phones (compass
joystick).

This is the pirate-themed successor to
[niri-frontier](https://github.com/NforNiri/niri-frontier); the two projects are
deployed separately.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve dist/
```

## How it is put together

```
sources/
  main.js                     entry, instantiates Experience
  Experience/
    Experience.js             singleton, priority-ordered update loop
    Renderer.js               HIGH/LOW quality tiers, bloom, adaptive downgrade
    Camera.js                 camera-controls follow + intro flyover
    Controls.js               keyboard + touch (compass joystick, wooden buttons)
    Physics.js                Rapier world, seabed, static island colliders
    Audio.js                  Howler, procedurally generated CC0 WAVs
    Vehicle/
      Boat.js                 4-point buoyancy sampled from the shared wave field
      BoatVisual.js           ship model, pennant shader, lantern, wake emitter
      Wake.js                 foam particle ring buffer
    World/
      waves.js                Gerstner waves, single source of truth (CPU + GLSL)
      Ocean.js                water shader: depth colour, Fresnel, glitter, foam
      Environment.js          sky dome, golden-hour lighting, day/night bias
      layout.js               island positions, docks, shoals, shore distance
      islands/                one builder per island on top of IslandBase
      Zone.js                 dock triggers + buoy markers
      Floaters.js             pushable barrels and collectible doubloons
      Shoals.js, Gulls.js     sandbars and ambient seagulls
    UI/                       parchment panels, chart menu, Captain's Log
static/
  models/pirate/              Kenney Pirate Kit (CC0) GLBs
  sounds/                     generated WAV sound set
```

Key rules:

- `vite.config.js` must keep `publicDir: 'static'` or models and sounds vanish in production.
- Wave maths lives only in `World/waves.js`; the ocean shader and buoyancy both read from it.
- `@swc/core` is pinned via `overrides` because newer versions break `vite-plugin-top-level-await`.

## Credits

- 3D assets: [Kenney Pirate Kit](https://kenney.nl/assets/pirate-kit) (CC0)
- Fonts: Pirata One, Cinzel, Nunito (Google Fonts)
