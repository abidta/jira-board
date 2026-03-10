import { useState, useCallback, useEffect } from 'react';

// Jira OAuth Configuration
// User must provide VITE_JIRA_CLIENT_ID in their .env
const CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID;
const REDIRECT_URI = window.location.origin + '/callback';
const SCOPES = 'read:jira-work read:jira-user';

function generateRandomString(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  // Base64URL encoding
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function useJiraOAuth() {
  const [credentials, setCredentials] = useState(() => {
    const stored = localStorage.getItem('jira_oauth');
    return stored ? JSON.parse(stored) : null;
  });
  
  const [isExchanging, setIsExchanging] = useState(false);
  const [authError, setAuthError] = useState(null);

  const initiateLogin = async () => {
    if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      alert("Missing VITE_JIRA_CLIENT_ID in .env file!");
      return;
    }

    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_verifier', codeVerifier);

    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.append('audience', 'api.atlassian.com');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('scope', SCOPES);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('prompt', 'consent');
    
    window.location.href = authUrl.toString();
  };

  const exchangeToken = useCallback(async (code) => {
    setIsExchanging(true);
    setAuthError(null);
    
    const codeVerifier = sessionStorage.getItem('oauth_verifier');
    
    if (!codeVerifier) {
      setAuthError("Missing code verifier. Please try logging in again.");
      setIsExchanging(false);
      return;
    }

    try {
      const CLIENT_SECRET = import.meta.env.VITE_JIRA_CLIENT_SECRET;
      
      if (!CLIENT_SECRET) {
        throw new Error("Missing VITE_JIRA_CLIENT_SECRET in .env file. Atlassian requires this for token exchange.");
      }

      const body = {
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI
      };

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log("Token exchange response status:", response.status);
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
          console.error("Token exchange error response:", errorData);
        } catch(e) {
          const text = await response.text();
          console.error("Token exchange raw error text:", text);
        }
        throw new Error(errorData.error_description || errorData.error || 'Failed to exchange authorization code');
      }

      const tokens = await response.json();
      
      // Now fetch accessible resources to get the cloudId
      const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });
      
      if (!resourcesRes.ok) throw new Error("Could not fetch accessible resources.");
      const resources = await resourcesRes.json();
      
      if (resources.length === 0) {
        throw new Error("No Jira sites accessible for this user.");
      }
      
      // Use the first valid Jira site
      const cloudId = resources[0].id;
      const siteName = resources[0].name;
      const siteUrl = resources[0].url;
      
      const newCreds = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        cloudId,
        siteName,
        siteUrl,
        expiresAt: Date.now() + (tokens.expires_in * 1000)
      };

      localStorage.setItem('jira_oauth', JSON.stringify(newCreds));
      setCredentials(newCreds);
      
      // Clean up session
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_verifier');
      
      // Strip code from URL cleanly
      window.history.replaceState({}, document.title, '/');
      
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsExchanging(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('jira_oauth');
    localStorage.removeItem('jira_issues_cache');
    setCredentials(null);
  };

  return { 
    credentials, 
    initiateLogin, 
    logout, 
    isAuthenticated: !!credentials,
    exchangeToken,
    isExchanging,
    authError
  };
}
