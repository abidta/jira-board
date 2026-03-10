import React, { useState, useMemo } from 'react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Copy, AlertTriangle, ArrowUpDown } from 'lucide-react';
import './FullTableView.css';

export function FullTableView({ issues, jiraBaseUrl, onIssueClick }) {
  const [sortParam, setSortParam] = useState({ key: 'updated', asc: false });

  const handleSort = (key) => {
    setSortParam(prev => ({
      key,
      asc: prev.key === key ? !prev.asc : true,
    }));
  };

  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      let valA, valB;
      switch (sortParam.key) {
        case 'key':
          valA = a.key; valB = b.key; break;
        case 'title':
          valA = a.fields?.summary; valB = b.fields?.summary; break;
        case 'status':
          valA = a.fields?.status?.name; valB = b.fields?.status?.name; break;
        case 'priority':
          valA = a.fields?.priority?.name; valB = b.fields?.priority?.name; break;
        case 'duedate':
          valA = a.fields?.duedate || '9999-12-31'; valB = b.fields?.duedate || '9999-12-31'; break;
        case 'project':
          valA = a.fields?.project?.name; valB = b.fields?.project?.name; break;
        case 'updated':
          valA = new Date(a.fields?.updated).getTime(); valB = new Date(b.fields?.updated).getTime(); break;
        default:
          valA = a.key; valB = b.key;
      }
      
      if (valA < valB) return sortParam.asc ? -1 : 1;
      if (valA > valB) return sortParam.asc ? 1 : -1;
      return 0;
    });
  }, [issues, sortParam]);

  const copyToClipboard = (text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="table-wrapper">
      <table className="issues-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('key')} className="sticky-col">
              <div className="th-content">Key <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
            <th onClick={() => handleSort('title')} style={{ minWidth: '350px' }}>
              <div className="th-content">Title <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
            <th onClick={() => handleSort('status')}>
              <div className="th-content">Status <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
            <th onClick={() => handleSort('priority')}>
              <div className="th-content">Priority <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
            <th onClick={() => handleSort('project')}>
              <div className="th-content">Project <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
            <th onClick={() => handleSort('duedate')}>
              <div className="th-content">Due Date <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
            <th onClick={() => handleSort('updated')}>
              <div className="th-content">Updated <ArrowUpDown size={12} className="sort-icon" /></div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedIssues.map((issue) => {
            const statusCat = issue.fields?.status?.statusCategory?.colorName || 'blue-gray';
            const isOverdue = issue.fields?.duedate && isPast(new Date(issue.fields.duedate)) && issue.fields.status?.statusCategory?.key !== 'done';
            
            return (
              <tr key={issue.key} onClick={() => onIssueClick(issue)} className="clickable-row">
                <td className="sticky-col issue-key">
                  <div className="key-wrapper">
                    <a 
                      href={`${jiraBaseUrl}/browse/${issue.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="issue-key-link-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {issue.key}
                    </a>
                    <button className="copy-btn" onClick={(e) => copyToClipboard(issue.key, e)} title="Copy Key">
                      <Copy size={12} />
                    </button>
                  </div>
                </td>
                <td className="issue-title">
                  <div className="title-row">
                    {issue.fields?.issuetype?.iconUrl && (
                      <img src={issue.fields.issuetype.iconUrl} alt={issue.fields.issuetype.name} className="type-icon" />
                    )}
                    <span className="summary-text">{issue.fields?.summary}</span>
                  </div>
                </td>
                <td>
                  <span className={`status-badge color-${statusCat}`}>
                    {issue.fields?.status?.name?.toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className="priority-cell">
                    {issue.fields?.priority?.iconUrl && (
                      <img src={issue.fields.priority.iconUrl} alt={issue.fields.priority.name} className="priority-icon" />
                    )}
                    {issue.fields?.priority?.name}
                  </div>
                </td>
                <td>
                  <div className="project-cell">
                    {issue.fields?.project?.avatarUrls?.['16x16'] && (
                      <img src={issue.fields.project.avatarUrls['16x16']} alt="" className="project-avatar" />
                    )}
                    <span className="project-name">{issue.fields?.project?.name}</span>
                  </div>
                </td>
                <td className={isOverdue ? 'overdue' : ''}>
                  {issue.fields?.duedate ? (
                    <div className="date-cell">
                      {isOverdue && <AlertTriangle size={14} />}
                      {issue.fields.duedate}
                    </div>
                  ) : <span className="empty-dash">-</span>}
                </td>
                <td className="updated-cell">
                  {formatDistanceToNow(new Date(issue.fields?.updated), { addSuffix: true })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
