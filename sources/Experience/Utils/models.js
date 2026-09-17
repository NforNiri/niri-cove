import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/**
 * Clone a loaded GLTF scene. Materials are shared by default (Kenney models all
 * use one colormap) which keeps draw-call state changes low. Pass
 * `uniqueMaterial: true` when a clone needs its own tint.
 */
export function cloneModel(resources, name, { scale = 1, shadows = true, uniqueMaterial = false } = {}) {
    const gltf = resources.items[name];
    if (!gltf || !gltf.scene) {
        console.warn(`Model missing: ${name}`);
        return null;
    }

    const clone = gltf.scene.clone(true);
    clone.scale.setScalar(scale);
    clone.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = shadows;
        child.receiveShadow = shadows;
        if (uniqueMaterial) {
            child.material = Array.isArray(child.material)
                ? child.material.map((m) => m.clone())
                : child.material.clone();
        }
    });
    return clone;
}

/** World-space bounding box size of an object. */
export function measure(object) {
    _box.setFromObject(object);
    return _box.getSize(_size).clone();
}

/** Bounding box (world space) — returned object is reused, copy if you keep it. */
export function bounds(object) {
    return _box.setFromObject(object);
}

/**
 * Scale an object so its largest XZ footprint dimension equals `length`, and
 * drop it so its lowest point sits at local y = `floorY`.
 */
export function fitFootprint(object, length, floorY = 0) {
    object.updateMatrixWorld(true);
    const size = measure(object);
    const current = Math.max(size.x, size.z);
    if (current > 0) {
        const s = length / current;
        object.scale.multiplyScalar(s);
    }
    object.updateMatrixWorld(true);
    const b = bounds(object);
    object.position.y += floorY - b.min.y;
    // Centre horizontally on the object's own origin
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    object.position.x -= cx;
    object.position.z -= cz;
    return object;
}
