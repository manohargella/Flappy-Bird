/**
 * Flappy Bird Clone
 * Game loop, physics, rendering, and collision logic separated.
 */

(function () {
  'use strict';

  // ========== DOM & Canvas ==========
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const currentScoreEl = document.getElementById('current-score');
  const highScoreEl = document.getElementById('high-score');
  const finalScoreEl = document.getElementById('final-score');
  const finalHighScoreEl = document.getElementById('final-high-score');
  const soundToggle = document.getElementById('sound-toggle');

  // ========== Game State ==========
  let state = 'start'; // 'start' | 'playing' | 'gameover'
  let score = 0;
  let highScore = parseInt(localStorage.getItem('flappyHighScore') || '0', 10);
  let soundEnabled = true;
  let lastTime = 0;
  let animationId = null;

  // ========== Physics Constants ==========
  const GRAVITY = 0.45;
  const FLAP_IMPULSE = -8.2;
  const MAX_FALL_SPEED = 10;
  const PIPE_GAP = 160;
  const PIPE_WIDTH = 64;
  const PIPE_SPEED_INITIAL = 3.2;
  const PIPE_SPAWN_INTERVAL = 1800; // ms between pipe pairs
  const BIRD_RADIUS = 14; // for circular hitbox (pixel-perfect feel)
  const GROUND_Y_RATIO = 0.82; // ground starts at 82% of canvas height

  // ========== Game Objects ==========
  let bird = null;
  let pipes = [];
  let pipeSpawnTimer = 0;
  let basePipeSpeed = PIPE_SPEED_INITIAL;
  let groundY = 0;
  let gameWidth = 400;
  let gameHeight = 600;

  // ========== Resize & Setup ==========
  function resize() {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gameWidth = rect.width;
    gameHeight = rect.height;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = gameHeight * GROUND_Y_RATIO;
    if (bird) bird.y = groundY * 0.5;
  }

  function initBird() {
    groundY = gameHeight * GROUND_Y_RATIO;
    // Start bird in the vertical middle of the play area (between sky and ground)
    const playAreaHeight = groundY;
    const startY = playAreaHeight * 0.5;
    return {
      x: gameWidth * 0.28,
      y: startY,
      vy: 0,
      radius: BIRD_RADIUS,
      rotation: 0
    };
  }

  // ========== Physics ==========
  function updatePhysics(dt) {
    if (state !== 'playing' || !bird) return;

    // Apply gravity (dt normalized for ~60fps)
    const normalizedDt = Math.min(dt / 16, 2);
    bird.vy += GRAVITY * normalizedDt;
    bird.vy = Math.min(bird.vy, MAX_FALL_SPEED);

    // Update position
    bird.y += bird.vy * normalizedDt;

    // Rotation: tilt up when moving up, down when falling
    const targetRotation = bird.vy < 0 ? -0.4 : Math.min(0.6, bird.vy * 0.08);
    bird.rotation += (targetRotation - bird.rotation) * 0.15;
  }

  function flap() {
    if (state !== 'playing' || !bird) return;
    bird.vy = FLAP_IMPULSE;
  }

  // ========== Pipes ==========
  function spawnPipe() {
    const minGapY = 120;
    const maxGapY = gameHeight * GROUND_Y_RATIO - PIPE_GAP - 80;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);

    pipes.push({
      x: gameWidth + PIPE_WIDTH,
      gapY,
      gapHeight: PIPE_GAP,
      width: PIPE_WIDTH,
      passed: false,
      top: { x: 0, y: 0, w: PIPE_WIDTH, h: gapY },
      bottom: { x: 0, y: gapY + PIPE_GAP, w: PIPE_WIDTH, h: gameHeight - (gapY + PIPE_GAP) }
    });
  }

  function updatePipes(dt) {
    if (state !== 'playing') return;

    pipeSpawnTimer += dt;
    const interval = Math.max(1200, PIPE_SPAWN_INTERVAL - score * 25);
    if (pipeSpawnTimer >= interval) {
      pipeSpawnTimer = 0;
      spawnPipe();
    }

    const speed = basePipeSpeed * (1 + score * 0.02);

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= speed * (dt / 16);

      p.top.x = p.x;
      p.top.y = 0;
      p.top.w = PIPE_WIDTH;
      p.top.h = p.gapY;

      p.bottom.x = p.x;
      p.bottom.y = p.gapY + p.gapHeight;
      p.bottom.w = PIPE_WIDTH;
      p.bottom.h = gameHeight - p.bottom.y;

      // Score when bird center passes pipe (right edge)
      if (!p.passed && bird && bird.x > p.x + p.width) {
        p.passed = true;
        score++;
        playScoreSound();
        currentScoreEl.textContent = score;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('flappyHighScore', String(highScore));
          highScoreEl.textContent = highScore;
        }
      }

      if (p.x + p.width < 0) pipes.splice(i, 1);
    }
  }

  // ========== Collision ==========
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  function checkCollisions() {
    if (state !== 'playing' || !bird) return;

    groundY = gameHeight * GROUND_Y_RATIO;

    // Ground collision (circle vs horizontal line)
    if (bird.y + bird.radius >= groundY) {
      gameOver();
      return;
    }

    // Ceiling (optional soft limit)
    if (bird.y - bird.radius <= 0) {
      bird.y = bird.radius;
      bird.vy = 0;
    }

    // Pipe collision: bird circle vs each pipe rectangle
    for (const p of pipes) {
      if (circleRect(bird.x, bird.y, bird.radius, p.top.x, p.top.y, p.top.w, p.top.h) ||
          circleRect(bird.x, bird.y, bird.radius, p.bottom.x, p.bottom.y, p.bottom.w, p.bottom.h)) {
        gameOver();
        return;
      }
    }
  }

  // ========== Rendering ==========
  function drawBird() {
    if (!bird) return;
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    // Body (ellipse)
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.radius * 1.1, bird.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d68910';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(6, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(7, -4, 2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(20, -3);
    ctx.lineTo(20, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function drawPipes() {
    for (const p of pipes) {
      const capH = 24;
      const green = '#73bf2e';
      const greenDark = '#5a9a24';

      // Top pipe
      ctx.fillStyle = greenDark;
      ctx.fillRect(p.x, 0, p.width + 2, p.gapY + capH + 2);
      ctx.fillStyle = green;
      ctx.fillRect(p.x + 2, 2, p.width - 2, p.gapY + capH - 2);
      ctx.fillStyle = '#5a9a24';
      ctx.fillRect(p.x, p.gapY + capH - 2, p.width + 2, 4);
      ctx.fillStyle = '#4a8a1a';
      ctx.fillRect(p.x + 4, 0, p.width - 8, capH);

      // Bottom pipe
      const by = p.gapY + p.gapHeight;
      ctx.fillStyle = greenDark;
      ctx.fillRect(p.x, by - capH - 2, p.width + 2, gameHeight - by + capH + 2);
      ctx.fillStyle = green;
      ctx.fillRect(p.x + 2, by - capH, p.width - 2, gameHeight - by + capH - 2);
      ctx.fillRect(p.x, by - capH - 2, p.width + 2, 4);
      ctx.fillStyle = '#4a8a1a';
      ctx.fillRect(p.x + 4, by - capH, p.width - 8, capH);
    }
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ========== Game Flow ==========
  function gameOver() {
    state = 'gameover';
    playHitSound();
    finalScoreEl.textContent = score;
    finalHighScoreEl.textContent = highScore;
    gameOverScreen.classList.remove('hidden');
    cancelAnimationFrame(animationId);
  }

  function startGame() {
    state = 'playing';
    score = 0;
    basePipeSpeed = PIPE_SPEED_INITIAL;
    pipes = [];
    pipeSpawnTimer = 0;
    bird = initBird();
    currentScoreEl.textContent = '0';
    highScoreEl.textContent = highScore;
    startScreen.style.display = 'none';
    gameOverScreen.classList.add('hidden');
    lastTime = performance.now();
    gameLoop(lastTime);
  }

  function restartGame() {
    gameOverScreen.classList.add('hidden');
    startGame();
  }

  // ========== Game Loop ==========
  function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    updatePhysics(dt);
    updatePipes(dt);
    checkCollisions();
    clearCanvas();
    drawPipes();
    drawBird();

    if (state === 'playing') {
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  // ========== Sound (Web Audio API) ==========
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, duration, type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type || 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  function playFlapSound() {
    playTone(400, 0.08, 'sine');
    playTone(600, 0.06, 'sine');
  }

  function playScoreSound() {
    playTone(523, 0.1, 'sine');
    playTone(659, 0.1, 'sine');
    playTone(784, 0.15, 'sine');
  }

  function playHitSound() {
    playTone(150, 0.2, 'sawtooth');
    playTone(100, 0.25, 'sawtooth');
  }

  // ========== Input ==========
  function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault();

    // Spacebar on start screen also starts the game
    if (state === 'start') {
      startScreen.style.display = 'none';
      startGame();
      return;
    }
    if (state === 'playing') {
      flap();
      playFlapSound();
    }
  }

  canvas.addEventListener('click', handleInput);
  document.addEventListener('keydown', handleInput);

  // Start game: button or tap anywhere on start screen
  startBtn.addEventListener('click', function () {
    startScreen.style.display = 'none';
    startGame();
  });
  startScreen.addEventListener('click', function (e) {
    // Tap anywhere on overlay (not only the button) to start
    if (e.target === startScreen) {
      startScreen.style.display = 'none';
      startGame();
    }
  });

  restartBtn.addEventListener('click', restartGame);

  soundToggle.addEventListener('click', function () {
    soundEnabled = !soundEnabled;
    soundToggle.classList.toggle('muted', !soundEnabled);
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  });

  // Prevent space from scrolling
  document.body.addEventListener('keydown', function (e) {
    if (e.code === 'Space') e.preventDefault();
  });

  // ========== Init ==========
  window.addEventListener('resize', resize);
  resize();
  bird = initBird();
  highScoreEl.textContent = highScore;
})();
