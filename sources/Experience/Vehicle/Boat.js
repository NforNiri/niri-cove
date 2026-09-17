import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import Experience from '../Experience.js';
import { SPAWN } from '../World/layout.js';

/**
 * Physical boat: a Rapier dynamic body kept afloat by four buoyancy springs
 * sampled from the shared wave field, so the hull pitches and rolls with the
 * same swell the player sees.
 */
export default class Boat {
    constructor(ocean) {
        this.experience = Experience.getInstance();
        this.physics = this.experience.physics;
        this.world = this.physics.world;
        this.ocean = ocean;

        this.params = {
            mass: 200,
            // Hull half extents (x, y, z) — matched to the scaled ship-small model
            hull: { x: 1.1, y: 0.45, z: 2.1 },
            forwardForce: 780,
            backwardForce: 340,
            boostMultiplier: 1.6,
            maxSpeed: 7.5,
            boostSpeed: 11.5,
            brakeForce: 1400,
            steerStrength: 1.15,
            lateralGrip: 4.5,
            linearDamping: 0.55,
            angularDamping: 2.2,
            // Buoyancy per sample point
            buoyancyK: 2400,
            buoyancyDamping: 420,
            // How deep the hull sits at rest (positive = below the surface)
            draft: 0.28,
        };

        // Local-space buoyancy sample points: bow, stern, port, starboard
        this.samplePoints = [
            new THREE.Vector3(0, 0, -1.7),
            new THREE.Vector3(0, 0, 1.7),
            new THREE.Vector3(-0.85, 0, 0.1),
            new THREE.Vector3(0.85, 0, 0.1),
        ];

        this._q = new THREE.Quaternion();
        this._v = new THREE.Vector3();
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._worldPoint = new THREE.Vector3();
        this._angVel = new THREE.Vector3();
        this._rel = new THREE.Vector3();

        this.speed = 0;
        this.forwardSpeed = 0;
        this.turnRate = 0;
        // World-space heading (unit, XZ plane), read by the camera and effects
        this.forward = new THREE.Vector3(0, 0, -1);
        this.wasBoosting = false;
        this.wasBraking = false;

        this.createBody();
    }

