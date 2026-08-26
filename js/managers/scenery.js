// ============================================================
// SCENERY.JS — SceneryManager (cenário procedural)
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG } from '../core/config.js';
import { randRange, randInt } from '../utils/utils.js';

const BODY_LIGHT = [0xc0c0c0, 0xd0d0d0, 0xb8bab8];
const BODY_DARK  = [0x424242, 0x505050, 0x383838];
const WIN_COLOR  = 0x1a2a3a; // vidro escuro
const WIN_LIT    = 0xd4b86a; // janela acesa (amarelo)

function buildBuilding(w, h, d, light) {
  const group = new THREE.Group();

  // ---- Corpo principal ----
  const bodyPalette = light ? BODY_LIGHT : BODY_DARK;
  const bodyColor   = bodyPalette[randInt(0, bodyPalette.length - 1)];
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.65 });
  const body    = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h / 2;
  body.castShadow    = true;
  body.receiveShadow = true;
  group.add(body);

  // ---- Faixa horizontal no meio (detalhe arquitetônico) ----
  const bandColor = light ? 0x888888 : 0x1e1e1e;
  const bandMat   = new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.7 });
  const band      = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.22, d + 0.1), bandMat);
  band.position.y = h * 0.5;
  group.add(band);

  // ---- Janelas (grade nas faces Z) ----
  const cols = Math.max(1, Math.floor(w / 1.4));
  const rows = Math.max(2, Math.floor(h / 1.8));
  const winW = Math.min(0.55, (w / cols) * 0.55);
  const winH = 0.42;
  const stepX = w / cols;
  const stepY = h / (rows + 1);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = (c - (cols - 1) / 2) * stepX;
      const wy = stepY * (r + 1);
      // ~20% das janelas acesas
      const lit    = Math.random() < 0.2;
      const winMat = new THREE.MeshStandardMaterial({
        color: lit ? WIN_LIT : WIN_COLOR,
        roughness: 0.2,
        metalness: 0.4,
        emissive: lit ? 0x6a500a : 0x000000,
        emissiveIntensity: lit ? 0.6 : 0
      });
      const winGeo = new THREE.BoxGeometry(winW, winH, 0.06);

      // Face +Z (frente)
      const wf = new THREE.Mesh(winGeo, winMat);
      wf.position.set(wx, wy, d / 2 + 0.02);
      group.add(wf);

      // Face -Z (fundo)
      const wb = new THREE.Mesh(winGeo, winMat.clone());
      wb.position.set(wx, wy, -d / 2 - 0.02);
      group.add(wb);
    }
  }

  // ---- Telhado com borda ----
  const roofColor = light ? 0x909090 : 0x202020;
  const roofMat   = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 });
  const roof      = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.28, d + 0.5), roofMat);
  roof.position.y = h + 0.14;
  roof.castShadow = true;
  group.add(roof);

  // Caixa d'água / antena no topo (só prédios altos)
  if (h > 8 && Math.random() < 0.6) {
    const tankMat  = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    const tankSize = randRange(0.6, 1.2);
    const tank     = new THREE.Mesh(new THREE.BoxGeometry(tankSize, tankSize * 1.2, tankSize), tankMat);
    tank.position.set(randRange(-w * 0.25, w * 0.25), h + 0.28 + tankSize * 0.6, 0);
    group.add(tank);
  }

  return group;
}

function buildTree() {
  const group = new THREE.Group();
  const trunkH = randRange(1.5, 3.5);
  const leafR  = randRange(1.0, 2.2);
  // variação de verde (árvores brasileiras — mais saturado)
  const green = new THREE.Color().setHSL(0.32 + Math.random() * 0.05, 0.55, 0.18 + Math.random() * 0.10);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a1e08, roughness: 0.95 });
  const leafMat  = new THREE.MeshStandardMaterial({ color: green, roughness: 0.85 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, trunkH, 6), trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Camada 1 — copa principal
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(leafR, leafR * 1.9, 7), leafMat);
  c1.position.y = trunkH + leafR * 0.65;
  c1.castShadow = true;
  group.add(c1);

  // Camada 2 — topo menor (50% chance)
  if (Math.random() < 0.55) {
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(leafR * 0.65, leafR * 1.3, 7), leafMat);
    c2.position.y = trunkH + leafR * 1.55;
    group.add(c2);
  }

  group._shape = 'tree';
  return group;
}

function buildLamp() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x686868, roughness: 0.5, metalness: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffe090, emissive: 0xffcc44, emissiveIntensity: 1.4, roughness: 0.3
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 8), poleMat);
  pole.position.y = 2.1;
  pole.castShadow = true;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), poleMat);
  arm.position.set(0.42, 4.26, 0);
  group.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.24), headMat);
  head.position.set(0.85, 4.17, 0);
  group.add(head);
  group._shape = 'lamp';
  return group;
}

export class SceneryManager {
  constructor(scene) {
    this.scene      = scene;
    this.active     = [];
    this._lastSpeed = CONFIG.BASE_SPEED;
    this._timer     = 0;
    this._lampTimer = 0;
    this._treeTimer = 0;
  }

  _spawnTrees() {
    for (const side of [-1, 1]) {
      // 1 a 3 árvores agrupadas por spawn
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const grp = buildTree();
        grp.position.set(
          side * randRange(20, 36),
          0,
          CONFIG.SPAWN_Z - i * randRange(3, 7)
        );
        this.scene.add(grp);
        this.active.push(grp);
      }
    }
  }

  _spawnLamps() {
    for (const side of [-1, 1]) {
      const grp = buildLamp();
      // Postes na borda interna da calçada, braço voltado para a rua
      grp.position.set(side * 5.5, 0, CONFIG.SPAWN_Z);
      // Braço do poste sempre aponta para a pista (centro)
      if (side === 1) grp.rotation.y = Math.PI;
      this.scene.add(grp);
      this.active.push(grp);
    }
  }

  _spawnPair() {
    for (const side of [-1, 1]) {
      const w     = randRange(3, 6.5);
      const h     = randRange(5, 15);
      const d     = randRange(2.5, 4.5);
      const light = Math.random() < 0.5;
      const grp   = buildBuilding(w, h, d, light);
      grp.position.set(side * randRange(10, 15), 0, CONFIG.SPAWN_Z);
      this.scene.add(grp);
      this.active.push(grp);
    }
  }

  _release(grp) {
    this.scene.remove(grp);
    grp.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  setSpeed(speed) { this._lastSpeed = speed; }

  update(dt) {
    this._timer += dt * 1000;
    const interval = Math.max(550, 1300 - this._lastSpeed * 18);
    if (this._timer >= interval) {
      this._timer = 0;
      this._spawnPair();
    }

    this._lampTimer += dt * 1000;
    const lampInterval = Math.max(700, 1800 / (this._lastSpeed / 14));
    if (this._lampTimer >= lampInterval) {
      this._lampTimer = 0;
      this._spawnLamps();
    }

    this._treeTimer += dt * 1000;
    const treeInterval = Math.max(400, 1100 / (this._lastSpeed / 14));
    if (this._treeTimer >= treeInterval) {
      this._treeTimer = 0;
      this._spawnTrees();
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const grp = this.active[i];
      grp.position.z += this._lastSpeed * dt;
      if (grp.position.z > CONFIG.DESPAWN_Z + 20) {
        this._release(grp);
        this.active.splice(i, 1);
      }
    }
  }

  reset() {
    this.active.forEach(g => this._release(g));
    this.active     = [];
    this._timer     = 0;
    this._lampTimer = 0;
    this._treeTimer = 0;
  }
}
