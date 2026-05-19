import { useState, useEffect, useCallback } from 'react';

/**
 * Manages light/dark theme. Persists preference in localStorage.
 * Default: 'dark'
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('jira_theme') || 'dark';
  });

  // Apply the data-theme attribute on mount and on change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jira_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
