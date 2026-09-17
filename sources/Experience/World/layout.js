/**
 * The archipelago map. Everything that needs to know where land is
 * (ocean shallows/foam, wave damping, zone triggers, teleport, minimap copy)
 * reads from here so the world stays consistent.
 *
 * Coordinates are world x/z. The lagoon spawn is at the origin.
 */
export const SPAWN = { x: 0, z: 4 };

// Pier geometry shared with IslandBase.buildDock: it starts 1.6 inside the
// shoreline and runs PIER_LENGTH toward the lagoon.
export const PIER_INSET = 1.6;
export const PIER_LENGTH = 8;
// Arrival trigger centre sits this far beyond the pier tip, on open water
const TRIGGER_OFFSET = 3.5;

const RAW_ISLANDS = [
    { id: 'about',    label: 'Home Cove',        subtitle: 'About',    x: 0,   z: -42, radius: 14, color: 0xF2E2B1 },
    { id: 'work',     label: 'The Shipyard',     subtitle: 'Work',     x: 44,  z: -12, radius: 15, color: 0xFF8C42 },
    { id: 'creative', label: 'Lantern Bay',      subtitle: 'Creative', x: 30,  z: 36,  radius: 13, color: 0xFFC46B },
    { id: 'resume',   label: 'Treasure Rock',    subtitle: 'Resume',   x: -31, z: 36,  radius: 13, color: 0xE3B341 },
    { id: 'contact',  label: 'Lighthouse Point', subtitle: 'Contact',  x: -44, z: -14, radius: 12, color: 0x5FD3C2 },
];

export const ISLANDS = RAW_ISLANDS.map((i) => {
    // Every pier faces the lagoon spawn
    const dx = SPAWN.x - i.x;
    const dz = SPAWN.z - i.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const tipR = i.radius - PIER_INSET + PIER_LENGTH;
    const triggerR = tipR + TRIGGER_OFFSET;
    return {
        ...i,
        dockDir: { x: ux, z: uz },
        pierTip: { x: i.x + ux * tipR, z: i.z + uz * tipR },
        // zone trigger centre (open water just past the pier)
        dock: { x: i.x + ux * triggerR, z: i.z + uz * triggerR },
        triggerRadius: 8,
        // where the chart menu drops the boat
        approach: { x: i.x + ux * (triggerR + 3), z: i.z + uz * (triggerR + 3) },
    };
});

// Sandbars and rocks: shallow colour + foam but no zone
export const SHOALS = [
    { x: 8, z: 62, radius: 6 },
    { x: -62, z: 14, radius: 5 },
    { x: 62, z: 16, radius: 5 },
    { x: -14, z: -68, radius: 6 },
    { x: 36, z: -50, radius: 4 },
];

/**
 * Signed distance from (x, z) to the nearest shoreline (negative = on land).
 */
export function shoreDistance(x, z) {
    let best = Infinity;
    for (const isl of ISLANDS) {
        const d = Math.hypot(x - isl.x, z - isl.z) - isl.radius;
        if (d < best) best = d;
    }
    for (const s of SHOALS) {
        const d = Math.hypot(x - s.x, z - s.z) - s.radius + 1.5;
        if (d < best) best = d;
    }
    return best;
}

/**
 * Waves flatten as water gets shallow. Used on both CPU and GPU.
 */
export function waveDamping(shoreDist) {
    const t = Math.min(Math.max(shoreDist / 9, 0), 1);
    const s = t * t * (3 - 2 * t);
    return 0.2 + 0.8 * s;
}

export function getIsland(id) {
    return ISLANDS.find((i) => i.id === id) || null;
}
