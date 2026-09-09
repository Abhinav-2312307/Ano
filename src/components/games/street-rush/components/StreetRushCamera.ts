import * as THREE from 'three';

export class StreetRushCameraController {
  public camera: THREE.PerspectiveCamera;
  private targetPos: THREE.Vector3 = new THREE.Vector3(0, 3, 10);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Tuning
  private baseDistance = 7.4;
  private baseHeight = 3.2;
  private maxNitroDistance = 9.0;
  private fovBase = 65;
  private fovNitro = 76;

  // Shake impulse
  private shakeIntensity = 0;

  constructor(fov: number = 65, aspect: number = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 12);
  }

  public triggerImpulse(strength: number = 0.5) {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + strength);
  }

  public update(
    carX: number,
    carY: number,
    carZ: number,
    carRotationY: number,
    speed: number,
    isNitro: boolean,
    isDrifting: boolean,
    dt: number = 0.016
  ) {
    // 1. Dynamic distance & height based on speed and nitro
    const speedRatio = Math.min(1.0, Math.max(0, speed / 50));
    const targetDistance = this.baseDistance + (isNitro ? 1.6 : speedRatio * 0.8);
    const targetHeight = this.baseHeight + (isDrifting ? 0.3 : 0);

    // 2. Ideal camera position behind the car along its heading
    // Car forward vector is (sin(rotationY + PI), 0, cos(rotationY + PI)) = (-sin(rotationY), 0, -cos(rotationY))
    // Behind vector is opposite
    const behindX = Math.sin(carRotationY) * targetDistance;
    const behindZ = Math.cos(carRotationY) * targetDistance;

    const desiredCamX = carX + behindX;
    const desiredCamY = Math.max(1.4, carY + targetHeight);
    const desiredCamZ = carZ + behindZ;

    // 3. Smooth position lerp with adaptive speed
    const posLerp = Math.min(1.0, 8.5 * dt);
    this.camera.position.x += (desiredCamX - this.camera.position.x) * posLerp;
    this.camera.position.y += (desiredCamY - this.camera.position.y) * posLerp;
    this.camera.position.z += (desiredCamZ - this.camera.position.z) * posLerp;

    // 4. Smooth target look-at point ahead of the car
    const lookAheadDist = 4.0;
    const aheadX = -Math.sin(carRotationY) * lookAheadDist;
    const aheadZ = -Math.cos(carRotationY) * lookAheadDist;

    const desiredLookAtX = carX + aheadX;
    const desiredLookAtY = carY + 1.2;
    const desiredLookAtZ = carZ + aheadZ;

    const lookLerp = Math.min(1.0, 12.0 * dt);
    this.currentLookAt.x += (desiredLookAtX - this.currentLookAt.x) * lookLerp;
    this.currentLookAt.y += (desiredLookAtY - this.currentLookAt.y) * lookLerp;
    this.currentLookAt.z += (desiredLookAtZ - this.currentLookAt.z) * lookLerp;

    // 5. Apply shake impulse if any
    if (this.shakeIntensity > 0.001) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.35;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.25;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 4.0);
    }

    this.camera.lookAt(this.currentLookAt);

    // 6. Dynamic FOV pull during nitro
    const targetFov = isNitro ? this.fovNitro : this.fovBase + speedRatio * 4;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, 6 * dt);
    this.camera.updateProjectionMatrix();
  }

  public snapTo(carX: number, carY: number, carZ: number, carRotationY: number) {
    const behindX = Math.sin(carRotationY) * this.baseDistance;
    const behindZ = Math.cos(carRotationY) * this.baseDistance;
    this.camera.position.set(carX + behindX, Math.max(1.4, carY + this.baseHeight), carZ + behindZ);
    const lookAheadDist = 4.0;
    const aheadX = -Math.sin(carRotationY) * lookAheadDist;
    const aheadZ = -Math.cos(carRotationY) * lookAheadDist;
    this.currentLookAt.set(carX + aheadX, carY + 1.2, carZ + aheadZ);
    this.camera.lookAt(this.currentLookAt);
  }

  public setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
