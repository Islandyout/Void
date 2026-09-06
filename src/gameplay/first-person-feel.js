import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const damp = (current, target, sharpness, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-sharpness * dt));

export class FirstPersonFeel {
  constructor(camera, weaponRig) {
    this.camera = camera;
    this.weaponRig = weaponRig;
    this.baseFov = 75;
    this.sprintFov = 82;
    this.lookX = 0;
    this.lookY = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.kick = 0;
    this.rollKick = 0;
    this.bobPhase = 0;
    this.landImpulse = 0;
    this.reloadRemaining = 0;
    this.reloadDuration = 0;
    this.switchRemaining = 0;
    this.switchDuration = 0;
  }

  onLook(dx, dy) {
    this.lookX += dx;
    this.lookY += dy;
  }

  onShot(weapon, adsAmount) {
    const adsControl = THREE.MathUtils.lerp(1, 0.68, adsAmount);
    this.recoilPitch += weapon.recoil.pitch * adsControl * (0.9 + Math.random() * 0.2);
    this.recoilYaw += (Math.random() - 0.5) * weapon.recoil.yaw * adsControl;
    this.kick += weapon.recoil.kick * THREE.MathUtils.lerp(1, 0.72, adsAmount);
    this.rollKick += (Math.random() - 0.5) * weapon.recoil.yaw * 0.85;
  }

  onLand(intensity = 1) {
    this.landImpulse = Math.min(0.12, this.landImpulse + 0.035 * intensity);
  }

  onReload(duration) {
    this.reloadDuration = Math.max(0.01, duration);
    this.reloadRemaining = this.reloadDuration;
  }

  onSwitch(duration = 0.34) {
    this.switchDuration = Math.max(0.01, duration);
    this.switchRemaining = this.switchDuration;
  }

  cancelActions() {
    this.reloadRemaining = 0;
    this.switchRemaining = 0;
  }

  update(dt, state) {
    const { weapon, ads, moving, sprinting, grounded, speed01, strafing = 0 } = state;
    const adsAmount = clamp(ads, 0, 1);

    this.recoilPitch = damp(this.recoilPitch, 0, weapon.recoil.recovery, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, weapon.recoil.recovery * 1.1, dt);
    this.kick = damp(this.kick, 0, weapon.recoil.recovery * 1.35, dt);
    this.rollKick = damp(this.rollKick, 0, weapon.recoil.recovery * 1.2, dt);
    this.landImpulse = damp(this.landImpulse, 0, 13, dt);
    this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
    this.switchRemaining = Math.max(0, this.switchRemaining - dt);

    if (moving && grounded) this.bobPhase += dt * THREE.MathUtils.lerp(7.5, 11.2, sprinting ? 1 : speed01);
    const moveAmount = moving && grounded ? 1 : 0;
    const adsDamp = THREE.MathUtils.lerp(1, 0.24, adsAmount);
    const bobX = Math.sin(this.bobPhase) * 0.010 * moveAmount * adsDamp;
    const bobY = Math.sin(this.bobPhase * 2) * 0.008 * moveAmount * adsDamp;

    const swayX = clamp(-this.lookX * 0.00042, -0.035, 0.035) * adsDamp;
    const swayY = clamp(this.lookY * 0.00034, -0.027, 0.027) * adsDamp;
    this.lookX *= Math.pow(0.018, dt);
    this.lookY *= Math.pow(0.018, dt);

    const view = weapon.view;
    const restX = THREE.MathUtils.lerp(view.x, 0, adsAmount);
    const restY = THREE.MathUtils.lerp(view.y, -0.155, adsAmount);
    const restZ = THREE.MathUtils.lerp(view.z, -0.385, adsAmount);
    const sprintDrop = sprinting ? 0.11 : 0;
    const sprintYaw = sprinting ? 0.28 : 0;

    let actionX = 0, actionY = 0, actionZ = 0, actionPitch = 0, actionYaw = 0, actionRoll = 0;
    if (this.reloadRemaining > 0) {
      const p = 1 - this.reloadRemaining / this.reloadDuration;
      const arc = Math.sin(p * Math.PI);
      const late = Math.sin(Math.min(1, p * 1.18) * Math.PI);
      actionX = 0.075 * arc;
      actionY = -0.105 * arc;
      actionZ = 0.055 * arc;
      actionPitch = -0.26 * late;
      actionYaw = -0.22 * arc;
      actionRoll = -0.62 * arc;
    }
    if (this.switchRemaining > 0) {
      const p = 1 - this.switchRemaining / this.switchDuration;
      const dip = Math.sin(p * Math.PI);
      actionY -= 0.23 * dip;
      actionZ += 0.06 * dip;
      actionYaw += 0.32 * dip;
      actionRoll += 0.16 * dip;
    }

    this.weaponRig.position.x = damp(this.weaponRig.position.x, restX + swayX + bobX + actionX, 17, dt);
    this.weaponRig.position.y = damp(this.weaponRig.position.y, restY + swayY + bobY - sprintDrop - this.landImpulse + actionY, 17, dt);
    this.weaponRig.position.z = damp(this.weaponRig.position.z, restZ + this.kick + actionZ, 22, dt);
    this.weaponRig.rotation.x = damp(this.weaponRig.rotation.x, -this.recoilPitch * 8 + this.landImpulse * 1.8 + actionPitch, 20, dt);
    this.weaponRig.rotation.y = damp(this.weaponRig.rotation.y, sprintYaw + THREE.MathUtils.lerp(0.035, 0, adsAmount) + actionYaw, 12, dt);
    this.weaponRig.rotation.z = damp(this.weaponRig.rotation.z, -strafing * 0.035 + this.rollKick * 5 + actionRoll, 14, dt);

    const targetFov = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(this.baseFov, this.sprintFov, sprinting ? 1 : 0),
      weapon.adsFov,
      adsAmount,
    );
    this.camera.fov = damp(this.camera.fov, targetFov, 13, dt);
    this.camera.updateProjectionMatrix();

    return {
      pitch: this.recoilPitch * 0.58 + this.landImpulse * 0.18,
      yaw: this.recoilYaw * 0.7,
      roll: -strafing * 0.008 + this.rollKick * 0.8,
    };
  }
}
