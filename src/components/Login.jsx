import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, AlertTriangle, Gamepad2 } from 'lucide-react';
import './Login.css';

export function Login({ onLogin, isExchanging, authError, exchangeToken }) {
  const navigate = useNavigate();
  const [exchangeMsg, setExchangeMsg] = useState('Authenticating with Atlassian...');

  useEffect(() => {
    // Check if we are returning from an OAuth flow
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const storedState = sessionStorage.getItem('oauth_state');

    if (code && state) {
      if (state !== storedState) {
        setExchangeMsg('State mismatch error. Security validation failed.');
        return;
      }
      // Trigger the token exchange
      exchangeToken(code);
    }
  }, [exchangeToken]);

  // If we are currently processing the oauth token exchange
  if (isExchanging || new URLSearchParams(window.location.search).get('code')) {
    return (
      <div className="login-wrapper">
        <div className="login-card exchange-card">
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <h2>{exchangeMsg}</h2>
          <p>Please wait while we connect to your workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon">
            <LayoutGrid size={32} />
          </div>
          <h2>Jira Dashboard</h2>
          <p>Connect to your workspace to view assignments.</p>
        </div>

        {authError && (
          <div className="auth-error">
            <AlertTriangle size={16} />
            {authError}
          </div>
        )}

        <div className="login-form">
          <button type="button" className="login-btn oauth-btn" onClick={onLogin}>
             Connect Jira Workspace
          </button>
          <button type="button" className="login-btn games-btn" onClick={() => navigate('/games')}>
            <Gamepad2 size={18} />
            Game Arcade
          </button>
        </div>
      </div>
    </div>
  );
}
