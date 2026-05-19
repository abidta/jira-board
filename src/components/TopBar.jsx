import React from 'react';
import { Search, List, LayoutGrid, RefreshCw, LogOut, Gamepad2, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { MultiSelect } from './MultiSelect';
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
  projects,
  userProfile
}) {
  const navigate = useNavigate();
  const handleSearchChange = (e) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handleStatusChange = (newStatuses) => {
    setFilters(prev => ({ ...prev, status: newStatuses }));
  };

  const handleProjectChange = (newProjects) => {
    setFilters(prev => ({ ...prev, project: newProjects }));
  };

  const handleStatusModeChange = (newMode) => {
    setFilters(prev => ({ ...prev, statusMode: newMode }));
  };

  const handleProjectModeChange = (newMode) => {
    setFilters(prev => ({ ...prev, projectMode: newMode }));
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
          <MultiSelect 
            options={statuses}
            selected={filters.status || []}
            onChange={handleStatusChange}
            placeholder="All Statuses"
            mode={filters.statusMode || 'include'}
            onModeChange={handleStatusModeChange}
          />
          
          <MultiSelect 
            options={projects}
            selected={filters.project || []}
            onChange={handleProjectChange}
            placeholder="All Projects"
            className="hide-mobile"
            mode={filters.projectMode || 'include'}
            onModeChange={handleProjectModeChange}
          />
        </div>
      </div>

      <div className="topbar-right">
        <button
          className="games-icon-btn"
          onClick={() => navigate('/games')}
          title="Game Arcade"
        >
          <Gamepad2 size={17} />
        </button>

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
          <button 
            className={`view-btn ${view === 'analytics' ? 'active' : ''}`} 
            onClick={() => setView('analytics')}
            title="Analytics Dashboard"
          >
            <BarChart3 size={16} />
          </button>
        </div>

        <div className="sync-status">
          <span className="sync-text">{syncText}</span>
          <button className="refresh-btn" onClick={onRefresh} disabled={loading} title="Refresh Issues">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="user-profile">
          {userProfile ? (
            <>
              <div 
                className="avatar" 
                title={userProfile.displayName}
                style={userProfile.avatarUrls?.['48x48'] ? {
                  backgroundImage: `url(${userProfile.avatarUrls['48x48']})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  color: 'transparent'
                } : {}}
              >
                {!userProfile.avatarUrls?.['48x48'] && userProfile.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="user-name hide-mobile" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {userProfile.displayName}
              </span>
            </>
          ) : (
            <div className="avatar" title="OAuth User">
              U
            </div>
          )}
          <button className="logout-btn" onClick={onLogout} title="Disconnect Atlassian Account">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
