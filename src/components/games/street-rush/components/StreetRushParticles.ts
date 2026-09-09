import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorType: number; // 0 = smoke, 1 = nitro cyan, 2 = nitro magenta
}

export class StreetRushParticleSystem {
  public group: THREE.Group;
  private maxParticles = 300;
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;

  constructor() {
    this.group = new THREE.Group();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Simple procedural circular particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 1.5,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.group.add(this.points);
  }

  public emitSmoke(x: number, y: number, z: number, carVx: number, carVz: number) {
    if (this.particles.length >= this.maxParticles) return;

    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.4,
      y: y + 0.15,
      z: z + (Math.random() - 0.5) * 0.4,
      vx: carVx * 0.15 + (Math.random() - 0.5) * 0.8,
      vy: 0.6 + Math.random() * 0.6,
      vz: carVz * 0.15 + (Math.random() - 0.5) * 0.8,
      life: 0,
      maxLife: 0.45 + Math.random() * 0.25,
      size: 1.0 + Math.random() * 0.6,
      colorType: 0,
    });
  }

  public emitNitro(x: number, y: number, z: number, forwardX: number, forwardZ: number) {
    if (this.particles.length >= this.maxParticles) return;

    // Spew particles backward relative to car forward direction
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.25,
      y: y + 0.2,
      z: z + (Math.random() - 0.5) * 0.25,
      vx: -forwardX * 12 + (Math.random() - 0.5) * 1.5,
      vy: 0.2 + (Math.random() - 0.5) * 0.5,
      vz: -forwardZ * 12 + (Math.random() - 0.5) * 1.5,
      life: 0,
      maxLife: 0.2 + Math.random() * 0.15,
      size: 1.4 + Math.random() * 0.8,
      colorType: Math.random() > 0.4 ? 1 : 2, // Cyan or Magenta
    });
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size += dt * 1.2;
    }

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    const sizeAttr = this.geometry.attributes.size as THREE.BufferAttribute;

    const count = this.particles.length;
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < count) {
        const p = this.particles[i];
        const progress = p.life / p.maxLife;
        const fade = 1 - progress;

        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;

        if (p.colorType === 0) {
          // Tire Smoke: white-grey fading to dark
          const c = 0.55 * fade;
          this.colors[i * 3] = c;
          this.colors[i * 3 + 1] = c;
          this.colors[i * 3 + 2] = c;
        } else if (p.colorType === 1) {
          // Nitro Cyan
          this.colors[i * 3] = 0.1 * fade;
          this.colors[i * 3 + 1] = 0.8 * fade;
          this.colors[i * 3 + 2] = 1.0 * fade;
        } else {
          // Nitro Magenta / Purple
          this.colors[i * 3] = 0.9 * fade;
          this.colors[i * 3 + 1] = 0.2 * fade;
          this.colors[i * 3 + 2] = 1.0 * fade;
        }

        this.sizes[i] = p.size;
      } else {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -999;
        this.positions[i * 3 + 2] = 0;
        this.sizes[i] = 0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }

  public dispose() {
    this.geometry.dispose();
    if (Array.isArray(this.points.material)) {
      this.points.material.forEach((m) => m.dispose());
    } else {
      this.points.material.dispose();
    }
  }
}
