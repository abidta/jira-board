import React from 'react';
import { Search, List, LayoutGrid, RefreshCw, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import './TopBar.css';

export function TopBar({ 
  credentials, 
  onLogout, 
  view, 
  setView, 
  lastSynced, 
  onRefresh, 
  loading,
  filters,
  setFilters,
  statuses,
  projects
}) {
  const handleSearchChange = (e) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handleStatusChange = (e) => {
    setFilters(prev => ({ ...prev, status: e.target.value }));
  };

  const handleProjectChange = (e) => {
    setFilters(prev => ({ ...prev, project: e.target.value }));
  };

  const syncText = lastSynced ? `Synced ${formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}` : 'Not synced yet';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo">
          <h1>JiraBoard</h1>
        </div>
        {credentials?.siteName && (
          <div className="site-badge" title="Connected Workspace">
            {credentials.siteName}
          </div>
        )}
      </div>

      <div className="topbar-center">
        <div className={`search-bar ${filters.search ? 'filter-active' : ''}`}>
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search issues by title or key..." 
            value={filters.search}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="filters">
          <select 
            value={filters.status} 
            onChange={handleStatusChange} 
            className={`filter-select ${filters.status ? 'filter-active' : ''}`}
          >
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <select 
            value={filters.project} 
            onChange={handleProjectChange} 
            className={`filter-select hide-mobile ${filters.project ? 'filter-active' : ''}`}
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="topbar-right">
        <div className="view-toggle">
          <button 
            className={`view-btn ${view === 'table' ? 'active' : ''}`} 
            onClick={() => setView('table')}
            title="Full Table View"
          >
            <LayoutGrid size={16} />
          </button>
          <button 
            className={`view-btn ${view === 'list' ? 'active' : ''}`} 
            onClick={() => setView('list')}
            title="Compact List View"
          >
            <List size={16} />
          </button>
        </div>

        <div className="sync-status">
          <span className="sync-text">{syncText}</span>
          <button className="refresh-btn" onClick={onRefresh} disabled={loading} title="Refresh Issues">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="user-profile">
          <div className="avatar" title="OAuth User">
            U
          </div>
          <button className="logout-btn" onClick={onLogout} title="Disconnect Atlassian Account">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
