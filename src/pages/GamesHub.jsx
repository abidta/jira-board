import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GamesHub.css';

const GAMES = [
  {
    id: 'snake',
    path: '/games/snake',
    title: 'Snake',
    description: 'Classic snake — eat, grow, survive. Navigate through the grid without hitting the walls or yourself.',
    icon: '🐍',
    color: '#00ff6a',
    colorDim: 'rgba(0, 255, 106, 0.08)',
    colorBorder: 'rgba(0, 255, 106, 0.2)',
    statsKey: 'snake_stats',
    statLabel: 'Best Score',
    statExtractor: (raw) => {
      try { return JSON.parse(raw)?.bestScore ?? 0; } catch { return 0; }
    },
  },
  {
    id: 'tetris',
    path: '/games/tetris',
    title: 'Tetris',
    description: 'Stack, clear, survive. Rotate and drop tetrominoes to clear lines before the board fills up.',
    icon: '🧱',
    color: '#00F5FF',
    colorDim: 'rgba(0, 245, 255, 0.08)',
    colorBorder: 'rgba(0, 245, 255, 0.2)',
    statsKey: 'tetris_stats',
    statLabel: 'Best Score',
    statExtractor: (raw) => {
      try { return JSON.parse(raw)?.bestScore ?? 0; } catch { return 0; }
    },
  },
];

function GameCard({ game }) {
  const navigate = useNavigate();
  const rawStats = localStorage.getItem(game.statsKey);
  const stat = game.statExtractor(rawStats);

  return (
    <div
      className="game-card"
      style={{ '--game-color': game.color, '--game-color-dim': game.colorDim, '--game-color-border': game.colorBorder }}
      onClick={() => navigate(game.path)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(game.path)}
    >
      <div className="game-card-glow" />
      <div className="game-card-icon">{game.icon}</div>
      <div className="game-card-body">
        <h2 className="game-card-title">{game.title}</h2>
        <p className="game-card-desc">{game.description}</p>
      </div>
      <div className="game-card-footer">
        <div className="game-stat">
          <span className="game-stat-label">{game.statLabel}</span>
          <span className="game-stat-value">{stat}</span>
        </div>
        <div className="game-play-btn">
          <span>Play</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 2l10 6-10 6V2z" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function GamesHub() {
  const navigate = useNavigate();

  return (
    <div className="games-hub">
      <div className="games-hub-bg" />

      <header className="games-header">
        <button className="games-back-btn" onClick={() => navigate('/')}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
        <div className="games-header-title">
          <span className="games-header-icon">🎮</span>
          <div>
            <h1>Game Arcade</h1>
            <p>Pick a game and play — your stats are saved automatically.</p>
          </div>
        </div>
      </header>

      <main className="games-grid-section">
        <div className="games-grid">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}

          {/* Coming Soon placeholder */}
          <div className="game-card game-card--soon">
            <div className="game-card-icon" style={{ opacity: 0.3 }}>🃏</div>
            <div className="game-card-body">
              <h2 className="game-card-title" style={{ opacity: 0.4 }}>More Coming Soon</h2>
              <p className="game-card-desc" style={{ opacity: 0.3 }}>New games are on their way. Stay tuned!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
