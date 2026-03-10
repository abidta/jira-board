import { useState, useCallback, useEffect } from 'react';

export function useJiraIssues(oauthCredentials) {
  const [issues, setIssues] = useState(() => {
    const cached = localStorage.getItem('jira_issues_cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSynced, setLastSynced] = useState(() => {
    return localStorage.getItem('jira_last_sync') || null;
  });

  const [userProfile, setUserProfile] = useState(() => {
    const cached = localStorage.getItem('jira_user_profile');
    return cached ? JSON.parse(cached) : null;
  });

  const fetchIssues = useCallback(async () => {
    if (!oauthCredentials || !oauthCredentials.accessToken || !oauthCredentials.cloudId) return;
    setLoading(true);
    setError(null);

    const { accessToken, cloudId } = oauthCredentials;
    
    // Check if token is expired
    if (oauthCredentials.expiresAt && Date.now() > oauthCredentials.expiresAt) {
       setError("Your session has expired. Please log out and reconnect with Atlassian.");
       setLoading(false);
       return;
    }

    const jql = 'assignee=currentUser() ORDER BY updated DESC';
    const fields = 'summary,status,priority,duedate,project,issuetype,updated,created,description,reporter,timetracking';
    const maxResults = 100;
    
    const query = new URLSearchParams({
      jql,
      maxResults: maxResults.toString(),
      fields
    });
    
    // New OAuth API endpoint using api.atlassian.com and cloudId
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?${query.toString()}`;
    const myselfUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`;

    try {
      const [response, myselfResponse] = await Promise.all([
        fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }),
        fetch(myselfUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
      ]);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed or token expired. Please log out and reconnect.');
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const mappedIssues = data.issues || [];
      
      setIssues(mappedIssues);
      localStorage.setItem('jira_issues_cache', JSON.stringify(mappedIssues));
      
      if (myselfResponse.ok) {
        const myselfData = await myselfResponse.json();
        setUserProfile(myselfData);
        localStorage.setItem('jira_user_profile', JSON.stringify(myselfData));
      }
      
      const syncTime = new Date().toISOString();
      setLastSynced(syncTime);
      localStorage.setItem('jira_last_sync', syncTime);
      
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
         setError('Network error preventing connection to Atlassian API.');
      } else {
         setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [oauthCredentials]);

  useEffect(() => {
    if (issues.length === 0 && oauthCredentials) {
      fetchIssues();
    }
  }, [oauthCredentials, fetchIssues, issues.length]);

  return {
    issues,
    userProfile,
    loading,
    error,
    lastSynced,
    refetch: fetchIssues
  };
}
