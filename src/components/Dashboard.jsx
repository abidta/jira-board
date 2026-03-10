import React, { useState, useMemo, useEffect } from 'react';
import { useJiraIssues } from '../hooks/useJiraIssues';
import { TopBar } from './TopBar';
import { FullTableView } from './FullTableView';
import { CompactListView } from './CompactListView';
import { IssueDetailModal } from './IssueDetailModal';
import { LayoutGrid } from 'lucide-react';
import './Dashboard.css';

export function Dashboard({ credentials, onLogout }) {
  const { issues, loading, error, lastSynced, refetch } = useJiraIssues(credentials);
  
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
        return JSON.parse(savedFilters);
      } catch (e) {
        console.error("Failed to parse saved filters", e);
      }
    }
    return {
      search: '',
      status: '',
      project: '',
      priority: '',
      showCompleted: true
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
      if (filters.status && status !== filters.status) return false;
      if (filters.project && project !== filters.project) return false;
      
      return true;
    });
  }, [issues, filters]);

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

        {filteredIssues.length > 0 && (
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
