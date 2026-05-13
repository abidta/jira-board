import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './TetrisGame.css';

const STATS_KEY = 'tetris_stats';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { bestScore: 0, gamesPlayed: 0, totalScore: 0, totalLines: 0 };
}

function saveStats(score, linesCleared) {
  const prev = loadStats();
  const next = {
    bestScore: Math.max(prev.bestScore, score),
    gamesPlayed: prev.gamesPlayed + 1,
    totalScore: prev.totalScore + score,
    totalLines: prev.totalLines + linesCleared,
  };
  localStorage.setItem(STATS_KEY, JSON.stringify(next));
  return next;
}

export default function TetrisGame() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  const holdCanvasRef = useRef(null);
  const stateRef = useRef(null);

  const initEngine = useCallback((canvas, nextCvs, holdCvs) => {
    const ctx = canvas.getContext('2d');
    const nextCtx = nextCvs.getContext('2d');
    const holdCtx = holdCvs.getContext('2d');

    const COLS = 10, ROWS = 20;
    const CELL = Math.min(Math.floor((window.innerHeight * 0.78) / ROWS), 34);
    const W = COLS * CELL, H = ROWS * CELL;
    canvas.width = W; canvas.height = H;

    const COLORS = {
      I:'#00F5FF', O:'#FFE000', T:'#BF00FF',
      S:'#00FF6A', Z:'#FF2244', J:'#FF8C00', L:'#1E90FF'
    };
    const GLOWS = {
      I:'rgba(0,245,255,0.7)', O:'rgba(255,224,0,0.7)', T:'rgba(191,0,255,0.7)',
      S:'rgba(0,255,106,0.7)', Z:'rgba(255,34,68,0.7)', J:'rgba(255,140,0,0.7)', L:'rgba(30,144,255,0.7)'
    };
    const PIECES = {
      I:{ shape:[[1,1,1,1]], color:'I' },
      O:{ shape:[[1,1],[1,1]], color:'O' },
      T:{ shape:[[0,1,0],[1,1,1]], color:'T' },
      S:{ shape:[[0,1,1],[1,1,0]], color:'S' },
      Z:{ shape:[[1,1,0],[0,1,1]], color:'Z' },
      J:{ shape:[[1,0,0],[1,1,1]], color:'J' },
      L:{ shape:[[0,0,1],[1,1,1]], color:'L' },
    };
    const PIECE_KEYS = Object.keys(PIECES);
    const SCORE_TABLE = [0,100,300,500,800];

    let audioCtx;
    function getAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx;
    }
    function playTone(freq, type, dur, vol=0.18, startTime=0) {
      try {
        const ac = getAudio();
        const t = ac.currentTime + startTime;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.type = type; osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
      } catch(e) { /* ignore */ }
    }
    function soundMove()   { playTone(220, 'square', 0.06, 0.07); }
    function soundRotate() { playTone(440, 'triangle', 0.08, 0.1); }
    function soundLand()   { playTone(130, 'sawtooth', 0.12, 0.15); }
    function soundClear(n) {
      const freqs = [523, 659, 784, 1047];
      for (let i = 0; i < n; i++) playTone(freqs[i] || 1047, 'sine', 0.18, 0.25, i*0.07);
    }
    function soundTetris() {
      [523,659,784,1047,1319].forEach((f,i) => playTone(f,'sine',0.2,0.3,i*0.06));
    }
    function soundGameOver() {
      [440,370,311,262,220,185].forEach((f,i) => playTone(f,'sawtooth',0.2,0.2,i*0.1));
    }
    function soundLevelUp() {
      [523,659,784,1047,1319,1047,784,659,523].forEach((f,i) => playTone(f,'square',0.15,0.2,i*0.05));
    }
    function soundHardDrop() { playTone(90, 'square', 0.1, 0.2); }

    let board, current, next, held, holdUsed;
    let score, level, lines, gameRunning, paused, animId;
    let bag = [];

    function newBag() {
      const b = [...PIECE_KEYS];
      for (let i = b.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];
      }
      return b;
    }
    function nextFromBag() {
      if (!bag.length) bag = newBag();
      return bag.pop();
    }
    function makePiece(key) {
      const p = PIECES[key];
      return { shape: p.shape.map(r=>[...r]), color: p.color, key, x: Math.floor((COLS - p.shape[0].length)/2), y: 0 };
    }
    function rotate(shape) {
      const R=shape.length, C=shape[0].length;
      const out = Array.from({length:C}, ()=>Array(R).fill(0));
      for (let r=0;r<R;r++) for (let c=0;c<C;c++) out[c][R-1-r]=shape[r][c];
      return out;
    }
    function collides(piece, ox=0, oy=0, shape=null) {
      const s = shape || piece.shape;
      for (let r=0;r<s.length;r++) for (let c=0;c<s[r].length;c++) {
        if (!s[r][c]) continue;
        const nx=piece.x+c+ox, ny=piece.y+r+oy;
        if (nx<0||nx>=COLS||ny>=ROWS) return true;
        if (ny>=0 && board[ny][nx]) return true;
      }
      return false;
    }
    function lock(piece) {
      piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
        if (v) { const ny=piece.y+r, nx=piece.x+c; if (ny>=0) board[ny][nx]=piece.color; }
      }));
    }
    function clearLines() {
      let cleared=0;
      for (let r=ROWS-1;r>=0;r--) {
        if (board[r].every(v=>v)) { board.splice(r,1); board.unshift(Array(COLS).fill(0)); cleared++; r++; }
      }
      return cleared;
    }
    function ghostY(piece) {
      let gy=0;
      while (!collides(piece,0,gy+1)) gy++;
      return gy;
    }

    // roundRect polyfill
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
        this.beginPath(); this.moveTo(x+r,y); this.lineTo(x+w-r,y);
        this.arcTo(x+w,y,x+w,y+r,r); this.lineTo(x+w,y+h-r);
        this.arcTo(x+w,y+h,x+w-r,y+h,r); this.lineTo(x+r,y+h);
        this.arcTo(x,y+h,x,y+h-r,r); this.lineTo(x,y+r);
        this.arcTo(x,y,x+r,y,r); this.closePath(); return this;
      };
    }

    /* DOM refs for HUD */
    const scoreEl = document.getElementById('tt-score');
    const levelEl = document.getElementById('tt-level');
    const linesEl = document.getElementById('tt-lines');
    const overlayEl = document.getElementById('tt-overlay');
    const overlayTitleEl = document.getElementById('tt-overlayTitle');
    const overlaySubEl = document.getElementById('tt-overlaySub');
    const finalScoreEl = document.getElementById('tt-finalScore');
    const startBtnEl = document.getElementById('tt-startBtn');
    const levelFlashEl = document.getElementById('tt-levelFlash');
    const lineClearFlashEl = document.getElementById('tt-lineClearFlash');

    function updateUI() {
      if (scoreEl) scoreEl.textContent = score.toLocaleString();
      if (levelEl) levelEl.textContent = level;
      if (linesEl) linesEl.textContent = lines;
    }

    function drawCell(ctx2, x, y, color, size=CELL, ghost=false) {
      const pad=1;
      if (ghost) {
        ctx2.fillStyle = 'rgba(255,255,255,0.07)';
        ctx2.strokeStyle = COLORS[color];
        ctx2.lineWidth = 1;
        ctx2.beginPath(); ctx2.roundRect(x*size+pad, y*size+pad, size-pad*2, size-pad*2, 2);
        ctx2.fill(); ctx2.stroke();
        return;
      }
      ctx2.shadowBlur = 8; ctx2.shadowColor = GLOWS[color];
      ctx2.fillStyle = COLORS[color];
      ctx2.beginPath(); ctx2.roundRect(x*size+pad, y*size+pad, size-pad*2, size-pad*2, 2);
      ctx2.fill(); ctx2.shadowBlur=0;
      ctx2.fillStyle='rgba(255,255,255,0.25)';
      ctx2.fillRect(x*size+pad+2, y*size+pad+2, size-pad*2-4, 3);
      ctx2.fillStyle='rgba(0,0,0,0.25)';
      ctx2.fillRect(x*size+pad+2, y*size+size-pad-4, size-pad*2-4, 3);
    }

    function drawBoard() {
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
      for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
        ctx.fillStyle='rgba(255,255,255,0.02)'; ctx.fillRect(c*CELL,r*CELL,CELL,CELL);
        if (board[r][c]) drawCell(ctx,c,r,board[r][c]);
      }
      if (current) {
        const gy=ghostY(current);
        if (gy>0) current.shape.forEach((row,r)=>row.forEach((v,c)=>{
          if (v) drawCell(ctx,current.x+c,current.y+r+gy,current.color,CELL,true);
        }));
        current.shape.forEach((row,r)=>row.forEach((v,c)=>{
          if (v && current.y+r>=0) drawCell(ctx,current.x+c,current.y+r,current.color);
        }));
      }
      ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=0.5;
      for(let c=1;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*CELL,0);ctx.lineTo(c*CELL,H);ctx.stroke();}
      for(let r=1;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*CELL);ctx.lineTo(W,r*CELL);ctx.stroke();}
    }

    function drawMiniPiece(ctx2, shape, color, cw, ch) {
      ctx2.clearRect(0,0,cw,ch);
      ctx2.fillStyle='rgba(0,0,0,0.4)'; ctx2.fillRect(0,0,cw,ch);
      if (!color) return;
      const sz=20, rows=shape.length, cols=shape[0].length;
      const ox=Math.floor((cw/sz-cols)/2), oy=Math.floor((ch/sz-rows)/2);
      shape.forEach((row,r)=>row.forEach((v,c)=>{
        if(v) drawCell(ctx2,ox+c,oy+r,color,sz,false);
      }));
    }

    function drawNext() {
      const p=PIECES[next];
      drawMiniPiece(nextCtx,p.shape,p.color,96,96);
    }
    function drawHold() {
      if(held){ const p=PIECES[held]; drawMiniPiece(holdCtx,p.shape,p.color,96,96); }
      else { holdCtx.clearRect(0,0,96,96); holdCtx.fillStyle='rgba(0,0,0,0.4)'; holdCtx.fillRect(0,0,96,96); }
    }

    function flashClear() {
      if (!lineClearFlashEl) return;
      lineClearFlashEl.classList.remove('tt-flash');
      void lineClearFlashEl.offsetWidth;
      lineClearFlashEl.classList.add('tt-flash');
    }
    function flashLevel() {
      if (!levelFlashEl) return;
      levelFlashEl.classList.remove('tt-show');
      void levelFlashEl.offsetWidth;
      levelFlashEl.classList.add('tt-show');
    }

    function spawn() {
      current = makePiece(next);
      next = nextFromBag();
      holdUsed = false;
      drawNext();
      if (collides(current)) { endGame(); return false; }
      return true;
    }

    let lastDrop;
    function getDropInterval() { return Math.max(50, 1000 - (level-1)*90); }

    function init() {
      board = Array.from({length:ROWS},()=>Array(COLS).fill(0));
      score=0; level=1; lines=0;
      held=null; holdUsed=false; bag=newBag();
      next = nextFromBag();
      updateUI();
      drawHold();
      spawn();
      lastDrop = performance.now();
    }

    function tryHold() {
      if(holdUsed) return;
      holdUsed=true;
      const prev=held;
      held=current.key;
      drawHold();
      if(prev){ current=makePiece(prev); }
      else { current=makePiece(next); next=nextFromBag(); drawNext(); }
      soundRotate();
    }

    const KICKS = {
      normal:[[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,-1]],
      I:[[0,0],[-2,0],[1,0],[-2,-1],[1,2]]
    };

    function tryRotate(dir=1) {
      const s=current.shape;
      let ns=rotate(s); if(dir<0){ ns=rotate(rotate(rotate(s))); }
      const kicks=current.key==='I'?KICKS.I:KICKS.normal;
      for(const[kx,ky] of kicks) {
        if(!collides(current,kx,ky,ns)){
          current.shape=ns; current.x+=kx; current.y+=ky;
          soundRotate(); return;
        }
      }
    }

    function placePiece() {
      soundLand();
      lock(current);
      const cleared=clearLines();
      if(cleared>0) {
        if(cleared===4) soundTetris(); else soundClear(cleared);
        flashClear();
        score+=SCORE_TABLE[cleared]*level;
        lines+=cleared;
        const newLevel=Math.floor(lines/10)+1;
        if(newLevel>level){ level=newLevel; soundLevelUp(); flashLevel(); }
        updateUI();
      }
      spawn();
    }

    function hardDrop() {
      const dy=ghostY(current);
      current.y+=dy;
      score+=dy*2;
      updateUI();
      soundHardDrop();
      placePiece();
      lastDrop=performance.now();
    }

    function endGame() {
      gameRunning=false;
      soundGameOver();
      saveStats(score, lines);
      setTimeout(()=>{
        if (overlayTitleEl) { overlayTitleEl.textContent='GAME OVER'; overlayTitleEl.classList.add('tt-gameover'); }
        if (overlaySubEl) overlaySubEl.textContent='Better luck next time!';
        if (finalScoreEl) { finalScoreEl.textContent=score.toLocaleString(); finalScoreEl.style.display='block'; }
        if (startBtnEl) startBtnEl.textContent='PLAY AGAIN';
        if (overlayEl) overlayEl.classList.remove('tt-hidden');
      },600);
    }

    function step(now) {
      if(!gameRunning||paused) { animId=requestAnimationFrame(step); return; }
      if(now-lastDrop>getDropInterval()) {
        if(!collides(current,0,1)) { current.y++; }
        else { placePiece(); }
        lastDrop=now;
      }
      drawBoard();
      animId=requestAnimationFrame(step);
    }

    function startGame() {
      if (overlayEl) overlayEl.classList.add('tt-hidden');
      if (finalScoreEl) finalScoreEl.style.display='none';
      if (overlayTitleEl) { overlayTitleEl.textContent='TETRIS'; overlayTitleEl.classList.remove('tt-gameover'); }
      if (overlaySubEl) overlaySubEl.textContent='Classic Block Stacker';
      if (startBtnEl) startBtnEl.textContent='START GAME';
      if(animId) cancelAnimationFrame(animId);
      gameRunning=true; paused=false;
      init();
      lastDrop=performance.now();
      animId=requestAnimationFrame(step);
    }

    // Initial idle draw
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);

    stateRef.current = {
      startGame,
      tryRotate,
      tryHold,
      hardDrop,
      soundMove,
      getGameRunning: () => gameRunning,
      getPaused: () => paused,
      setPaused: (v) => { paused = v; },
      getCurrent: () => current,
      setCurrent: (c) => { current = c; },
      collides,
      placePiece,
      setLastDrop: (v) => { lastDrop = v; },
      drawBoard,
      getW: () => W,
      getH: () => H,
      destroy: () => { if (animId) cancelAnimationFrame(animId); },
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const nextCvs = nextCanvasRef.current;
    const holdCvs = holdCanvasRef.current;
    if (!canvas || !nextCvs || !holdCvs) return;
    initEngine(canvas, nextCvs, holdCvs);

    const onKey = (e) => {
      const gs = stateRef.current;
      if (!gs) return;
      if (!gs.getGameRunning()) return;

      switch (e.code) {
        case 'ArrowLeft':
          if (!gs.collides(gs.getCurrent(),-1,0)) { gs.getCurrent().x--; gs.soundMove(); }
          e.preventDefault(); break;
        case 'ArrowRight':
          if (!gs.collides(gs.getCurrent(),1,0)) { gs.getCurrent().x++; gs.soundMove(); }
          e.preventDefault(); break;
        case 'ArrowDown':
          if (!gs.collides(gs.getCurrent(),0,1)) { gs.getCurrent().y++; gs.setLastDrop(performance.now()); }
          else gs.placePiece();
          e.preventDefault(); break;
        case 'ArrowUp': case 'KeyX':
          gs.tryRotate(1); e.preventDefault(); break;
        case 'KeyZ':
          gs.tryRotate(-1); e.preventDefault(); break;
        case 'Space':
          gs.hardDrop(); e.preventDefault(); break;
        case 'KeyC':
          gs.tryHold(); e.preventDefault(); break;
        case 'KeyP': {
          const wasPaused = gs.getPaused();
          gs.setPaused(!wasPaused);
          if (!wasPaused) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,gs.getW(),gs.getH());
            ctx.fillStyle='#fff'; ctx.font='bold 24px Orbitron,monospace'; ctx.textAlign='center';
            ctx.fillText('PAUSED',gs.getW()/2,gs.getH()/2);
          }
          break;
        }
        default: break;
      }
    };
    document.addEventListener('keydown', onKey);

    let tSX = null, tSY = null, tST = null;
    const onTouchStart = (e) => { tSX=e.touches[0].clientX; tSY=e.touches[0].clientY; tST=Date.now(); };
    const onTouchEnd = (e) => {
      if (tSX === null) return;
      const gs = stateRef.current;
      if (!gs || !gs.getGameRunning()) return;
      const dx=e.changedTouches[0].clientX-tSX;
      const dy=e.changedTouches[0].clientY-tSY;
      const dt=Date.now()-tST;
      if(Math.abs(dx)>Math.abs(dy)){
        if(Math.abs(dx)>20){
          if (dx>0) { if(!gs.collides(gs.getCurrent(),1,0)){ gs.getCurrent().x++; gs.soundMove(); }}
          else { if(!gs.collides(gs.getCurrent(),-1,0)){ gs.getCurrent().x--; gs.soundMove(); }}
        }
      } else {
        if(dy>30 && dt<300) gs.hardDrop();
        else if(dy<-20) gs.tryRotate(1);
      }
      if(Math.abs(dx)<10 && Math.abs(dy)<10 && dt<200) gs.tryRotate(1);
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
    <div className="tt-page">
      <div className="tt-bg-grid" />

      <div className="tt-topbar">
        <button className="tt-back-btn" onClick={() => navigate('/games')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Games
        </button>
      </div>

      <div className="tt-wrapper">
        <div className="tt-title">Tetris</div>

        <div className="tt-game-area">
          {/* Left panel */}
          <div className="tt-side-panel">
            <div className="tt-panel-box">
              <div className="tt-panel-label">Score</div>
              <div className="tt-panel-value" id="tt-score">0</div>
            </div>
            <div className="tt-panel-box">
              <div className="tt-panel-label">Level</div>
              <div className="tt-panel-value" id="tt-level">1</div>
            </div>
            <div className="tt-panel-box">
              <div className="tt-panel-label">Lines</div>
              <div className="tt-panel-value" id="tt-lines">0</div>
            </div>
            <div className="tt-panel-box">
              <div className="tt-panel-label">Hold</div>
              <canvas ref={holdCanvasRef} className="tt-mini-canvas" width="96" height="96" />
            </div>
          </div>

          {/* Main canvas */}
          <div className="tt-canvas-container">
            <canvas ref={canvasRef} className="tt-game-canvas" />
            <div className="tt-line-clear-flash" id="tt-lineClearFlash" />
            <div className="tt-level-flash" id="tt-levelFlash">LEVEL UP</div>

            {/* Overlay */}
            <div className="tt-overlay" id="tt-overlay">
              <div className="tt-overlay-title" id="tt-overlayTitle">TETRIS</div>
              <div className="tt-overlay-sub" id="tt-overlaySub">Classic Block Stacker</div>
              <div className="tt-final-score" id="tt-finalScore" style={{ display: 'none' }} />
              <button className="tt-start-btn" id="tt-startBtn" onClick={handleStart}>START GAME</button>
              <div className="tt-controls-hint">
                ← → MOVE &nbsp;|&nbsp; ↑ / Z ROTATE<br/>
                ↓ SOFT DROP &nbsp;|&nbsp; SPACE HARD DROP<br/>
                C HOLD &nbsp;|&nbsp; P PAUSE
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="tt-side-panel">
            <div className="tt-panel-box">
              <div className="tt-panel-label">Next</div>
              <canvas ref={nextCanvasRef} className="tt-mini-canvas" width="96" height="96" />
            </div>
            <div className="tt-panel-box" style={{ marginTop: 4 }}>
              <div className="tt-panel-label tt-panel-keys">
                ← → Move<br/>
                ↑/Z Rotate<br/>
                ↓ Soft<br/>
                Spc Hard<br/>
                C Hold<br/>
                P Pause
              </div>
            </div>
          </div>
        </div>

        <div className="tt-hint">← → Move · ↑ Rotate · ↓ Soft Drop · Space Hard Drop · C Hold · P Pause</div>
      </div>
    </div>
  );
}
