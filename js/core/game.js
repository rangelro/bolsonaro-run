// ============================================================
// GAME.JS — classe principal, máquina de estados e loop
// ============================================================
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { CONFIG, OBSTACLE_TYPES, POWERUP_TYPES, GAME_STATE } from './config.js';
import { clamp } from '../utils/utils.js';
import { Player } from '../entities/player.js';
import { Chaser } from '../entities/chaser.js';
import { ObstacleManager } from '../managers/obstacles.js';
import { CoinManager } from '../managers/coins.js';
import { PowerUpManager } from '../managers/powerups.js';
import { SceneryManager } from '../managers/scenery.js';
import { ParticleManager } from '../managers/particles.js';
import { UIManager } from '../ui/ui.js';
import { AudioManager } from '../ui/audio.js';

export class Game {
  constructor() {
    this.state = GAME_STATE.MENU;
    this.audio = new AudioManager();

    this.ui = new UIManager({
      onStart: () => this.startRun(),
      onRestart: (toMenu) => toMenu ? this.goToMenu() : this.startRun(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onToggleMute: () => this.audio.toggleMuted(),
      onLeft: () => this.moveLane(-1),
      onRight: () => this.moveLane(1),
      onJump: () => this.doJump(),
      onSlide: () => this.doSlide(),
      onSelectSkin: (skin) => this.selectSkin(skin)
    });
    this.ui.setMuteIcon(this.audio.muted);

    this.skin = localStorage.getItem(CONFIG.STORAGE_KEYS.skin) || 'selecao';

    this._initThree();
    this._initEntities();
    this._initInput();
    window.addEventListener('resize', () => this._onResize());

    this.clock = new THREE.Clock();

    this.highscore = Number(localStorage.getItem(CONFIG.STORAGE_KEYS.highscore) || 0);
    this.totalCoins = Number(localStorage.getItem(CONFIG.STORAGE_KEYS.totalCoins) || 0);

    if (localStorage.getItem(CONFIG.STORAGE_KEYS.introSeen)) {
      this.ui.showMenu(this.highscore, this.totalCoins, this.skin);
    } else {
      this.ui.showIntro(() => {
        localStorage.setItem(CONFIG.STORAGE_KEYS.introSeen, '1');
        this.ui.showMenu(this.highscore, this.totalCoins, this.skin);
      });
    }
    this._loop();
  }

  selectSkin(skin) {
    this.skin = skin;
    localStorage.setItem(CONFIG.STORAGE_KEYS.skin, skin);
    this.player.setSkin(skin);
    this.ui.setSkinSelection(skin);
  }

  // ---------------------------------------------------------
  // SETUP
  // ---------------------------------------------------------
  _initThree() {
    const container = document.getElementById('gameContainer');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.Fog(0x0b1220, 22, 68);

    this.baseFov = 62;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 5.4, 9.5);
    this.camera.lookAt(0, 1.6, -10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.insertBefore(this.renderer.domElement, container.firstChild);

    this.hemiLight = new THREE.HemisphereLight(0x3a5a8a, 0x1a120a, 0.75);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xb0c8e8, 1.05);
    this.sunLight.position.set(-8, 18, 6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -20; this.sunLight.shadow.camera.right = 20;
    this.sunLight.shadow.camera.top = 20; this.sunLight.shadow.camera.bottom = -20;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xff9944, 0.28);
    this.fillLight.position.set(10, 3, -5);
    this.scene.add(this.fillLight);

    this.dayTime = 0.25; // começa de dia

    this._buildGround();
  }

