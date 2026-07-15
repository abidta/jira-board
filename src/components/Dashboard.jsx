import React, { useState, useMemo, useEffect } from 'react';
import { useJiraIssues } from '../hooks/useJiraIssues';
import { useJiraWorklogs } from '../hooks/useJiraWorklogs';
import { useTheme } from '../hooks/useTheme';
import { TopBar } from './TopBar';
import { FullTableView } from './FullTableView';
import { CompactListView } from './CompactListView';
import { IssueDetailModal } from './IssueDetailModal';
import { Analytics } from './Analytics';
import { LayoutGrid } from 'lucide-react';
import './Dashboard.css';

export function Dashboard({ credentials, onLogout, onSessionExpired }) {
  const { issues, loading, error, lastSynced, refetch, userProfile } = useJiraIssues(credentials, { onSessionExpired });
  const { worklogs, loading: worklogsLoading } = useJiraWorklogs(credentials, issues, { onSessionExpired });
  const { theme, toggleTheme } = useTheme();
  
  const [view, setView] = useState(() => {
    return localStorage.getItem('jira_view_pref') || 'table';
  });

  const [selectedIssue, setSelectedIssue] = useState(null);
  
  // Calculate Base URL once for child link generation
  const jiraBaseUrl = useMemo(() => {
    if (credentials?.siteUrl) return credentials.siteUrl;
    if (credentials?.siteName) return `https://${credentials.siteName}.atlassian.net`;
    return 'https://jira.atlassian.com';
  }, [credentials]);
  
  useEffect(() => {
    localStorage.setItem('jira_view_pref', view);
  }, [view]);

  const [filters, setFilters] = useState(() => {
    const savedFilters = localStorage.getItem('jira_filters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (typeof parsed.status === 'string') {
          parsed.status = parsed.status ? [parsed.status] : [];
        }
        if (typeof parsed.project === 'string') {
          parsed.project = parsed.project ? [parsed.project] : [];
        }
        // Ensure mode fields exist for backwards compatibility
        if (!parsed.statusMode) parsed.statusMode = 'include';
        if (!parsed.projectMode) parsed.projectMode = 'include';
        if (parsed.showCompleted === undefined) parsed.showCompleted = false;
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved filters", e);
      }
    }
    return {
      search: '',
      status: [],
      statusMode: 'include',
      project: [],
      projectMode: 'include',
      priority: '',
      showCompleted: false
    };
  });


  useEffect(() => {
    localStorage.setItem('jira_filters', JSON.stringify(filters));
  }, [filters]);

  const statuses = useMemo(() => {
    const s = new Set();
    issues.forEach(i => { if (i.fields?.status?.name) s.add(i.fields.status.name); });
    return Array.from(s).sort();
  }, [issues]);

  const projects = useMemo(() => {
    const p = new Set();
    issues.forEach(i => { if (i.fields?.project?.name) p.add(i.fields.project.name); });
    return Array.from(p).sort();
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const summary = issue.fields?.summary?.toLowerCase() || '';
      const key = issue.key?.toLowerCase() || '';
      const status = issue.fields?.status?.name || '';
      const project = issue.fields?.project?.name || '';
      
      const q = filters.search.toLowerCase();
      
      if (q && !summary.includes(q) && !key.includes(q)) return false;
      
      // Hide completed issues unless showCompleted is enabled
      if (!filters.showCompleted && issue.fields?.status?.statusCategory?.key === 'done') return false;
      
      // Status filter — supports include and exclude modes
      if (filters.status && filters.status.length > 0) {
        if (filters.statusMode === 'exclude') {
          if (filters.status.includes(status)) return false;
        } else {
          if (!filters.status.includes(status)) return false;
        }
      }
      
      // Project filter — supports include and exclude modes
      if (filters.project && filters.project.length > 0) {
        if (filters.projectMode === 'exclude') {
          if (filters.project.includes(project)) return false;
        } else {
          if (!filters.project.includes(project)) return false;
        }
      }
      
      return true;
    });
  }, [issues, filters]);

  const doneCount = useMemo(() => {
    return issues.filter(i => i.fields?.status?.statusCategory?.key === 'done').length;
  }, [issues]);

  return (
    <div className="dashboard-container">
      <TopBar 
        credentials={credentials} 
        onLogout={onLogout} 
        view={view}
        setView={setView}
        lastSynced={lastSynced}
        onRefresh={refetch}
        loading={loading}
        filters={filters}
        setFilters={setFilters}
        statuses={statuses}
        projects={projects}
        userProfile={userProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
        doneCount={doneCount}
      />
      
      <main className="dashboard-content">
        {error && (
          <div className="error-state">
            <p className="error-msg">{error}</p>
            <button onClick={onLogout} className="btn-primary">Return to Login</button>
          </div>
        )}
        
        {!error && loading && issues.length === 0 && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Fetching issues securely from Atlassian API...</p>
          </div>
        )}
        
        {!error && !loading && issues.length === 0 && (
          <div className="empty-state">
            <LayoutGrid size={48} className="empty-icon" />
            <h3>No issues assigned to you.</h3>
            <p>You're all caught up! Time to take a break or grab a coffee.</p>
            <button onClick={refetch} className="btn-primary">Refresh Issues</button>
          </div>
        )}

        {view === 'analytics' && issues.length > 0 && (
          <div className="view-transition-wrapper analytics">
            <Analytics
              issues={issues}
              worklogs={worklogs}
              worklogsLoading={worklogsLoading}
              userAccountId={userProfile?.accountId}
            />
          </div>
        )}

        {view !== 'analytics' && filteredIssues.length > 0 && (
          <div className={`view-transition-wrapper ${view}`}>
            {view === 'table' ? (
              <FullTableView 
                issues={filteredIssues} 
                jiraBaseUrl={jiraBaseUrl} 
                onIssueClick={setSelectedIssue} 
              />
            ) : (
              <CompactListView 
                issues={filteredIssues} 
                jiraBaseUrl={jiraBaseUrl} 
                onIssueClick={setSelectedIssue} 
              />
            )}
          </div>
        )}


        
        {selectedIssue && (
          <IssueDetailModal 
            issue={selectedIssue} 
            jiraBaseUrl={jiraBaseUrl} 
            onClose={() => setSelectedIssue(null)} 
          />
        )}
      </main>
    </div>
  );
}
