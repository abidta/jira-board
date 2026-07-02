import { useState, useCallback, useEffect, useRef } from 'react';

const PAGE_SIZE = 50;

export function useJiraIssues(oauthCredentials, { onSessionExpired, showCompleted = false } = {}) {
  const [issues, setIssues] = useState(() => {
    const cached = localStorage.getItem('jira_issues_cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastSynced, setLastSynced] = useState(() => {
    return localStorage.getItem('jira_last_sync') || null;
  });
  const [totalAvailable, setTotalAvailable] = useState(0);

  const [userProfile, setUserProfile] = useState(() => {
    const cached = localStorage.getItem('jira_user_profile');
    return cached ? JSON.parse(cached) : null;
  });

  // Track the last showCompleted value used for fetching
  const lastFetchRef = useRef({ showCompleted: null });

  const buildJql = useCallback((includeCompleted) => {
    let jql = 'assignee=currentUser()';
    if (!includeCompleted) {
      jql += ' AND statusCategory != Done';
    }
    jql += ' ORDER BY updated DESC';
    return jql;
  }, []);

  // Fetch a single page — supports both cursor (nextPageToken) and offset (startAt) pagination
  const fetchPage = useCallback(async (accessToken, cloudId, jql, { nextPageToken, startAt } = {}) => {
    const fields = 'summary,status,priority,duedate,project,issuetype,updated,created,description,reporter,timetracking,subtasks';
    
    const params = {
      jql,
      maxResults: PAGE_SIZE.toString(),
      fields
    };

    // Use cursor token if available, otherwise fall back to offset
    if (nextPageToken) {
      params.nextPageToken = nextPageToken;
    } else if (startAt) {
      params.startAt = startAt.toString();
    }
    
    const query = new URLSearchParams(params);
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?${query.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw { status: 401, message: 'Authentication failed or token expired.' };
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      issues: data.issues || [],
      // Cursor-based: nextPageToken present means more pages
      nextPageToken: data.nextPageToken || null,
      // Offset-based fallback: total from response
      total: data.total || 0,
    };
  }, []);

  const fetchIssues = useCallback(async () => {
    if (!oauthCredentials || !oauthCredentials.accessToken || !oauthCredentials.cloudId) return;
    setLoading(true);
    setError(null);

    const { accessToken, cloudId } = oauthCredentials;
    
    // Check if token is expired — auto-redirect to Atlassian login
    if (oauthCredentials.expiresAt && Date.now() > oauthCredentials.expiresAt) {
       if (onSessionExpired) {
         setLoading(false);
         onSessionExpired();
         return;
       }
       setError("Your session has expired. Please log out and reconnect with Atlassian.");
       setLoading(false);
       return;
    }

    const jql = buildJql(showCompleted);
    const myselfUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`;

    try {
      const [firstPage, myselfResponse] = await Promise.all([
        fetchPage(accessToken, cloudId, jql),
        fetch(myselfUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
      ]);

      // Render first page immediately
      let allIssues = [...firstPage.issues];
      setIssues(allIssues);
      setTotalAvailable(firstPage.total || allIssues.length);
      lastFetchRef.current.showCompleted = showCompleted;
      
      if (myselfResponse.ok) {
        const myselfData = await myselfResponse.json();
        setUserProfile(myselfData);
        localStorage.setItem('jira_user_profile', JSON.stringify(myselfData));
      }
      
      const syncTime = new Date().toISOString();
      setLastSynced(syncTime);
      localStorage.setItem('jira_last_sync', syncTime);

      // Auto-fetch remaining pages in the background
      let cursor = firstPage.nextPageToken;
      if (cursor) {
        setLoading(false);
        setLoadingMore(true);

        while (cursor) {
          const nextPage = await fetchPage(accessToken, cloudId, jql, { nextPageToken: cursor });
          allIssues = [...allIssues, ...nextPage.issues];
          setIssues([...allIssues]);
          setTotalAvailable(nextPage.total || allIssues.length);
          cursor = nextPage.nextPageToken;
          if (nextPage.issues.length === 0) break; // safety
        }
        
        setLoadingMore(false);
      }
      
      // Final total is the actual count we got
      setTotalAvailable(allIssues.length);
      localStorage.setItem('jira_issues_cache', JSON.stringify(allIssues));
      
    } catch (err) {
      if (err.status === 401 && onSessionExpired) {
        onSessionExpired();
        return;
      }
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
         setError('Network error preventing connection to Atlassian API.');
      } else {
         setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [oauthCredentials, onSessionExpired, showCompleted, buildJql, fetchPage]);

  // Initial fetch
  useEffect(() => {
    if (issues.length === 0 && oauthCredentials) {
      fetchIssues();
    }
  }, [oauthCredentials, fetchIssues, issues.length]);

  // Re-fetch when showCompleted changes
  useEffect(() => {
    if (oauthCredentials && lastFetchRef.current.showCompleted !== null && lastFetchRef.current.showCompleted !== showCompleted) {
      fetchIssues();
    }
  }, [showCompleted, oauthCredentials, fetchIssues]);

  return {
    issues,
    userProfile,
    loading,
    loadingMore,
    error,
    lastSynced,
    refetch: fetchIssues,
    totalAvailable
  };
}
