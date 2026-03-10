import React, { useEffect } from 'react';
import { X, ExternalLink, Calendar, User, Tag, AlertTriangle, Clock } from 'lucide-react';
import { format, isPast } from 'date-fns';
import './IssueDetailModal.css';

export function IssueDetailModal({ issue, onClose, jiraBaseUrl }) {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (!issue) return null;

  const { fields, key } = issue;
  const statusCat = fields?.status?.statusCategory?.colorName || 'blue-gray';
  const isOverdue = fields?.duedate && isPast(new Date(fields.duedate)) && fields.status?.statusCategory?.key !== 'done';
  const issueUrl = `${jiraBaseUrl}/browse/${key}`;

  // Jira API returns rich text as ADF (Atlassian Document Format) or raw strings. 
  // For a simple rendering, we attempt to extract plain text if it's ADF, or just stringify.
  const renderDescription = (desc) => {
    if (!desc) return <p className="empty-desc">No description provided.</p>;
    
    // If it's a simple string, return it
    if (typeof desc === 'string') {
      return <p className="raw-text">{desc}</p>;
    }
    
    // If it's ADF format (version 1)
    if (desc.type === 'doc' && Array.isArray(desc.content)) {
      return desc.content.map((block, i) => {
        if (block.type === 'paragraph' && block.content) {
          return (
            <p key={i}>
              {block.content.map((textNode, j) => {
                let text = textNode.text || '';
                if (textNode.marks) {
                  // Apply basic marks like strong, em, etc
                  textNode.marks.forEach(mark => {
                    if (mark.type === 'strong') text = <strong key={`s-${j}`}>{text}</strong>;
                    if (mark.type === 'em') text = <em key={`e-${j}`}>{text}</em>;
                    if (mark.type === 'link') text = <a key={`a-${j}`} href={mark.attrs.href} target="_blank" rel="noreferrer">{text}</a>;
                  });
                }
                return <React.Fragment key={j}>{text}</React.Fragment>;
              })}
            </p>
          );
        }
        if (block.type === 'bulletList' && block.content) {
           return (
             <ul key={i}>
               {block.content.map((listItem, liIdx) => (
                 <li key={liIdx}>
                   {listItem.content?.map((p, pIdx) => p.content?.map(t => t.text).join('') || '')}
                 </li>
               ))}
             </ul>
           );
        }
        return null;
      });
    }

    // Fallback for unknown object formats
    return <pre className="raw-json">{JSON.stringify(desc, null, 2)}</pre>;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="issue-breadcrumbs">
              <span className="project-name">{fields?.project?.name}</span>
              <span className="separator">/</span>
              <a href={issueUrl} target="_blank" rel="noreferrer" className="issue-key-link" title="Open in Jira">
                {key} <ExternalLink size={12} />
              </a>
            </div>
            <h2 className="modal-summary">
              {fields?.issuetype?.iconUrl && (
                <img src={fields.issuetype.iconUrl} alt={fields.issuetype.name} className="type-icon-lg" />
              )}
              {fields?.summary}
            </h2>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-main-content">
            <div className="section-title">Description</div>
            <div className="description-content">
              {renderDescription(fields?.description)}
            </div>
          </div>

          <div className="modal-sidebar">
            <div className="detail-group">
              <label>Status</label>
              <div className="detail-value">
                <span className={`status-badge color-${statusCat}`}>
                  {fields?.status?.name?.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="detail-group">
              <label>Priority</label>
              <div className="detail-value flex-value">
                {fields?.priority?.iconUrl && (
                  <img src={fields.priority.iconUrl} alt={fields.priority.name} className="priority-icon" />
                )}
                {fields?.priority?.name}
              </div>
            </div>

            <div className="detail-group">
              <label>Reporter</label>
              <div className="detail-value flex-value">
                <User size={14} className="icon-muted" />
                {fields?.reporter?.displayName || 'Unknown'}
              </div>
            </div>

            <div className="detail-group">
              <label>Estimated Time</label>
              <div className="detail-value flex-value">
                <Clock size={14} className="icon-muted" />
                {fields?.timetracking?.originalEstimate || 'Not estimated'}
              </div>
            </div>

            <div className="detail-group">
              <label>Due Date</label>
              <div className={`detail-value flex-value ${isOverdue ? 'overdue-text' : ''}`}>
                <Calendar size={14} className="icon-muted" />
                {fields?.duedate ? (
                  <>
                    <span>{format(new Date(fields.duedate), 'MMM d, yyyy')}</span>
                    {isOverdue && <AlertTriangle size={14} className="overdue-icon" />}
                  </>
                ) : (
                  <span className="empty-dash">None</span>
                )}
              </div>
            </div>

            <div className="detail-group">
              <label>Updated</label>
              <div className="detail-value">
                {fields?.updated ? format(new Date(fields.updated), 'MMM d, yyyy h:mm a') : '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <a href={issueUrl} target="_blank" rel="noreferrer" className="btn-primary-link">
            Open in Jira <ExternalLink size={16} style={{marginLeft: '6px'}} />
          </a>
        </div>
      </div>
    </div>
  );
}