    createBody() {
        const p = this.params;
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(SPAWN.x, 0.2, SPAWN.z)
            .setAdditionalMass(p.mass)
            .setLinearDamping(p.linearDamping)
            .setAngularDamping(p.angularDamping)
            .setDominanceGroup(10)
            .setCcdEnabled(true);

        this.rigidBody = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(p.hull.x, p.hull.y, p.hull.z)
            .setFriction(0.2)
            .setRestitution(0.05);
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);
    }

    getPosition() {
        return this.rigidBody ? this.rigidBody.translation() : { x: 0, y: 0, z: 0 };
    }

    getQuaternion() {
        return this.rigidBody ? this.rigidBody.rotation() : { x: 0, y: 0, z: 0, w: 1 };
    }

    /** Teleport helper used by the chart menu. Faces the given yaw (radians). */
    reset(x, z, yaw = 0) {
        const rb = this.rigidBody;
        rb.resetForces(true);
        rb.resetTorques(true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        rb.setTranslation({ x, y: 0.2, z }, true);
        rb.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
        rb.wakeUp();
    }

    update(controls, deltaMs) {
        const rb = this.rigidBody;
        if (!rb || !this.ocean) return;

        // Rapier user forces persist between steps; start every frame clean
        rb.resetForces(true);
        rb.resetTorques(true);

        const p = this.params;
        const pos = rb.translation();
        const rot = rb.rotation();
        const vel = rb.linvel();
        const angvel = rb.angvel();

        this._q.set(rot.x, rot.y, rot.z, rot.w);
        const forward = this._forward.set(0, 0, -1).applyQuaternion(this._q);
        forward.y = 0;
        forward.normalize();
        this.forward.copy(forward);
        const right = this._right.set(forward.z, 0, -forward.x);

        // Intro tour: no input, the boat just rides the swell
        const locked = !!controls.locked;
        const keys = locked ? { forward: false, backward: false, left: false, right: false, boost: false, brake: false } : controls.keys;
        const axis = locked ? null : controls.axis;

        this.speed = Math.hypot(vel.x, vel.z);
        this.forwardSpeed = vel.x * forward.x + vel.z * forward.z;
        const lateralSpeed = vel.x * right.x + vel.z * right.z;

        // ── Buoyancy ──────────────────────────────────────────────────────
        this._angVel.set(angvel.x, angvel.y, angvel.z);
        for (const local of this.samplePoints) {
            const wp = this._worldPoint.copy(local).applyQuaternion(this._q);
            const rel = this._rel.copy(wp);
            wp.add(pos);

            const waterY = this.ocean.getHeight(wp.x, wp.z);
            // Positive when this corner is below its resting waterline
            const depth = (waterY - wp.y) + p.draft;

            if (depth > -0.6) {
                // Vertical velocity of this corner: v + ω × r
                const pointVy = vel.y + (this._angVel.z * rel.x - this._angVel.x * rel.z);
                const spring = Math.max(depth, -0.15) * p.buoyancyK;
                const damping = -pointVy * p.buoyancyDamping;
                const f = spring + damping;
                rb.addForceAtPoint({ x: 0, y: f, z: 0 }, { x: wp.x, y: wp.y, z: wp.z }, true);
            }
        }

        // ── Propulsion ────────────────────────────────────────────────────
        const throttle = axis ? axis.y : ((keys.forward ? 1 : 0) - (keys.backward ? 1 : 0));
        const boosting = keys.boost && throttle > 0;
        const maxSpeed = boosting ? p.boostSpeed : p.maxSpeed;
        const speedRatio = Math.min(Math.abs(this.forwardSpeed) / maxSpeed, 1);
        const taper = 1 - speedRatio * 0.8;

        let thrust = 0;
        if (throttle > 0) thrust = p.forwardForce * throttle * (boosting ? p.boostMultiplier : 1) * taper;
        else if (throttle < 0) thrust = p.backwardForce * throttle * taper;

        if (thrust !== 0) {
            rb.addForce({ x: forward.x * thrust, y: 0, z: forward.z * thrust }, true);
        }

        // Hull resists sideways slip (keeps turns from feeling like ice)
        const grip = -lateralSpeed * p.lateralGrip * p.mass * 0.15;
        rb.addForce({ x: right.x * grip, y: 0, z: right.z * grip }, true);

        // ── Anchor / brake ────────────────────────────────────────────────
        if (keys.brake && this.speed > 0.25) {
            const bf = p.brakeForce / this.speed;
            rb.addForce({ x: -vel.x * bf, y: 0, z: -vel.z * bf }, true);
        }

        // ── Steering (yaw only; leave pitch/roll to the waves) ────────────
        const steer = axis ? axis.x : ((keys.right ? 1 : 0) - (keys.left ? 1 : 0));
        // Rudder needs water flowing past it
        const rudderAuthority = THREE.MathUtils.clamp(Math.abs(this.forwardSpeed) / 2.5, 0.2, 1);
        const direction = this.forwardSpeed < -0.3 ? 1 : -1;
        const targetYaw = steer * p.steerStrength * rudderAuthority * direction;
        const newYaw = angvel.y + (targetYaw - angvel.y) * 0.08;
        rb.setAngvel({ x: angvel.x, y: newYaw, z: angvel.z }, true);
        this.turnRate = newYaw;

        // ── Speed clamp ───────────────────────────────────────────────────
        if (this.speed > maxSpeed) {
            const s = maxSpeed / this.speed;
            rb.setLinvel({ x: vel.x * s, y: vel.y, z: vel.z * s }, true);
        }

        // ── One-shot audio cues ───────────────────────────────────────────
        const audio = this.experience.audio;
        const camera = this.experience.camera;
        if (boosting && !this.wasBoosting) {
            if (audio) audio.playBoost();
            if (camera) camera.addShake(0.45);
        }
        if (keys.brake && !this.wasBraking && this.speed > 1.5) {
            if (audio) audio.playBrake();
            if (camera) camera.addShake(0.3 + Math.min(this.speed / 11, 1) * 0.5);
        }
        this.wasBoosting = boosting;
        this.wasBraking = keys.brake;
    }
}
