// ============================================================
// MAIN.JS — ponto de entrada
// ============================================================
import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    new Game();
  } catch (err) {
    document.getElementById('gameContainer').innerHTML =
      '<div style="color:#fff;padding:24px;font-family:Arial;text-align:center;">' +
      'Erro ao iniciar o jogo: ' + err.message +
      '<br>Verifique se está rodando via servidor local (não abrindo o arquivo diretamente).</div>';
    console.error(err);
  }
});