  _buildGround() {
    // ---- Asfalto com grain e marcações ----
    const asfCanvas = document.createElement('canvas');
    asfCanvas.width = 512; asfCanvas.height = 512;
    const aCtx = asfCanvas.getContext('2d');
    aCtx.fillStyle = '#1e2830';
    aCtx.fillRect(0, 0, 512, 512);
    // grain de asfalto
    const imgd = aCtx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < imgd.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      imgd.data[i]   = Math.max(0, Math.min(255, imgd.data[i]   + n));
      imgd.data[i+1] = Math.max(0, Math.min(255, imgd.data[i+1] + n));
      imgd.data[i+2] = Math.max(0, Math.min(255, imgd.data[i+2] + n));
    }
    aCtx.putImageData(imgd, 0, 0);
    // linha sólida nas bordas da pista
    aCtx.strokeStyle = 'rgba(255,255,255,0.72)';
    aCtx.lineWidth = 5; aCtx.setLineDash([]);
    aCtx.beginPath(); aCtx.moveTo(6,0); aCtx.lineTo(6,512); aCtx.stroke();
    aCtx.beginPath(); aCtx.moveTo(506,0); aCtx.lineTo(506,512); aCtx.stroke();
    // divisórias tracejadas
    aCtx.lineWidth = 4; aCtx.setLineDash([52, 38]);
    aCtx.strokeStyle = 'rgba(255,255,210,0.60)';
    for (const xd of [512/3, (512/3)*2]) {
      aCtx.beginPath(); aCtx.moveTo(xd, 0); aCtx.lineTo(xd, 512); aCtx.stroke();
    }
    const tex = new THREE.CanvasTexture(asfCanvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 28);
    this.groundMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.04 });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 400), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -150);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ---- Calçada com ladrilhos ----
    const swCanvas = document.createElement('canvas');
    swCanvas.width = 256; swCanvas.height = 256;
    const swCtx = swCanvas.getContext('2d');
    // base
    swCtx.fillStyle = '#8e8e88';
    swCtx.fillRect(0, 0, 256, 256);
    // variação sutil de bloco a bloco
    const bw = 64, bh = 48;
    for (let row = 0; row < Math.ceil(256/bh); row++) {
      for (let col = 0; col < Math.ceil(256/bw); col++) {
        const v = Math.floor(Math.random() * 14) - 7;
        const base = 142 + v;
        swCtx.fillStyle = `rgb(${base},${base},${base-2})`;
        swCtx.fillRect(col*bw + 1, row*bh + 1, bw - 2, bh - 2);
      }
    }
    // juntas (rejunte) escuras
    swCtx.strokeStyle = 'rgba(50,50,48,0.7)';
    swCtx.lineWidth = 2;
    for (let y = 0; y <= 256; y += bh) { swCtx.beginPath(); swCtx.moveTo(0,y); swCtx.lineTo(256,y); swCtx.stroke(); }
    for (let x = 0; x <= 256; x += bw) { swCtx.beginPath(); swCtx.moveTo(x,0); swCtx.lineTo(x,256); swCtx.stroke(); }
    this.sidewalkTex = new THREE.CanvasTexture(swCanvas);
    this.sidewalkTex.wrapS = THREE.RepeatWrapping; this.sidewalkTex.wrapT = THREE.RepeatWrapping;
    this.sidewalkTex.repeat.set(1.5, 55);
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: this.sidewalkTex, roughness: 0.86 });

    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(6, 400), sidewalkMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(side * 7, -0.01, -150);
      sw.receiveShadow = true;
      this.scene.add(sw);
    }

    // Meio-fio entre pista e calçada
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c4, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 400), curbMat);
      curb.position.set(side * 4.09, 0.07, -150);
      curb.castShadow = true;
      curb.receiveShadow = true;
      this.scene.add(curb);
    }

    // Chão sob os prédios — concreto granulado escuro
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 256; bgCanvas.height = 256;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle = '#5a5a56';
    bgCtx.fillRect(0, 0, 256, 256);
    const bgd = bgCtx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < bgd.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      bgd.data[i]   = Math.max(0, Math.min(255, bgd.data[i]   + n));
      bgd.data[i+1] = Math.max(0, Math.min(255, bgd.data[i+1] + n));
      bgd.data[i+2] = Math.max(0, Math.min(255, bgd.data[i+2] + n));
    }
    bgCtx.putImageData(bgd, 0, 0);
    this.buildGroundTex = new THREE.CanvasTexture(bgCanvas);
    this.buildGroundTex.wrapS = THREE.RepeatWrapping; this.buildGroundTex.wrapT = THREE.RepeatWrapping;
    this.buildGroundTex.repeat.set(4, 55);
    const buildGroundMat = new THREE.MeshStandardMaterial({ map: this.buildGroundTex, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(28, 400), buildGroundMat);
      bg.rotation.x = -Math.PI / 2;
      bg.position.set(side * 20, -0.02, -150);
      bg.receiveShadow = true;
      this.scene.add(bg);
    }
  }

  // Keyframes: [t, skyHex, fogHex, hSkyHex, hGndHex, sunHex, sunInt, fillHex, fillInt]
  static get _DAY_KEYS() {
    return [
      [0.00, 0x0e0a1c, 0x0e0a1c, 0x1c0828, 0x060208, 0xff7030, 0.20, 0x100008, 0.05],
      [0.10, 0xcc3c14, 0xa02c0a, 0xff5020, 0x280c06, 0xffb050, 0.80, 0xff4410, 0.45],
      [0.25, 0x5ca0d8, 0x7ec8f0, 0x68b8e8, 0x182010, 0xfffbe0, 1.45, 0x88aaff, 0.20],
      [0.50, 0x4490c0, 0x60a8e0, 0x50a0d8, 0x161808, 0xfff0c0, 1.20, 0xffaa44, 0.18],
      [0.62, 0xd04012, 0x982808, 0xff5020, 0x200808, 0xff8030, 0.75, 0xff5020, 0.55],
      [0.75, 0x10081e, 0x10081e, 0x1e0a2c, 0x050206, 0xc0a0e0, 0.32, 0x200030, 0.06],
      [0.88, 0x0b1220, 0x0b1220, 0x3a5a8a, 0x1a120a, 0xb0c8e8, 1.05, 0xff9944, 0.28],
      [1.00, 0x0e0a1c, 0x0e0a1c, 0x1c0828, 0x060208, 0xff7030, 0.20, 0x100008, 0.05],
    ];
  }

  _updateDaylight(t) {
    const keys = Game._DAY_KEYS;
    let a = keys[0], b = keys[1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
    }
    const u = (t - a[0]) / (b[0] - a[0]);
    const lc = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), u);
    const lv = (va, vb) => va + (vb - va) * u;

    const sky = lc(a[1], b[1]);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(lc(a[2], b[2]));
    this.hemiLight.color.copy(lc(a[3], b[3]));
    this.hemiLight.groundColor.copy(lc(a[4], b[4]));
    this.sunLight.color.copy(lc(a[5], b[5]));
    this.sunLight.intensity  = lv(a[6], b[6]);
    this.fillLight.color.copy(lc(a[7], b[7]));
    this.fillLight.intensity = lv(a[8], b[8]);

    // Posição do sol/lua ao redor do eixo X (arco no céu)
    const angle = t * Math.PI * 2;
    this.sunLight.position.set(Math.cos(angle) * 16, Math.sin(angle) * 20 + 2, 6);
  }

  _initEntities() {
    this.player = new Player(this.scene, this.skin);
    this.chaser = new Chaser(this.scene);
    this.obstacles = new ObstacleManager(this.scene);
    this.coins = new CoinManager(this.scene);
    this.powerups = new PowerUpManager(this.scene);
    this.scenery = new SceneryManager(this.scene);
    this.particles = new ParticleManager(this.scene);
  }

  _initInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === GAME_STATE.PLAYING) this.pause();
        else if (this.state === GAME_STATE.PAUSED) this.resume();
        return;
      }
      if (this.state !== GAME_STATE.PLAYING) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.moveLane(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.moveLane(1);
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.doJump();
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.doSlide();
    });

    let startX = 0, startY = 0;
    window.addEventListener('touchstart', (e) => {
      if (this.state !== GAME_STATE.PLAYING) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    });
    window.addEventListener('touchend', (e) => {
      if (this.state !== GAME_STATE.PLAYING) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) this.moveLane(dx > 0 ? 1 : -1);
      else if (Math.abs(dy) > 30) { if (dy < 0) this.doJump(); else this.doSlide(); }
    });
  }

  // ---------------------------------------------------------
  // MÁQUINA DE ESTADOS
  // ---------------------------------------------------------
  startRun() {
    this.state = GAME_STATE.PLAYING;
    this.player.reset();
    this.chaser.reset();
    this.obstacles.reset();
    this.coins.reset();
    this.powerups.reset();
    this.scenery.reset();
    this.particles.reset();

    this.gameSpeed = CONFIG.BASE_SPEED;
    this.distance = 0;
    this.gap = 1.0;
    this.score = 0;
    this.runCoins = 0;
    this.combo = 0;
    this.lastCoinTime = 0;
    this.boostTimeLeft = 0;

    this.ui.showHUD();
    this.audio.startMusic();
  }

  pause() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.PAUSED;
    this.ui.showPause();
    this.audio.uiClick();
  }

  resume() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = GAME_STATE.PLAYING;
    this.ui.hidePause();
    this.audio.uiClick();
  }

  goToMenu() {
    this.state = GAME_STATE.MENU;
    this.ui.showMenu(this.highscore, this.totalCoins, this.skin);
  }

  triggerGameOver() {
    this.state = GAME_STATE.GAMEOVER;
    this.audio.stopMusic();
    this.audio.gameover();

    const isNewRecord = this.score > this.highscore;
    if (isNewRecord) {
      this.highscore = Math.floor(this.score);
      localStorage.setItem(CONFIG.STORAGE_KEYS.highscore, String(this.highscore));
    }
    this.totalCoins += this.runCoins;
    localStorage.setItem(CONFIG.STORAGE_KEYS.totalCoins, String(this.totalCoins));

    this.ui.showGameOver({
      score: this.score, highscore: this.highscore,
      isNewRecord, runCoins: this.runCoins
    });
  }

  // ---------------------------------------------------------
  // AÇÕES DO JOGADOR
  // ---------------------------------------------------------
  moveLane(dir) {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.player.moveLane(dir);
  }
  doJump() {
    if (this.state !== GAME_STATE.PLAYING) return;
    if (this.player.jump(performance.now())) this.audio.jump();
  }
  doSlide() {
    if (this.state !== GAME_STATE.PLAYING) return;
    if (this.player.slide(performance.now())) this.audio.slide();
  }

  // ---------------------------------------------------------
  // COLISÃO
  // ---------------------------------------------------------
  _checkObstacleCollisions(now) {
    for (const obs of this.obstacles.active) {
      if (obs.userData.passed) continue;
      const sameLane = obs.userData.laneIndex === this.player.lane;
      const inHitZone = obs.position.z > CONFIG.PLAYER_Z - 1.3 && obs.position.z < CONFIG.PLAYER_Z + 1.0;
      if (!sameLane || !inHitZone) continue;

      const avoided =
        (obs.userData.obstacleType === OBSTACLE_TYPES.LOW && this.player.isJumping) ||
        (obs.userData.obstacleType === OBSTACLE_TYPES.HIGH && this.player.isSliding);

      if (avoided) {
        if (obs.position.z > CONFIG.PLAYER_Z) obs.userData.passed = true;
        continue;
      }

      if (this.player.invulnerable) continue;

      obs.userData.passed = true;
      const realHit = this.player.hit(now);
      if (realHit) {
        this.gap = Math.max(0, this.gap - CONFIG.GAP_DRAIN_ON_HIT);
        this.combo = 0;
        this.audio.hit();
        this.ui.flashDamageScreen();
        this.player.flashDamage();
        this.particles.impactBurst(this.player.position);
      } else {
        delete this.powerups.effects[POWERUP_TYPES.SHIELD];
        this.ui.showFloatingText('Escudo absorveu o impacto!');
      }
    }
  }

  // ---------------------------------------------------------
  // LOOP PRINCIPAL
  // ---------------------------------------------------------
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.state === GAME_STATE.PLAYING) this._update(dt, now);

    this.renderer.render(this.scene, this.camera);
  }

  _update(dt, now) {
    // -------- velocidade / boost --------
    const boosting = this.powerups.isActive(POWERUP_TYPES.BOOST);
    this.gameSpeed = Math.min(CONFIG.MAX_SPEED, this.gameSpeed + CONFIG.SPEED_RAMP_PER_SEC * dt * 10);
    const effectiveSpeed = boosting ? this.gameSpeed * CONFIG.BOOST_SPEED_MULT : this.gameSpeed;

    const targetFov = boosting ? this.baseFov + CONFIG.BOOST_FOV_BUMP : this.baseFov;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    this.obstacles.setSpeed(effectiveSpeed);
    this.coins.setSpeed(effectiveSpeed);
    this.powerups.setSpeed(effectiveSpeed);
    this.scenery.setSpeed(effectiveSpeed);

    // -------- jogador / perseguidor --------
    this.player.update(dt, now, this.gameSpeed);
    this.camera.position.x += (this.player.targetX * 0.5 - this.camera.position.x) * Math.min(1, dt * 6);

    this.gap = Math.min(1, this.gap + CONFIG.GAP_RECOVER_RATE * dt);
    this.chaser.update(dt, now, this.gameSpeed, this.player.targetX, this.gap);

    // -------- distância / pontuação --------
    this.distance += effectiveSpeed * dt;
    const multActive = this.powerups.isActive(POWERUP_TYPES.MULT);
    this.score += effectiveSpeed * dt * CONFIG.SCORE_PER_METER * (multActive ? 2 : 1);

    this.groundMat.map.offset.y  += effectiveSpeed * dt * 0.06;
    this.sidewalkTex.offset.y    += effectiveSpeed * dt * 0.118;
    this.buildGroundTex.offset.y += effectiveSpeed * dt * 0.118;

    // Ciclo dia/noite — 1 volta completa em 180 segundos
    this.dayTime = (this.dayTime + dt / 180) % 1;
    this._updateDaylight(this.dayTime);

    // De noite (céu escuro), acende a lanterna do jogador
    const bg = this.scene.background;
    const skyLum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
    this.player.setFlashlightOn(skyLum < 0.15);

    // -------- obstáculos --------
    this.obstacles.update(dt, this.distance);
    this._checkObstacleCollisions(now);

    // -------- moedas --------
    const magnetActive = this.powerups.isActive(POWERUP_TYPES.MAGNET);
    const collectedCoins = this.coins.update(dt, this.player.position, magnetActive);
    if (collectedCoins > 0) {
      for (let i = 0; i < collectedCoins; i++) this._onCoinCollected(now, multActive);
    }

    // -------- power-ups --------
    const collectedPowerups = this.powerups.update(dt, this.player.position);
    collectedPowerups.forEach((type) => this._onPowerupCollected(type));

    // -------- cenário --------
    this.scenery.update(dt);
    this.particles.update(dt);

    // -------- combo timeout --------
    if (this.combo > 0 && now - this.lastCoinTime > CONFIG.COMBO_WINDOW_MS) {
      this.combo = 0;
    }

    // -------- HUD --------
    this.ui.updateHUD({
      score: this.score, coins: this.runCoins, distance: this.distance,
      gap: this.gap, combo: this.combo
    });
    this.ui.updatePowerupIcons(this.powerups.effects);

    if (this.gap <= 0) this.triggerGameOver();
  }

  _onCoinCollected(now, multActive) {
    this.combo++;
    this.lastCoinTime = now;
    const comboBonus = 1 + Math.min(CONFIG.COMBO_MAX_BONUS, (this.combo - 1) * CONFIG.COMBO_STEP_BONUS);
    const value = CONFIG.COIN_VALUE * comboBonus * (multActive ? 2 : 1);
    this.runCoins += 1;
    this.score += value * 10;
    this.audio.coin();
    this.particles.coinBurst(this.player.position);
  }

  _onPowerupCollected(type) {
    this.powerups.activate(type);
    if (type === POWERUP_TYPES.SHIELD) this.player.setShield(true);
    this.audio.powerup();
    const colors = { magnet: '#ff6ec7', shield: '#4ad4ff', multiplier: '#ffd54a', boost: '#7CFC00' };
    const color = colors[type] || '#ffffff';
    this.ui.flashPowerupScreen(color);
    this.ui.showPowerupPickup(type, color);
    this.particles.powerupBurst(this.player.position, 0xffffff);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
