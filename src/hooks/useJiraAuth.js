import { useState } from 'react';

export function useJiraAuth() {
  const [credentials, setCredentials] = useState(() => {
    const stored = localStorage.getItem('jira_credentials');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (email, token, baseUrl) => {
    // Basic validation & formatting
    const formattedUrl = baseUrl.replace(/\/$/, '');
    const data = { email, token, baseUrl: formattedUrl };
    localStorage.setItem('jira_credentials', JSON.stringify(data));
    setCredentials(data);
  };

  const logout = () => {
    localStorage.removeItem('jira_credentials');
    setCredentials(null);
  };

  return { credentials, login, logout, isAuthenticated: !!credentials };
}
