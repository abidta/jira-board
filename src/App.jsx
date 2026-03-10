import React from 'react';
import { useJiraOAuth } from './hooks/useJiraOAuth';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

function App() {
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

export default App;
