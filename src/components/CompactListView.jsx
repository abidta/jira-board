import React, { useState, useMemo } from 'react';
import { format, isToday, isYesterday, isPast } from 'date-fns';
import { Calendar, ChevronDown, ChevronRight, ArrowUpDown, AlertTriangle, Clock, Timer } from 'lucide-react';
import './CompactListView.css';

function formatTimeShort(seconds) {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function getDateLabel(dateStr) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return format(date, 'EEEE'); // e.g. "Wednesday"
  if (date.getFullYear() === now.getFullYear()) return format(date, 'EEE, d MMM'); // e.g. "Wed, 25 Jun"
  return format(date, 'EEE, d MMM yyyy'); // e.g. "Wed, 25 Jun 2024"
}

function getDateKey(dateStr) {
  return format(new Date(dateStr), 'yyyy-MM-dd');
}

export function CompactListView({ issues, jiraBaseUrl, onIssueClick }) {
  const [sortNewest, setSortNewest] = useState(() => {
    const saved = localStorage.getItem('jira_compact_sort');
    return saved !== null ? saved === 'newest' : true;
  });

  const [collapsed, setCollapsed] = useState(new Set());

  const toggleSort = () => {
    const next = !sortNewest;
    setSortNewest(next);
    localStorage.setItem('jira_compact_sort', next ? 'newest' : 'oldest');
  };

  const toggleCollapse = (key) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const dateGroups = useMemo(() => {
    const groups = new Map();
    
    issues.forEach(issue => {
      const created = issue.fields?.created;
      if (!created) return;
      const key = getDateKey(created);
      if (!groups.has(key)) {
        groups.set(key, { key, date: created, label: getDateLabel(created), issues: [] });
      }
      groups.get(key).issues.push(issue);
    });

    // Sort groups by date
    const sorted = Array.from(groups.values()).sort((a, b) => {
      const diff = new Date(b.date) - new Date(a.date);
      return sortNewest ? diff : -diff;
    });

    // Sort issues within each group by creation time (newest first within day)
    sorted.forEach(group => {
      group.issues.sort((a, b) => new Date(b.fields.created) - new Date(a.fields.created));
    });

    return sorted;
  }, [issues, sortNewest]);

  return (
    <div className="timeline-wrapper">
      {/* Summary bar */}
      <div className="timeline-summary-bar">
        <span className="timeline-total-count">
          {issues.length} issue{issues.length !== 1 ? 's' : ''} across {dateGroups.length} day{dateGroups.length !== 1 ? 's' : ''}
        </span>
        <button className="timeline-sort-btn" onClick={toggleSort} title={sortNewest ? 'Showing newest first' : 'Showing oldest first'}>
          <ArrowUpDown size={14} />
          <span>{sortNewest ? 'Newest first' : 'Oldest first'}</span>
        </button>
      </div>

      {/* Timeline groups */}
      <div className="timeline-groups">
        {dateGroups.map(group => {
          const isOpen = !collapsed.has(group.key);
          
          return (
            <div key={group.key} className={`timeline-group ${isOpen ? 'expanded' : 'collapsed-group'}`}>
              {/* Date header */}
              <button
                className="timeline-date-header"
                onClick={() => toggleCollapse(group.key)}
                aria-expanded={isOpen}
              >
                <div className="timeline-date-header-left">
                  <Calendar size={15} className="timeline-calendar-icon" />
                  <span className="timeline-date-label">{group.label}</span>
                  <span className="timeline-issue-count">{group.issues.length}</span>
                </div>
                <div className="timeline-date-header-right">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>

              {/* Collapsible issue list */}
              <div className={`timeline-issues-container ${isOpen ? 'open' : 'closed'}`}>
                <div className="timeline-issues-inner">
                  {group.issues.map((issue, idx) => {
                    const statusCat = issue.fields?.status?.statusCategory?.colorName || 'blue-gray';
                    const isOverdue = issue.fields?.duedate && isPast(new Date(issue.fields.duedate)) && issue.fields.status?.statusCategory?.key !== 'done';
                    const isLast = idx === group.issues.length - 1;

                    return (
                      <div
                        key={issue.key}
                        className={`timeline-issue-card ${isLast ? 'last-in-group' : ''}`}
                        onClick={() => onIssueClick(issue)}
                      >
                        {/* Timeline connector */}
                        <div className="timeline-connector">
                          <span className={`timeline-dot color-${statusCat}`}></span>
                          {!isLast && <span className="timeline-line"></span>}
                        </div>

                        {/* Card content */}
                        <div className="timeline-card-body">
                          <div className="timeline-card-top">
                            <a
                              href={`${jiraBaseUrl}/browse/${issue.key}`}
                              target="_blank"
                              rel="noreferrer"
                              className="timeline-issue-key"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {issue.fields?.issuetype?.iconUrl && (
                                <img src={issue.fields.issuetype.iconUrl} alt="" className="timeline-type-icon" />
                              )}
                              {issue.key}
                            </a>
                            <span className={`status-badge color-${statusCat}`}>
                              {issue.fields?.status?.name?.toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="timeline-card-summary">{issue.fields?.summary}</p>
                          
                          <div className="timeline-card-meta">
                            <span className="timeline-project-tag">
                              {issue.fields?.project?.avatarUrls?.['16x16'] && (
                                <img src={issue.fields.project.avatarUrls['16x16']} alt="" className="timeline-project-avatar" />
                              )}
                              {issue.fields?.project?.name}
                            </span>
                            
                            {issue.fields?.priority && (
                              <span className="timeline-priority" title={issue.fields.priority.name}>
                                {issue.fields.priority.iconUrl && (
                                  <img src={issue.fields.priority.iconUrl} alt="" className="timeline-priority-icon" />
                                )}
                                <span className="timeline-priority-name">{issue.fields.priority.name}</span>
                              </span>
                            )}

                            {/* Time tracking: estimated & logged */}
                            {(() => {
                              const tt = issue.fields?.timetracking;
                              const estSec = tt?.originalEstimateSeconds;
                              const logSec = tt?.timeSpentSeconds;
                              const estLabel = tt?.originalEstimate || formatTimeShort(estSec);
                              const logLabel = tt?.timeSpent || formatTimeShort(logSec);
                              const isOver = estSec && logSec && logSec > estSec;

                              if (!estLabel && !logLabel) return null;

                              return (
                                <span className="timeline-time-tracking">
                                  {estLabel && (
                                    <span className="timeline-tt-chip estimate" title="Estimated">
                                      <Timer size={11} />
                                      {estLabel}
                                    </span>
                                  )}
                                  {logLabel && (
                                    <span className={`timeline-tt-chip logged ${isOver ? 'over-budget' : ''}`} title="Logged">
                                      <Clock size={11} />
                                      {logLabel}
                                    </span>
                                  )}
                                  {estSec > 0 && logSec > 0 && (
                                    <span className="timeline-tt-bar" title={`${Math.round((logSec / estSec) * 100)}% tracked`}>
                                      <span
                                        className={`timeline-tt-bar-fill ${isOver ? 'over-budget' : ''}`}
                                        style={{ width: `${Math.min((logSec / estSec) * 100, 100)}%` }}
                                      />
                                    </span>
                                  )}
                                </span>
                              );
                            })()}

                            {issue.fields?.duedate && (
                              <span className={`timeline-due ${isOverdue ? 'overdue' : ''}`}>
                                {isOverdue && <AlertTriangle size={12} />}
                                Due {issue.fields.duedate}
                              </span>
                            )}

                            <span className="timeline-time">
                              {format(new Date(issue.fields.created), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
