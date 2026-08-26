// ============================================================
// POWERUPS.JS — PowerUpManager
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG, POWERUP_TYPES } from '../core/config.js';
import { randInt, dist2D } from '../utils/utils.js';

const ICON_COLOR = {
  [POWERUP_TYPES.MAGNET]: 0xff6ec7,
  [POWERUP_TYPES.SHIELD]: 0x4ad4ff,
  [POWERUP_TYPES.MULT]: 0xffd54a,
  [POWERUP_TYPES.BOOST]: 0x7CFC00
};

export class PowerUpManager {
  constructor(scene) {
    this.scene = scene;
    this.active = []; // itens no mundo, ainda não coletados
    this.timer = 0;
    this._lastSpeed = CONFIG.BASE_SPEED;

    // estado dos power-ups ativos no jogador: { type: remainingMs }
    this.effects = {};
  }

  _createPickup(type) {
    const group = new THREE.Group();
    const color = ICON_COLOR[type];

    // anel de contorno — dá identidade visual comum e realça a silhueta à distância
    const ringMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.0, roughness: 0.3, metalness: 0.5
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 20), ringMat);
    group.add(ring);

    let icon;
    switch (type) {
      case POWERUP_TYPES.MAGNET: icon = this._magnetIcon(); break;
      case POWERUP_TYPES.SHIELD: icon = this._shieldIcon(); break;
      case POWERUP_TYPES.MULT:   icon = this._starIcon(); break;
      case POWERUP_TYPES.BOOST:  icon = this._boltIcon(); break;
      default: icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), ringMat);
    }
    group.add(icon);

    group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.userData.powerType = type;
    return group;
  }

  // ---- ícones específicos de cada power-up (formas reconhecíveis à distância) ----
  _magnetIcon() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.35, metalness: 0.75 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.075, 10, 16, Math.PI), bodyMat);
    g.add(arc);

    const tipGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.14, 10);
    const redTip = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 0.6 }));
    redTip.position.set(-0.22, -0.07, 0);
    const blueTip = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0x3b82ff, emissive: 0x3b82ff, emissiveIntensity: 0.6 }));
    blueTip.position.set(0.22, -0.07, 0);
    g.add(redTip, blueTip);
    return g;
  }

  _shieldIcon() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfe8f5, roughness: 0.35, metalness: 0.55 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 20), mat);
    base.rotation.x = Math.PI / 2;
    g.add(base);

    const bossMat = new THREE.MeshStandardMaterial({ color: 0x4ad4ff, emissive: 0x4ad4ff, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.4 });
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), bossMat);
    boss.position.z = 0.05;
    g.add(boss);

    const crossMat = new THREE.MeshStandardMaterial({ color: 0x1a2a38, roughness: 0.5 });
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.03), crossMat);
    barV.position.z = 0.045;
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.03), crossMat);
    barH.position.z = 0.045;
    g.add(barV, barH);
    return g;
  }

  _starIcon() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd54a, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.3 });
    const spike = () => new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat);
    const sx = spike(); sx.scale.set(1, 0.28, 0.28);
    const sy = spike(); sy.scale.set(0.28, 1, 0.28);
    const sz = spike(); sz.scale.set(0.28, 0.28, 1);
    g.add(sx, sy, sz);
    return g;
  }

  _boltIcon() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8ffb0, emissive: 0x9be600, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.3 });
    const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.09), mat);
    seg1.position.set(0.06, 0.14, 0);
    seg1.rotation.z = -0.5;
    const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.09), mat);
    seg2.position.set(-0.06, -0.14, 0);
    seg2.rotation.z = -0.5;
    g.add(seg1, seg2);
    return g;
  }

  spawn() {
    const types = Object.values(POWERUP_TYPES);
    const type = types[randInt(0, types.length - 1)];
    const laneIdx = randInt(0, 2);
    const mesh = this._createPickup(type);
    mesh.position.set(CONFIG.LANES_X[laneIdx], 1.3, CONFIG.SPAWN_Z);
    this.scene.add(mesh);
    this.active.push(mesh);
  }

  setSpeed(speed) { this._lastSpeed = speed; }

  // Retorna lista de tipos coletados neste frame
  update(dt, playerPos) {
    this.timer += dt;
    if (this.timer > 1 / CONFIG.POWERUP_SPAWN_CHANCE_PER_SEC) {
      this.timer = 0;
      if (Math.random() < 0.7) this.spawn();
    }

    const collectedTypes = [];
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.position.z += this._lastSpeed * dt;
      p.rotation.y += dt * 2.4;
      p.rotation.x += dt * 1.1;

      const closeEnough = dist2D(p.position.x, p.position.z, playerPos.x, playerPos.z) < 0.95;
      if (closeEnough) {
        collectedTypes.push(p.userData.powerType);
        this.active.splice(i, 1);
        this.scene.remove(p);
        continue;
      }
      if (p.position.z > CONFIG.DESPAWN_Z) {
        this.active.splice(i, 1);
        this.scene.remove(p);
      }
    }

    // decrementa durações dos efeitos ativos
    for (const type in this.effects) {
      this.effects[type] -= dt * 1000;
      if (this.effects[type] <= 0) delete this.effects[type];
    }

    return collectedTypes;
  }

  activate(type) {
    this.effects[type] = CONFIG.POWERUP_DURATIONS[type];
  }

  isActive(type) { return !!this.effects[type]; }

  remainingRatio(type) {
    if (!this.effects[type]) return 0;
    return this.effects[type] / CONFIG.POWERUP_DURATIONS[type];
  }

  reset() {
    this.active.forEach(p => this.scene.remove(p));
    this.active = [];
    this.effects = {};
    this.timer = 0;
  }
}
