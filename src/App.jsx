import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useJiraOAuth } from './hooks/useJiraOAuth';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

// Lazy-load game pages — only fetched when the user navigates there
const GamesHub = lazy(() => import('./pages/GamesHub'));
const SnakeGame = lazy(() => import('./pages/games/SnakeGame'));

function GamesFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1117',
      color: '#4F8EF7',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.9rem',
      letterSpacing: '0.1em',
    }}>
      Loading game...
    </div>
  );
}

function JiraApp() {
  const {
    credentials,
    initiateLogin,
    logout,
    isAuthenticated,
    exchangeToken,
    isExchanging,
    authError
  } = useJiraOAuth();

  return (
    <div className="app-container">
      {isAuthenticated && credentials.cloudId ? (
        <Dashboard credentials={credentials} onLogout={logout} />
      ) : (
        <Login
          onLogin={initiateLogin}
          isExchanging={isExchanging}
          authError={authError}
          exchangeToken={exchangeToken}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Jira app */}
        <Route path="/" element={<JiraApp />} />

        {/* OAuth callback — Atlassian redirects here with ?code=&state= */}
        <Route path="/callback" element={<JiraApp />} />

        {/* Games — lazy loaded */}
        <Route
          path="/games"
          element={
            <Suspense fallback={<GamesFallback />}>
              <GamesHub />
            </Suspense>
          }
        />
        <Route
          path="/games/snake"
          element={
            <Suspense fallback={<GamesFallback />}>
              <SnakeGame />
            </Suspense>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
