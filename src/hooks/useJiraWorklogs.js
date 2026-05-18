import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Fetches actual worklog entries from the Jira REST API for each issue
 * that has time logged, INCLUDING sub-tasks. Each worklog entry contains
 * a `started` date and `timeSpentSeconds`, giving us accurate per-day time data.
 */
export function useJiraWorklogs(oauthCredentials, issues) {
  const [worklogs, setWorklogs] = useState(() => {
    const cached = localStorage.getItem('jira_worklogs_cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchWorklogs = useCallback(async () => {
    if (!oauthCredentials?.accessToken || !oauthCredentials?.cloudId) return;
    if (!issues || issues.length === 0) return;

    // Check token expiry
    if (oauthCredentials.expiresAt && Date.now() > oauthCredentials.expiresAt) return;

    setLoading(true);
    const { accessToken, cloudId } = oauthCredentials;
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    };

    try {
      // Build a set of all issue keys to fetch worklogs for:
      //  1. Issues that directly have time logged
      //  2. Sub-tasks of all returned issues (they may have their own time logged)
      const keysToFetch = new Map(); // key -> { key, projectName }

      issues.forEach(issue => {
        const projectName = issue.fields?.project?.name || 'Unknown';

        // Include if the issue itself has time logged
        if (issue.fields?.timetracking?.timeSpentSeconds > 0) {
          keysToFetch.set(issue.key, { key: issue.key, projectName });
        }

        // Include all sub-tasks — they may have their own worklogs
        const subtasks = issue.fields?.subtasks;
        if (subtasks && Array.isArray(subtasks)) {
          subtasks.forEach(sub => {
            if (sub.key && !keysToFetch.has(sub.key)) {
              keysToFetch.set(sub.key, { key: sub.key, projectName });
            }
          });
        }
      });

      if (keysToFetch.size === 0) {
        setWorklogs([]);
        localStorage.setItem('jira_worklogs_cache', '[]');
        setLoading(false);
        return;
      }

      const issuesToFetch = Array.from(keysToFetch.values());

      // Fetch worklogs in parallel batches of 5 to avoid hammering the API
      const BATCH_SIZE = 5;
      const allWorklogs = [];

      for (let i = 0; i < issuesToFetch.length; i += BATCH_SIZE) {
        const batch = issuesToFetch.slice(i, i + BATCH_SIZE);
        const responses = await Promise.all(
          batch.map(entry =>
            fetch(`${baseUrl}/issue/${entry.key}/worklog?maxResults=100`, { headers })
              .then(res => (res.ok ? res.json() : { worklogs: [] }))
              .catch(() => ({ worklogs: [] }))
          )
        );

        responses.forEach((data, idx) => {
          const issueKey = batch[idx].key;
          const projectName = batch[idx].projectName;
          if (data.worklogs && data.worklogs.length > 0) {
            data.worklogs.forEach(wl => {
              allWorklogs.push({
                issueKey,
                projectName,
                authorAccountId: wl.author?.accountId || '',
                authorName: wl.author?.displayName || 'Unknown',
                started: wl.started,       // ISO date string: "2026-05-12T09:00:00.000+0400"
                timeSpentSeconds: wl.timeSpentSeconds || 0,
                timeSpent: wl.timeSpent || '', // Human readable: "2h 30m"
              });
            });
          }
        });
      }

      setWorklogs(allWorklogs);
      localStorage.setItem('jira_worklogs_cache', JSON.stringify(allWorklogs));
    } catch (err) {
      console.error('Failed to fetch worklogs:', err);
    } finally {
      setLoading(false);
    }
  }, [oauthCredentials, issues]);

  // Auto-fetch when issues are available (once per mount)
  useEffect(() => {
    if (issues?.length > 0 && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchWorklogs();
    }
  }, [issues, fetchWorklogs]);

  return { worklogs, loading, refetch: fetchWorklogs };
}
