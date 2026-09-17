import * as THREE from 'three';
import Experience from '../Experience.js';
import { cloneModel } from '../Utils/models.js';
import { SHOALS } from './layout.js';
import { KIT_SCALE } from './islands/IslandBase.js';

const SAND = new THREE.Color(0xE6CF9C);
const SAND_WET = new THREE.Color(0xC4A26C);
const ROCK_MODELS = ['rocks-a', 'rocks-b', 'rocks-c', 'rocks-sand-a', 'rocks-sand-b'];

/**
 * Small sandbars between the islands: a low sand disc barely above the swell
 * with a rock or two, so the shallows/foam painted by the ocean shader have
 * something real to wrap around. They are obstacles for the boat.
 */
export default class Shoals {
    constructor() {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.physics = this.experience.physics;
        this.resources = this.experience.resources;

        this.group = new THREE.Group();
        this.group.name = 'shoals';
        this.scene.add(this.group);

        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });

        SHOALS.forEach((s, idx) => {
            const geo = this.discGeometry(s.radius, idx);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(s.x, 0, s.z);
            mesh.receiveShadow = true;
            this.group.add(mesh);

            const rocks = 1 + (idx % 2);
            for (let i = 0; i < rocks; i++) {
                const name = ROCK_MODELS[(idx * 3 + i * 5) % ROCK_MODELS.length];
                const rock = cloneModel(this.resources, name);
                if (!rock) continue;
                const a = idx * 1.7 + i * 2.4;
                const d = s.radius * (0.15 + i * 0.3);
                rock.scale.setScalar(KIT_SCALE * (0.9 + (i % 2) * 0.4));
                rock.position.set(s.x + Math.cos(a) * d, 0.18, s.z + Math.sin(a) * d);
                rock.rotation.y = a * 2.3;
                this.group.add(rock);
            }

            this.physics.addStaticShapes([
                { type: 'cylinder', pos: [s.x, -0.6, s.z], size: [s.radius * 0.8, 1.6] },
            ]);
        });
    }

    /** Low-poly lens: sand hump in the middle, sinking below the water at the rim. */
    discGeometry(radius, seed) {
        const rings = 6;
        const segments = 24;
        const positions = [];
        const colors = [];
        const indices = [];
        const skirt = 2.5;
        const c = new THREE.Color();

        for (let ri = 0; ri <= rings; ri++) {
            const t = ri / rings;
            for (let si = 0; si <= segments; si++) {
                const a = (si / segments) * Math.PI * 2;
                const wobble = 1 + 0.12 * Math.sin(3 * a + seed) + 0.06 * Math.sin(5 * a - seed);
                const d = t * (radius * wobble + skirt);
                const over = d - radius * wobble;
                const y = over <= 0
                    ? 0.32 * (1 - (d / (radius * wobble)) ** 2) + 0.16
                    : 0.16 - over * 0.9;
                positions.push(Math.cos(a) * d, y, Math.sin(a) * d);
                c.copy(SAND_WET).lerp(SAND, THREE.MathUtils.smoothstep(y, 0.0, 0.42));
                colors.push(c.r, c.g, c.b);
            }
        }
        for (let ri = 0; ri < rings; ri++) {
            for (let si = 0; si < segments; si++) {
                const a = ri * (segments + 1) + si;
                const b = a + segments + 1;
                indices.push(a, a + 1, b);
                indices.push(b, a + 1, b + 1);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }
}
