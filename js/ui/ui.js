// ============================================================
// UI.JS — UIManager
// Toda manipulação de DOM/HUD fica isolada aqui.
// ============================================================
import { CONFIG, POWERUP_TYPES } from '../core/config.js';
import { formatNumber } from '../utils/utils.js';

const POWERUP_LABELS = {
  [POWERUP_TYPES.MAGNET]: '🧲 Ímã',
  [POWERUP_TYPES.SHIELD]: '🛡️ Escudo',
  [POWERUP_TYPES.MULT]: '✨ x2 Pontos',
  [POWERUP_TYPES.BOOST]: '⚡ Boost'
};

export class UIManager {
  constructor(callbacks) {
    this.cb = callbacks; // { onStart, onRestart, onPause, onResume, onToggleMute }
    this.el = {
      intro: document.getElementById('introScreen'),
      introVideo: document.getElementById('introVideo'),
      skipIntroBtn: document.getElementById('skipIntroBtn'),
      menu: document.getElementById('menuScreen'),
      pause: document.getElementById('pauseScreen'),
      gameover: document.getElementById('gameoverScreen'),
      hud: document.getElementById('hud'),
      score: document.getElementById('scoreText'),
      coins: document.getElementById('coinsText'),
      distance: document.getElementById('distanceText'),
      gapBarFg: document.getElementById('gapBarFg'),
      comboText: document.getElementById('comboText'),
      powerupIcons: document.getElementById('powerupIcons'),
      overFinalScore: document.getElementById('overFinalScore'),
      overHighscore: document.getElementById('overHighscore'),
      overCoins: document.getElementById('overCoins'),
      newRecord: document.getElementById('newRecordBadge'),
      muteBtn: document.getElementById('muteBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      touchControls: document.getElementById('touchControls'),
      skinOptions: Array.from(document.querySelectorAll('.skinOption'))
    };

    this._bindStaticButtons();
  }

  _bindStaticButtons() {
    document.getElementById('startBtn').addEventListener('click', () => this.cb.onStart());
    document.getElementById('restartBtn').addEventListener('click', () => this.cb.onRestart());
    document.getElementById('resumeBtn').addEventListener('click', () => this.cb.onResume());
    document.getElementById('menuFromPauseBtn').addEventListener('click', () => this.cb.onRestart(true));
    this.el.pauseBtn.addEventListener('click', () => this.cb.onPause());
    this.el.muteBtn.addEventListener('click', () => {
      const muted = this.cb.onToggleMute();
      this.setMuteIcon(muted);
    });

    // Botões de toque (setas/pular/agachar) — chamam os mesmos callbacks do teclado
    document.getElementById('btnLeft').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onLeft(); });
    document.getElementById('btnRight').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onRight(); });
    document.getElementById('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onJump(); });
    document.getElementById('btnSlide').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onSlide(); });

    // Seletor de skin (menu inicial)
    this.el.skinOptions.forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onSelectSkin(btn.dataset.skin));
    });
  }

  setSkinSelection(skin) {
    this.el.skinOptions.forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.skin === skin);
    });
  }

  setMuteIcon(muted) {
    this.el.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  showIntro(onFinish) {
    const finish = () => {
      this.el.introVideo.pause();
      this.el.intro.style.display = 'none';
      onFinish();
    };
    this.el.skipIntroBtn.onclick = finish;
    this.el.introVideo.onended = finish;
    this.el.intro.style.display = 'flex';
    this.el.introVideo.currentTime = 0;
    const playPromise = this.el.introVideo.play();
    if (playPromise) {
      playPromise.catch(() => {
        // autoplay com som bloqueado pelo navegador: tenta mudo
        this.el.introVideo.muted = true;
        this.el.introVideo.play().catch(() => {});
      });
    }
  }

  showMenu(highscore, totalCoins, skin) {
    this.el.intro.style.display = 'none';
    this.el.menu.style.display = 'flex';
    this.el.pause.style.display = 'none';
    this.el.gameover.style.display = 'none';
    this.el.hud.style.display = 'none';
    document.getElementById('menuHighscore').textContent = formatNumber(highscore);
    document.getElementById('menuTotalCoins').textContent = formatNumber(totalCoins);
    if (skin) this.setSkinSelection(skin);
  }

  showHUD() {
    this.el.menu.style.display = 'none';
    this.el.pause.style.display = 'none';
    this.el.gameover.style.display = 'none';
    this.el.hud.style.display = 'block';
  }

  showPause() {
    this.el.pause.style.display = 'flex';
  }

  hidePause() {
    this.el.pause.style.display = 'none';
  }

  showGameOver({ score, highscore, isNewRecord, runCoins }) {
    this.el.hud.style.display = 'none';
    this.el.gameover.style.display = 'flex';
    this.el.overFinalScore.textContent = formatNumber(score);
    this.el.overHighscore.textContent = formatNumber(highscore);
    this.el.overCoins.textContent = formatNumber(runCoins);
    this.el.newRecord.style.display = isNewRecord ? 'block' : 'none';
  }

  updateHUD({ score, coins, distance, gap, combo }) {
    this.el.score.textContent = formatNumber(score);
    this.el.coins.textContent = formatNumber(coins);
    this.el.distance.textContent = formatNumber(distance) + 'm';
    this.el.gapBarFg.style.width = (gap * 100) + '%';
    if (combo > 1) {
      this.el.comboText.style.display = 'inline-block';
      this.el.comboText.textContent = 'COMBO x' + combo;
    } else {
      this.el.comboText.style.display = 'none';
    }
  }

  updatePowerupIcons(effects) {
    this.el.powerupIcons.innerHTML = '';
    for (const type in effects) {
      const ratio = CONFIG.POWERUP_DURATIONS[type] > 100000
        ? 1
        : Math.max(0, effects[type] / CONFIG.POWERUP_DURATIONS[type]);
      const chip = document.createElement('div');
      chip.className = 'powerChip';
      chip.innerHTML = `<span>${POWERUP_LABELS[type]}</span><div class="powerBarBg"><div class="powerBarFg" style="width:${ratio * 100}%"></div></div>`;
      this.el.powerupIcons.appendChild(chip);
    }
  }

  flashDamageScreen() {
    const c = document.getElementById('gameContainer');
    c.style.boxShadow = 'inset 0 0 130px rgba(255,0,0,0.65)';
    setTimeout(() => { c.style.boxShadow = 'inset 0 0 0 rgba(0,0,0,0)'; }, 180);
  }

  flashPowerupScreen(color) {
    const c = document.getElementById('gameContainer');
    c.style.boxShadow = `inset 0 0 100px ${color}`;
    setTimeout(() => { c.style.boxShadow = 'inset 0 0 0 rgba(0,0,0,0)'; }, 260);
  }

  showFloatingText(text) {
    const el = document.createElement('div');
    el.className = 'floatingText';
    el.textContent = text;
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  showPowerupPickup(type, color) {
    const el = document.createElement('div');
    el.className = 'powerupPickupText';
    el.textContent = (POWERUP_LABELS[type] || type) + ' ativado!';
    el.style.color = color || '#fff';
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}
