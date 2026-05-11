import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SnakeGame.css';

const STATS_KEY = 'snake_stats';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { bestScore: 0, gamesPlayed: 0, totalScore: 0 };
}

function saveStats(score) {
  const prev = loadStats();
  const next = {
    bestScore: Math.max(prev.bestScore, score),
    gamesPlayed: prev.gamesPlayed + 1,
    totalScore: prev.totalScore + score,
  };
  localStorage.setItem(STATS_KEY, JSON.stringify(next));
  return next;
}

export default function SnakeGame() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null); // mutable game state (avoids stale closures)

  /* ── canvas game engine ─────────────────────────────────────── */
  const initEngine = useCallback((canvas) => {
    const ctx = canvas.getContext('2d');
    const COLS = 24, ROWS = 24, CELL = 24;
    canvas.width  = COLS * CELL;
    canvas.height = ROWS * CELL;

    const C = {
      bg: '#050a0e',
      gridLine: 'rgba(0,255,100,0.025)',
      snakeHead: '#00ff6a',
      snakeBody: '#00cc55',
      foodOuter: '#ff4a6a',
      foodInner: '#ffaaaa',
      deathRed: '#ff3355',
    };

    let snake, dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 }, food, score, level, baseSpeed;
    let gameState = 'idle';
    let particles = [];
    let pulseT = 0;
    let deathAnim = 0;
    let lastTick = 0, tickInterval = 160;
    let interpFrac = 0;
    let rafId = null;
    let stats = loadStats();

    /* ── DOM refs for HUD ── */
    const scoreEl = document.getElementById('sn-score');
    const levelEl = document.getElementById('sn-level');
    const bestEl  = document.getElementById('sn-best');
    const startOv = document.getElementById('sn-startOverlay');
    const gameOvOv = document.getElementById('sn-gameOverOverlay');
    const finalSc  = document.getElementById('sn-finalScore');
    const finalBst = document.getElementById('sn-finalBest');
    const gamesPlayedEl = document.getElementById('sn-gamesPlayed');

    function updateHUD() {
      if (scoreEl) scoreEl.textContent = score;
      if (levelEl) levelEl.textContent = level;
      if (bestEl) bestEl.textContent = stats.bestScore;
    }

    function showStartOverlay() { startOv && startOv.classList.remove('sn-hidden'); }
    function hideOverlays() {
      startOv && startOv.classList.add('sn-hidden');
      gameOvOv && gameOvOv.classList.add('sn-hidden');
    }

    function spawnFood() {
      let pos;
      do {
        pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      } while (snake.some(s => s.x === pos.x && s.y === pos.y));
      food = pos;
    }

    function setDir(dx, dy) {
      if (dx !== 0 && dir.x !== 0) return;
      if (dy !== 0 && dir.y !== 0) return;
      nextDir = { x: dx, y: dy };
    }

    function spawnParticles(gx, gy) {
      const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.025 + Math.random() * 0.03,
          size: 2 + Math.random() * 3,
          hue: Math.random() > 0.5 ? '#00ff6a' : '#ff4a6a',
        });
      }
    }

    function updateParticles() {
      particles = particles.filter(p => p.life > 0.01);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.92; p.vy *= 0.92;
        p.life -= p.decay;
      }
    }

    function updateLevel() {
      const nl = Math.floor(score / 100) + 1;
      if (nl !== level) { level = nl; tickInterval = Math.max(60, baseSpeed - (level - 1) * 12); }
    }

    function die() {
      gameState = 'dead';
      deathAnim = 0;
      stats = saveStats(score);
      if (finalSc) finalSc.textContent = 'Score: ' + score;
      if (finalBst) finalBst.textContent = score >= stats.bestScore ? '🏆 New Best!' : 'Best: ' + stats.bestScore;
      if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed + ' games played';
      if (bestEl) bestEl.textContent = stats.bestScore;
      setTimeout(() => { gameOvOv && gameOvOv.classList.remove('sn-hidden'); }, 900);
    }

    function startGame() {
      if (rafId) cancelAnimationFrame(rafId);
      snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
      dir = { x: 1, y: 0 };
      nextDir = { x: 1, y: 0 };
      score = 0; level = 1; baseSpeed = 160; tickInterval = 160;
      particles = []; pulseT = 0; deathAnim = 0;
      spawnFood();
      updateHUD();
      hideOverlays();
      gameState = 'running';
      lastTick = performance.now();
      interpFrac = 0;
      rafId = requestAnimationFrame(loop);
    }

    /* ── rendering helpers ── */
    function roundRect(cx, x, y, w, h, r) {
      cx.beginPath();
      cx.moveTo(x + r, y);
      cx.lineTo(x + w - r, y);
      cx.arcTo(x + w, y,     x + w, y + r,     r);
      cx.lineTo(x + w, y + h - r);
      cx.arcTo(x + w, y + h, x + w - r, y + h, r);
      cx.lineTo(x + r, y + h);
      cx.arcTo(x,     y + h, x,     y + h - r, r);
      cx.lineTo(x,     y + r);
      cx.arcTo(x,     y,     x + r, y,         r);
      cx.closePath();
    }

    function drawBg() {
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = C.gridLine;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
      }
    }

    function drawSegment(cx2, cy2, size, isHead, alpha, color) {
      const half = size / 2, r = isHead ? 5 : 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color || (isHead ? C.snakeHead : C.snakeBody);
      ctx.shadowBlur  = isHead ? 20 : 8;
      ctx.fillStyle   = color || (isHead ? C.snakeHead : C.snakeBody);
      roundRect(ctx, cx2 - half, cy2 - half, size, size, r);
      ctx.fill();
      if (!color) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.shadowBlur = 0;
        roundRect(ctx, cx2 - half + 2, cy2 - half + 2, size / 2, size / 3, 2);
        ctx.fill();
      }
      if (isHead && !color) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#050a0e';
        const ex = dir.x, ey = dir.y;
        const perp = { x: -ey, y: ex };
        const eo = 4.5, ed = 3;
        ctx.beginPath();
        ctx.arc(cx2 + ex * ed + perp.x * eo, cy2 + ey * ed + perp.y * eo, 2.2, 0, Math.PI * 2);
        ctx.arc(cx2 + ex * ed - perp.x * eo, cy2 + ey * ed - perp.y * eo, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00ff6a';
        ctx.beginPath();
        ctx.arc(cx2 + ex * ed + perp.x * eo, cy2 + ey * ed + perp.y * eo, 1, 0, Math.PI * 2);
        ctx.arc(cx2 + ex * ed - perp.x * eo, cy2 + ey * ed - perp.y * eo, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawSnake(frac) {
      const len = snake.length;
      for (let i = len - 1; i >= 0; i--) {
        const s = snake[i];
        let cx2, cy2;
        if (i === 0 && frac < 1) {
          const prev = snake[1] || s;
          cx2 = (prev.x + (s.x - prev.x) * frac) * CELL + CELL / 2;
          cy2 = (prev.y + (s.y - prev.y) * frac) * CELL + CELL / 2;
        } else if (i === len - 1 && len > 1 && frac < 1) {
          const next = snake[i - 1];
          cx2 = (s.x + (next.x - s.x) * frac) * CELL + CELL / 2;
          cy2 = (s.y + (next.y - s.y) * frac) * CELL + CELL / 2;
        } else {
          cx2 = s.x * CELL + CELL / 2;
          cy2 = s.y * CELL + CELL / 2;
        }
        const t = i / len;
        drawSegment(cx2, cy2, (CELL - 2) * (i === 0 ? 1 : 0.88 - t * 0.18), i === 0, 0.55 + 0.45 * (1 - t), null);
      }
    }

    function drawFood() {
      const pulse = 0.85 + Math.sin(pulseT) * 0.15;
      const cx2 = food.x * CELL + CELL / 2, cy2 = food.y * CELL + CELL / 2;
      const r = (CELL / 2 - 2) * pulse;
      ctx.save();
      ctx.shadowColor = C.foodOuter; ctx.shadowBlur = 18 * pulse;
      ctx.strokeStyle = C.foodOuter; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx2, cy2, r + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 14; ctx.fillStyle = C.foodOuter;
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = C.foodInner;
      ctx.beginPath(); ctx.arc(cx2 - r * 0.25, cy2 - r * 0.25, r * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life * 0.9;
        ctx.fillStyle = p.hue; ctx.shadowColor = p.hue; ctx.shadowBlur = 6;
        const radius = Math.max(0, p.size * p.life);
        if (radius === 0) { ctx.restore(); continue; }
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    function drawDead(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBg();
      ctx.save(); ctx.globalAlpha = t * 0.18; ctx.fillStyle = C.deathRed;
      ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
      for (let i = 0; i < snake.length; i++) {
        const s = snake[i];
        drawSegment(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, CELL - 2, i === 0, 1 - t * (i / snake.length) * 0.9, C.deathRed);
      }
      drawFood(); drawParticles();
    }

    /* ── tick ── */
    function tick() {
      dir = { ...nextDir };
      const head = snake[0];
      const newHead = { x: head.x + dir.x, y: head.y + dir.y };
      if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) { die(); return; }
      if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) { die(); return; }
      snake.unshift(newHead);
      if (newHead.x === food.x && newHead.y === food.y) {
        score += 10 * level;
        spawnFood(); spawnParticles(newHead.x, newHead.y);
        updateLevel(); updateHUD();
      } else { snake.pop(); }
    }

    /* ── main loop ── */
    function loop(now) {
      if (gameState === 'paused') return;
      if (gameState === 'dead') {
        deathAnim = Math.min(1, deathAnim + 0.04);
        drawDead(deathAnim);
        if (deathAnim < 1) rafId = requestAnimationFrame(loop);
        return;
      }
      if (gameState !== 'running') return;
      const elapsed = now - lastTick;
      interpFrac = Math.min(elapsed / tickInterval, 1);
      if (elapsed >= tickInterval) {
        tick();
        if (gameState === 'dead') { rafId = requestAnimationFrame(loop); return; }
        lastTick = now; interpFrac = 0;
      }
      pulseT += 0.06;
      updateParticles();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBg(); drawFood(); drawSnake(interpFrac); drawParticles();
      rafId = requestAnimationFrame(loop);
    }

    /* ── idle draw ── */
    (function idleDraw() {
      drawBg();
      const demo = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }, { x: 10, y: 11 }, { x: 11, y: 11 }, { x: 12, y: 11 }];
      for (let i = demo.length - 1; i >= 0; i--) {
        const s = demo[i];
        drawSegment(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, (CELL - 2) * (i === 0 ? 1 : 0.88), i === 0, 0.3 + 0.7 * (1 - i / demo.length), null);
      }
    })();

    showStartOverlay();
    updateHUD();

    /* ── expose controls ── */
    stateRef.current = {
      startGame,
      setDir,
      getGameState: () => gameState,
      setGameState: (s) => { gameState = s; },
      resumeLoop: () => { lastTick = performance.now(); rafId = requestAnimationFrame(loop); },
      destroy: () => { if (rafId) cancelAnimationFrame(rafId); },
    };
  }, []);

  /* ── mount canvas + attach input ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initEngine(canvas);

    /* keyboard */
    const onKey = (e) => {
      const gs = stateRef.current;
      if (!gs) return;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': e.preventDefault(); gs.setDir(0, -1); break;
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); gs.setDir(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); gs.setDir(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); gs.setDir(1, 0); break;
        case ' ':
          e.preventDefault();
          const state = gs.getGameState();
          if (state === 'idle' || state === 'dead') { gs.startGame(); break; }
          if (state === 'running') { gs.setGameState('paused'); }
          else if (state === 'paused') { gs.setGameState('running'); gs.resumeLoop(); }
          break;
        default: break;
      }
    };
    document.addEventListener('keydown', onKey);

    /* touch */
    let tSX = null, tSY = null;
    const onTouchStart = (e) => { tSX = e.touches[0].clientX; tSY = e.touches[0].clientY; };
    const onTouchEnd = (e) => {
      if (tSX === null) return;
      const dx = e.changedTouches[0].clientX - tSX;
      const dy = e.changedTouches[0].clientY - tSY;
      if (Math.abs(dx) > Math.abs(dy)) stateRef.current?.setDir(dx > 0 ? 1 : -1, 0);
      else stateRef.current?.setDir(0, dy > 0 ? 1 : -1);
      tSX = null;
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      stateRef.current?.destroy();
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [initEngine]);

  const handleStart = () => stateRef.current?.startGame();

  return (
    <div className="sn-page">
      <div className="sn-bg-grid" />

      <div className="sn-topbar">
        <button className="sn-back-btn" onClick={() => navigate('/games')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Games
        </button>
      </div>

      <div className="sn-wrapper">
        <div className="sn-title">Snake</div>

        <div className="sn-hud">
          <div className="sn-hud-item">
            <span className="sn-hud-label">Score</span>
            <span className="sn-hud-value" id="sn-score">0</span>
          </div>
          <div className="sn-hud-item">
            <span className="sn-hud-label">Level</span>
            <span className="sn-hud-value" id="sn-level">1</span>
          </div>
          <div className="sn-hud-item">
            <span className="sn-hud-label">Best</span>
            <span className="sn-hud-value" id="sn-best">0</span>
          </div>
        </div>

        <div className="sn-canvas-wrap">
          <canvas ref={canvasRef} id="sn-canvas" />

          {/* Start overlay */}
          <div className="sn-overlay" id="sn-startOverlay">
            <div className="sn-overlay-emoji">🐍</div>
            <div className="sn-overlay-title">SNAKE</div>
            <div className="sn-overlay-sub">Navigate · Eat · Grow · Survive</div>
            <button className="sn-start-btn" onClick={handleStart}>Press Space / Click</button>
            <div className="sn-overlay-sub" style={{ color: 'rgba(0,255,106,0.2)', marginTop: 4 }}>
              Arrow keys or WASD · Space to pause
            </div>
          </div>

          {/* Game over overlay */}
          <div className="sn-overlay sn-hidden" id="sn-gameOverOverlay">
            <div className="sn-overlay-title sn-death">GAME OVER</div>
            <div className="sn-overlay-score" id="sn-finalScore">Score: 0</div>
            <div className="sn-overlay-score sn-overlay-score--sm" id="sn-finalBest" />
            <div className="sn-overlay-score sn-overlay-score--xs" id="sn-gamesPlayed" />
            <button className="sn-start-btn sn-start-btn--death" onClick={handleStart}>Try Again</button>
          </div>
        </div>

        <div className="sn-hint">Arrow Keys · WASD · Space to pause</div>
      </div>
    </div>
  );
}
