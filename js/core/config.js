// ============================================================
// CONFIG.JS — todas as constantes ajustáveis do jogo em um só lugar
// ============================================================
export const CONFIG = {
  LANES_X: [-2.4, 0, 2.4],
  PLAYER_Z: 0,
  CHASER_MAX_BEHIND: 6.2,
  CHASER_MIN_BEHIND: 1.0,

  SPAWN_Z: -70,
  DESPAWN_Z: 9,

  JUMP_HEIGHT: 2.1,
  JUMP_DURATION: 620,   // ms
  SLIDE_DURATION: 520,  // ms

  BASE_SPEED: 14,
  MAX_SPEED: 36,
  SPEED_RAMP_PER_SEC: 0.16,   // quanto gameSpeed cresce por segundo de jogo
  BOOST_SPEED_MULT: 1.6,
  BOOST_FOV_BUMP: 12,

  GAP_DRAIN_ON_HIT: 0.30,
  GAP_RECOVER_RATE: 0.045,

  OBSTACLE_BASE_INTERVAL: 950, // ms
  OBSTACLE_MIN_INTERVAL: 430,
  OBSTACLE_DIFFICULTY_SCALE: 0.55, // reduz o intervalo conforme a distância cresce

  COIN_VALUE: 1,
  COIN_ROW_SPACING: 1.5,       // espaço em Z entre moedas de uma fileira
  COIN_SPAWN_CHANCE_PER_SEC: 0.55,
  COIN_MAGNET_RADIUS: 3.2,

  COMBO_WINDOW_MS: 2500,       // tempo entre moedas para manter o combo
  COMBO_STEP_BONUS: 0.02,      // cada moeda no combo aumenta o multiplicador em +2%
  COMBO_MAX_BONUS: 1.0,        // até dobrar o score por moeda em combo alto

  POWERUP_SPAWN_CHANCE_PER_SEC: 0.045,
  POWERUP_DURATIONS: {
    magnet: 8000,
    shield: 999999, // dura até ser usado (1 colisão), não por tempo
    multiplier: 8000,
    boost: 5000
  },

  SCORE_PER_METER: 1,

  STORAGE_KEYS: {
    highscore: 'runner3d_highscore',
    totalCoins: 'runner3d_totalCoins',
    muted: 'runner3d_muted',
    introSeen: 'runner3d_introSeen',
    skin: 'runner3d_skin'
  }
};

export const OBSTACLE_TYPES = { LOW: 'low', HIGH: 'high' };
export const POWERUP_TYPES = { MAGNET: 'magnet', SHIELD: 'shield', MULT: 'multiplier', BOOST: 'boost' };
export const GAME_STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
