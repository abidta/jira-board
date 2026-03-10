import React from 'react';
import { isPast } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import './CompactListView.css';

export function CompactListView({ issues, jiraBaseUrl, onIssueClick }) {
  return (
    <div className="compact-list-wrapper">
      <div className="list-container">
        {issues.map(issue => {
          const isOverdue = issue.fields?.duedate && isPast(new Date(issue.fields.duedate)) && issue.fields.status?.statusCategory?.key !== 'done';
          const statusCat = issue.fields?.status?.statusCategory?.colorName || 'blue-gray';
          
          return (
            <div key={issue.key} className="list-row clickable-row" onClick={() => onIssueClick(issue)}>
              <div className="list-col-status" title={issue.fields?.status?.name}>
                <span className={`status-dot color-${statusCat}`}></span>
              </div>
              
              <div className="list-col-key" title="Issue Key">
                <a 
                  href={`${jiraBaseUrl}/browse/${issue.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="issue-key-link-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  {issue.key}
                </a>
              </div>

              <div className="list-col-main" title={issue.fields?.summary}>
                {issue.fields?.summary}
              </div>

              <div className="list-col-project">
                <span className="project-tag">{issue.fields?.project?.name}</span>
              </div>
              
              <div className={`list-col-date ${isOverdue ? 'overdue' : ''}`} title={issue.fields?.duedate ? new Date(issue.fields.duedate).toLocaleString() : ''}>
                {issue.fields?.duedate ? (
                  <>
                    {isOverdue && <AlertTriangle size={12} />}
                    {issue.fields.duedate}
                  </>
                ) : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
