# Bolsonaro Run

Jogo estilo *endless runner* de 3 pistas em 3D, feito com **Three.js puro** (sem frameworks pesados).
Nenhuma figura pública real é usada — os personagens são genéricos.

## Como rodar

Como o jogo usa **módulos ES6** (`import`/`export`), o navegador precisa carregá-lo via `http://`,
não via `file://` (o Chrome/Edge bloqueiam módulos por CORS quando o arquivo é aberto direto).

Rode um servidor local simples na pasta do projeto:

```bash
# Python 3 (já vem em praticamente todo sistema)
cd fuga-sem-fim-3d
python3 -m http.server 8000
```

Depois abra **http://localhost:8000** no navegador.

Alternativas: `npx serve .`, extensão "Live Server" do VS Code, ou qualquer servidor estático.

## Estrutura de pastas

```
fuga-sem-fim-3d/
├── index.html          # HUD, menus, controles touch
├── css/
│   └── style.css        # toda a interface
├── js/
│   ├── main.js           # ponto de entrada
│   ├── game.js           # classe Game — orquestra tudo, máquina de estados
│   ├── config.js         # todas as constantes ajustáveis (sem números mágicos)
│   ├── utils.js          # lerp, clamp, easing, distância etc.
│   ├── player.js         # classe Player (jogador)
│   ├── chaser.js         # classe Chaser (perseguidor)
│   ├── obstacles.js      # ObstacleManager (com object pooling)
│   ├── coins.js          # CoinManager (spawn em padrões, ímã, coleta)
│   ├── powerups.js       # PowerUpManager (ímã, escudo, x2, boost)
│   ├── scenery.js        # SceneryManager (prédios/postes proceduais, pooling)
│   ├── particles.js      # ParticleManager (VFX leve com THREE.Points)
│   ├── ui.js              # UIManager (todo o DOM/HUD isolado aqui)
│   └── audio.js           # AudioManager (SFX e música sintetizados via WebAudio)
└── README.md
```

## Controles

| Ação | Teclado | Touch |
|---|---|---|
| Trocar de faixa | ← → ou A/D | Botões ◀ ▶ ou swipe horizontal |
| Pular | ↑ / W / Espaço | Botão ▲ ou swipe para cima |
| Agachar | ↓ / S | Botão ▼ ou swipe para baixo |
| Pausar | ESC ou P | Botão ⏸ no canto superior |
| Mudo | — | Botão 🔊 no canto superior |

## Sistemas implementados

- **Máquina de estados**: `menu` → `playing` ⇄ `paused` → `gameover`
- **3 pistas** com troca suave (lerp) e animação de corrida nas pernas/braços
- **Pulo e deslize** com hitbox que ignora o tipo certo de obstáculo
- **Perseguidor**: barra de "distância" que cai ao bater em obstáculo e recupera com o tempo; se zerar, é game over
- **Moedas**: spawnam em fileiras/padrões, têm combo (moedas seguidas aumentam o multiplicador de pontos) e podem ser puxadas pelo ímã
- **4 power-ups**: 🧲 Ímã, 🛡️ Escudo (absorve 1 colisão), ✨ Multiplicador x2, ⚡ Boost de velocidade (com FOV dinâmico na câmera)
- **Dificuldade dinâmica**: velocidade e frequência de obstáculos aumentam gradualmente com a distância
- **VFX leves**: partículas ao coletar moeda, ativar power-up e sofrer impacto (via `THREE.Points`, sem pós-processamento pesado)
- **Cenário procedural** com pooling (prédios/postes reaproveitados, não criados/destruídos toda hora)
- **Áudio**: todos os efeitos (pulo, moeda, power-up, colisão, game over) e a música de fundo são **sintetizados por código** via WebAudio — nenhum arquivo de áudio externo é necessário
- **Persistência**: recorde e total de moedas salvos em `localStorage`
- **HUD completo**: pontos, moedas, distância, combo, ícones de power-up ativo com barra de duração
- Object **pooling** em obstáculos, moedas e cenário para manter performance estável

## Checklist de testes manuais

- [ ] O jogo carrega sem erros no console (F12) via `http://localhost:8000`
- [ ] Tela de menu mostra recorde/moedas salvos corretamente (0 na primeira vez)
- [ ] Trocar de faixa nas 3 posições funciona nos dois sentidos
- [ ] Pular passa por cima do obstáculo baixo sem bater
- [ ] Agachar passa por baixo da barra alta sem bater
- [ ] Bater em um obstáculo reduz a barra do perseguidor e pisca a tela de vermelho
- [ ] Perseguidor alcançando o jogador (barra zerada) dispara o Game Over
- [ ] Moedas em fileira são coletadas ao passar por cima
- [ ] Combo aumenta ao coletar moedas seguidas e zera após ficar ~2,5s sem coletar
- [ ] Cada power-up funciona e mostra o ícone com a barra de duração correta
- [ ] Escudo absorve exatamente 1 colisão e depois some
- [ ] Pausar (ESC/botão) congela o jogo; continuar retoma corretamente
- [ ] Game over salva novo recorde quando a pontuação supera o anterior
- [ ] Botão de mudo silencia SFX e música corretamente
- [ ] Em uma tela estreita (mobile), os botões de toque aparecem e funcionam
- [ ] Swipe (mobile) funciona para trocar de faixa, pular e agachar
- [ ] FPS permanece estável (~60fps) após alguns minutos de jogo contínuo

## Próximos passos sugeridos

- Skins/personalizações do personagem (cores, acessórios) desbloqueáveis com moedas totais
- Missões diárias simples (ex: "colete 50 moedas", "sobreviva 500m")
- Loja para trocar moedas totais por power-ups iniciais ou vidas extras
- Modelos 3D com textura/rig real no lugar das formas geométricas
- Efeito de pós-processamento leve (bloom sutil) com toggle de qualidade
- Ranking local dos últimos N recordes (não só o máximo)
- Parallax em duas camadas no cenário para mais profundidade
