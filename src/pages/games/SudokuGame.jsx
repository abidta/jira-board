import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SudokuGame.css';

// ============================================================
// SUDOKU GENERATOR (pure functions)
// ============================================================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
    if (board[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function fillBoard(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoard(board)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board, limit = 2) {
  let count = 0;
  function search() {
    if (count >= limit) return;
    let bestR = -1, bestC = -1, bestOpts = null, bestLen = 10;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const opts = [];
          for (let n = 1; n <= 9; n++) {
            if (isValid(board, r, c, n)) opts.push(n);
          }
          if (opts.length < bestLen) {
            bestLen = opts.length;
            bestR = r; bestC = c; bestOpts = opts;
            if (bestLen === 0) return;
          }
        }
      }
    }
    if (bestR === -1) { count++; return; }
    for (const num of bestOpts) {
      board[bestR][bestC] = num;
      search();
      board[bestR][bestC] = 0;
      if (count >= limit) return;
    }
  }
  search();
  return count;
}

function generatePuzzle(difficulty) {
  const board = emptyBoard();
  fillBoard(board);
  const solution = board.map(r => [...r]);

  const targets = { easy: 42, medium: 34, hard: 30, expert: 26, legend: 23 };
  const targetClues = targets[difficulty];

  const positions = [];
  for (let i = 0; i < 81; i++) positions.push(i);
  shuffle(positions);

  let clues = 81;
  for (const pos of positions) {
    if (clues <= targetClues) break;
    const r = Math.floor(pos / 9), c = pos % 9;
    const val = board[r][c];
    if (val === 0) continue;
    board[r][c] = 0;
    const test = board.map(row => [...row]);
    if (countSolutions(test, 2) !== 1) {
      board[r][c] = val;
    } else {
      clues--;
    }
  }
  return { puzzle: board, solution, clues };
}

// ============================================================
// SCORES PERSISTENCE
// ============================================================

const SCORES_KEY = 'sudoku_scores';

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    easy: { best: null, won: 0 },
    medium: { best: null, won: 0 },
    hard: { best: null, won: 0 },
    expert: { best: null, won: 0 },
    legend: { best: null, won: 0 },
  };
}

function saveScores(scores) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

// ============================================================
// HELPER
// ============================================================

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'legend'];

// ============================================================
// REACT COMPONENT
// ============================================================

export default function SudokuGame() {
  const navigate = useNavigate();

  // Refs for DOM elements used by the imperative game engine
  const gridRef = useRef(null);
  const numPadRef = useRef(null);
  const timeRef = useRef(null);
  const errRef = useRef(null);
  const modeRef = useRef(null);
  const hintRef = useRef(null);
  const loadingRef = useRef(null);
  const scoreListRef = useRef(null);
  const notesBtnRef = useRef(null);
  const overlayRef = useRef(null);
  const modalTitleRef = useRef(null);
  const modalTextRef = useRef(null);
  const modalTimeRef = useRef(null);
  const modalErrorsRef = useRef(null);
  const modalHintsRef = useRef(null);

  // Keep a single mutable engine ref so cleanup can stop timers
  const engineRef = useRef(null);

  const initEngine = useCallback(() => {
    const grid = gridRef.current;
    const numPad = numPadRef.current;
    const timeVal = timeRef.current;
    const errVal = errRef.current;
    const modeVal = modeRef.current;
    const hintVal = hintRef.current;
    const loading = loadingRef.current;
    const scoreList = scoreListRef.current;
    const notesBtn = notesBtnRef.current;
    const overlay = overlayRef.current;
    if (!grid) return;

    // ---- STATE ----
    const state = {
      difficulty: 'easy',
      puzzle: null,
      solution: null,
      board: null,
      fixed: null,
      notes: null,
      selected: null,
      errors: 0,
      maxErrors: 3,
      hintsLeft: 3,
      hintsUsed: 0,
      noteMode: false,
      timer: 0,
      timerInterval: null,
      startTime: null,
      gameOver: false,
      won: false,
    };

    const scores = loadScores();
    const cellEls = Array.from({ length: 9 }, () => Array(9).fill(null));

    // ---- BUILD GRID ----
    function buildGrid() {
      grid.innerHTML = '';
      for (let boxRow = 0; boxRow < 3; boxRow++) {
        for (let boxCol = 0; boxCol < 3; boxCol++) {
          const box = document.createElement('div');
          box.className = 'sk-box';
          for (let cellRow = 0; cellRow < 3; cellRow++) {
            for (let cellCol = 0; cellCol < 3; cellCol++) {
              const r = boxRow * 3 + cellRow;
              const c = boxCol * 3 + cellCol;
              const cell = document.createElement('div');
              cell.className = 'sk-cell';
              cell.dataset.row = r;
              cell.dataset.col = c;
              cell.addEventListener('click', () => selectCell(r, c));
              box.appendChild(cell);
              cellEls[r][c] = cell;
            }
          }
          grid.appendChild(box);
        }
      }
    }

    function buildNumPad() {
      numPad.innerHTML = '';
      for (let n = 1; n <= 9; n++) {
        const btn = document.createElement('button');
        btn.className = 'sk-num-btn';
        btn.textContent = n;
        btn.dataset.num = n;
        btn.addEventListener('click', () => inputNumber(n));
        numPad.appendChild(btn);
      }
    }

    // ---- RENDERING ----
    function render() {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = cellEls[r][c];
          const val = state.board[r][c];
          const fixed = state.fixed[r][c];

          cell.classList.remove('selected', 'peer', 'same-value', 'fixed', 'user', 'error');
          cell.innerHTML = '';

          if (val !== 0) {
            cell.textContent = val;
            cell.classList.add(fixed ? 'fixed' : 'user');
            if (!fixed && val !== state.solution[r][c]) {
              cell.classList.add('error');
            }
          } else if (state.notes[r][c].size > 0) {
            const ng = document.createElement('div');
            ng.className = 'sk-notes-grid';
            for (let i = 1; i <= 9; i++) {
              const note = document.createElement('div');
              note.className = 'sk-note';
              if (state.notes[r][c].has(i)) note.textContent = i;
              ng.appendChild(note);
            }
            cell.appendChild(ng);
          }

          if (state.selected) {
            const [sr, sc] = state.selected;
            const selVal = state.board[sr][sc];
            if (r === sr && c === sc) {
              cell.classList.add('selected');
            } else if (r === sr || c === sc ||
              (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))) {
              cell.classList.add('peer');
            }
            if (selVal !== 0 && val === selVal && !(r === sr && c === sc)) {
              cell.classList.remove('peer');
              cell.classList.add('same-value');
            }
          }
        }
      }

      // Number pad exhausted
      const counts = Array(10).fill(0);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (state.board[r][c] !== 0 && state.board[r][c] === state.solution[r][c]) {
            counts[state.board[r][c]]++;
          }
        }
      }
      Array.from(numPad.children).forEach(btn => {
        const n = parseInt(btn.dataset.num);
        btn.classList.toggle('exhausted', counts[n] >= 9);
      });

      // Stats
      errVal.textContent = state.errors + '/' + state.maxErrors;
      errVal.classList.toggle('danger', state.errors >= 2);
      modeVal.textContent = state.difficulty[0].toUpperCase() + state.difficulty.slice(1);
      hintVal.textContent = state.hintsLeft;

      notesBtn.classList.toggle('active', state.noteMode);
      notesBtn.innerHTML = state.noteMode
        ? '✎ Notes <span style="opacity:0.7;font-size:10px;">ON</span>'
        : '✎ Notes <span style="opacity:0.5;font-size:10px;">OFF</span>';

      renderScoreboard();
    }

    function renderScoreboard() {
      scoreList.innerHTML = '';
      DIFFICULTIES.forEach(d => {
        const row = document.createElement('div');
        row.className = 'sk-score-row';
        const best = scores[d].best !== null ? formatTime(scores[d].best) : '—';
        const isCurrent = d === state.difficulty;
        row.innerHTML = `
          <div class="sk-score-diff${isCurrent ? ' current' : ''}">${d}</div>
          <div class="sk-score-time">${best}</div>
          <div class="sk-score-games">${scores[d].won}</div>
        `;
        scoreList.appendChild(row);
      });
    }

    // ---- INTERACTIONS ----
    function selectCell(r, c) {
      if (state.gameOver) return;
      state.selected = [r, c];
      render();
    }

    function inputNumber(n) {
      if (state.gameOver || !state.selected) return;
      const [r, c] = state.selected;
      if (state.fixed[r][c]) return;

      if (state.noteMode) {
        if (state.board[r][c] !== 0) return;
        if (state.notes[r][c].has(n)) state.notes[r][c].delete(n);
        else state.notes[r][c].add(n);
      } else {
        state.notes[r][c].clear();
        if (state.board[r][c] === n) {
          state.board[r][c] = 0;
        } else {
          state.board[r][c] = n;
          if (n !== state.solution[r][c]) {
            state.errors++;
            if (state.errors >= state.maxErrors) {
              render();
              setTimeout(() => endGame(false), 250);
              return;
            }
          } else {
            clearNotesPeers(r, c, n);
            cellEls[r][c].classList.add('pulse');
            setTimeout(() => cellEls[r][c].classList.remove('pulse'), 600);
            if (isComplete()) {
              render();
              setTimeout(() => endGame(true), 350);
              return;
            }
          }
        }
      }
      render();
    }

    function clearNotesPeers(r, c, n) {
      for (let i = 0; i < 9; i++) {
        state.notes[r][i].delete(n);
        state.notes[i][c].delete(n);
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) {
          state.notes[rr][cc].delete(n);
        }
      }
    }

    function eraseCell() {
      if (state.gameOver || !state.selected) return;
      const [r, c] = state.selected;
      if (state.fixed[r][c]) return;
      state.board[r][c] = 0;
      state.notes[r][c].clear();
      render();
    }

    function useHint() {
      if (state.gameOver || state.hintsLeft <= 0) return;
      const candidates = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!state.fixed[r][c] && state.board[r][c] !== state.solution[r][c]) {
            candidates.push([r, c]);
          }
        }
      }
      if (candidates.length === 0) return;

      let target = null;
      if (state.selected) {
        const [sr, sc] = state.selected;
        if (!state.fixed[sr][sc] && state.board[sr][sc] !== state.solution[sr][sc]) {
          target = [sr, sc];
        }
      }
      if (!target) target = candidates[Math.floor(Math.random() * candidates.length)];

      const [r, c] = target;
      state.board[r][c] = state.solution[r][c];
      state.notes[r][c].clear();
      state.fixed[r][c] = true;
      state.hintsLeft--;
      state.hintsUsed++;
      clearNotesPeers(r, c, state.solution[r][c]);
      cellEls[r][c].classList.add('pulse');
      setTimeout(() => cellEls[r][c].classList.remove('pulse'), 600);

      if (isComplete()) {
        setTimeout(() => endGame(true), 400);
        render();
        return;
      }
      render();
    }

    function isComplete() {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (state.board[r][c] !== state.solution[r][c]) return false;
        }
      }
      return true;
    }

    function toggleNoteMode() {
      state.noteMode = !state.noteMode;
      render();
    }

    // ---- GAME FLOW ----
    function startTimer() {
      state.timer = 0;
      state.startTime = Date.now();
      timeVal.textContent = '00:00';
      clearInterval(state.timerInterval);
      state.timerInterval = setInterval(() => {
        state.timer = Math.floor((Date.now() - state.startTime) / 1000);
        timeVal.textContent = formatTime(state.timer);
      }, 250);
    }

    function stopTimer() {
      clearInterval(state.timerInterval);
    }

    function endGame(won) {
      state.gameOver = true;
      state.won = won;
      stopTimer();

      let isBest = false;
      if (won) {
        scores[state.difficulty].won++;
        if (scores[state.difficulty].best === null || state.timer < scores[state.difficulty].best) {
          scores[state.difficulty].best = state.timer;
          isBest = true;
        }
        saveScores(scores);
      }

      const title = modalTitleRef.current;
      const text = modalTextRef.current;
      if (title) {
        title.textContent = won ? 'Solved!' : 'Game Over';
        title.className = won ? 'win' : 'lose';
      }

      if (text) {
        if (won) {
          if (isBest && scores[state.difficulty].won > 1) text.textContent = 'A new personal best.';
          else if (state.errors === 0 && state.hintsUsed === 0) text.textContent = 'Flawless. Beautifully done.';
          else text.textContent = 'Beautiful work.';
        } else {
          text.textContent = 'Three mistakes. The puzzle wins this round.';
        }
      }

      if (modalTimeRef.current) {
        modalTimeRef.current.textContent = formatTime(state.timer);
        modalTimeRef.current.classList.toggle('best', isBest);
      }
      if (modalErrorsRef.current) modalErrorsRef.current.textContent = state.errors;
      if (modalHintsRef.current) modalHintsRef.current.textContent = state.hintsUsed;

      overlay.classList.add('show');
      render();
    }

    async function newGame() {
      overlay.classList.remove('show');
      stopTimer();
      state.gameOver = false;
      state.won = false;
      state.errors = 0;
      state.hintsLeft = 3;
      state.hintsUsed = 0;
      state.selected = null;
      state.noteMode = false;
      state.timer = 0;
      timeVal.textContent = '00:00';

      loading.classList.add('show');
      await new Promise(r => setTimeout(r, 40));

      const { puzzle, solution } = generatePuzzle(state.difficulty);
      state.puzzle = puzzle.map(r => [...r]);
      state.solution = solution.map(r => [...r]);
      state.board = puzzle.map(r => [...r]);
      state.fixed = puzzle.map(row => row.map(v => v !== 0));
      state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));

      loading.classList.remove('show');
      startTimer();
      render();
    }

    function setDifficulty(diff) {
      if (diff === state.difficulty) return;
      state.difficulty = diff;
      newGame();
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        overlay.classList.remove('show');
        return;
      }
      if (state.gameOver) return;
      if (e.key >= '1' && e.key <= '9') {
        inputNumber(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        eraseCell();
      } else if (e.key === 'n' || e.key === 'N') {
        toggleNoteMode();
      } else if (e.key === 'h' || e.key === 'H') {
        useHint();
      } else if (e.key.startsWith('Arrow')) {
        let [r, c] = state.selected || [4, 4];
        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
        if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
        if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
        selectCell(r, c);
        e.preventDefault();
      }
    }

    // ---- INIT ----
    buildGrid();
    buildNumPad();
    renderScoreboard();
    newGame();

    document.addEventListener('keydown', handleKeyDown);

    // Expose API for React event handlers + cleanup
    engineRef.current = {
      setDifficulty,
      newGame,
      eraseCell,
      useHint,
      toggleNoteMode,
      closeOverlay: () => overlay.classList.remove('show'),
      destroy: () => {
        stopTimer();
        document.removeEventListener('keydown', handleKeyDown);
      },
      getDifficulty: () => state.difficulty,
    };
  }, []);

  useEffect(() => {
    initEngine();
    return () => {
      engineRef.current?.destroy();
    };
  }, [initEngine]);

  // React event handler helpers
  const handleDiffClick = (diff) => engineRef.current?.setDifficulty(diff);
  const handleNewGame = () => engineRef.current?.newGame();
  const handleErase = () => engineRef.current?.eraseCell();
  const handleHint = () => engineRef.current?.useHint();
  const handleToggleNotes = () => engineRef.current?.toggleNoteMode();
  const handleCloseOverlay = () => engineRef.current?.closeOverlay();

  return (
    <div className="sk-page">
      <div className="sk-topbar">
        <button className="sk-back-btn" onClick={() => navigate('/games')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Games
        </button>
      </div>

      <div className="sk-container">
        <header className="sk-header">
          <h1 className="sk-title">SUD<span className="sk-o">O</span>KU</h1>
          <p className="sk-tagline">— Numbers · Logic · Peace of Mind —</p>
        </header>

        <div className="sk-difficulty-row">
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              className={`sk-diff-btn${d === 'easy' ? ' active' : ''}`}
              data-diff={d}
              onClick={(e) => {
                // Toggle active class on difficulty buttons
                e.currentTarget.parentElement.querySelectorAll('.sk-diff-btn')
                  .forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                handleDiffClick(d);
              }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        <div className="sk-game-area">
          <div>
            <div className="sk-stats-bar">
              <div className="sk-stat">
                <div className="sk-stat-label">Time</div>
                <div className="sk-stat-value" ref={timeRef}>00:00</div>
              </div>
              <div className="sk-stat">
                <div className="sk-stat-label">Mistakes</div>
                <div className="sk-stat-value" ref={errRef}>0/3</div>
              </div>
              <div className="sk-stat">
                <div className="sk-stat-label">Mode</div>
                <div className="sk-stat-value" ref={modeRef}>Easy</div>
              </div>
              <div className="sk-stat">
                <div className="sk-stat-label">Hints</div>
                <div className="sk-stat-value" ref={hintRef}>3</div>
              </div>
            </div>

            <div className="sk-grid-wrapper">
              <div className="sk-grid" ref={gridRef}></div>
              <div className="sk-loading" ref={loadingRef}>
                <div>
                  <span className="sk-loading-dot"></span>
                  <span className="sk-loading-dot"></span>
                  <span className="sk-loading-dot"></span>
                </div>
                <div className="sk-loading-text">Crafting a puzzle</div>
              </div>
            </div>

            <div className="sk-key-hints">
              <kbd>1</kbd>–<kbd>9</kbd> place &nbsp; <kbd>Del</kbd> erase &nbsp; <kbd>N</kbd> notes &nbsp; <kbd>H</kbd> hint &nbsp; <kbd>←↑↓→</kbd> move
            </div>
          </div>

          <div className="sk-controls-panel">
            <div className="sk-number-pad" ref={numPadRef}></div>
            <div className="sk-action-row">
              <button className="sk-action-btn" ref={notesBtnRef} onClick={handleToggleNotes}>
                ✎ Notes <span style={{ opacity: 0.5, fontSize: '10px' }}>OFF</span>
              </button>
              <button className="sk-action-btn" onClick={handleErase}>⌫ Erase</button>
              <button className="sk-action-btn" onClick={handleHint}>💡 Hint</button>
              <button className="sk-action-btn primary" onClick={handleNewGame}>↻ New Game</button>
            </div>

            <div className="sk-scoreboard">
              <h2>Scoreboard</h2>
              <div className="sk-score-row head">
                <div className="sk-score-diff">Level</div>
                <div className="sk-score-time">Best</div>
                <div className="sk-score-games">Won</div>
              </div>
              <div ref={scoreListRef}></div>
            </div>
          </div>
        </div>

        <footer className="sk-footer">React · Vite — Sudoku Puzzle Game</footer>
      </div>

      {/* Modal overlay */}
      <div className="sk-overlay" ref={overlayRef}>
        <div className="sk-modal">
          <button className="sk-modal-close" onClick={handleCloseOverlay}>×</button>
          <h2 ref={modalTitleRef} className="win">Solved!</h2>
          <p ref={modalTextRef}>Beautiful work.</p>
          <div className="sk-modal-stats">
            <div className="sk-modal-stat">
              <div className="sk-modal-stat-label">Time</div>
              <div className="sk-modal-stat-value" ref={modalTimeRef}>00:00</div>
            </div>
            <div className="sk-modal-stat">
              <div className="sk-modal-stat-label">Mistakes</div>
              <div className="sk-modal-stat-value" ref={modalErrorsRef}>0</div>
            </div>
            <div className="sk-modal-stat">
              <div className="sk-modal-stat-label">Hints</div>
              <div className="sk-modal-stat-value" ref={modalHintsRef}>0</div>
            </div>
          </div>
          <button className="sk-action-btn primary" style={{ width: '100%' }} onClick={handleNewGame}>↻ New Puzzle</button>
        </div>
      </div>
    </div>
  );
}
