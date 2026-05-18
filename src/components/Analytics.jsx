import React, { useMemo } from 'react';
import { differenceInDays, format, startOfDay, subDays, parseISO, isValid } from 'date-fns';
import {
  Clock, FolderKanban, AlertTriangle, CheckCircle2, Timer,
  TrendingUp, BarChart3, Activity, Flame, Calendar, Loader2
} from 'lucide-react';
import './Analytics.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(colorName) {
  const map = {
    'blue-gray': { bg: 'rgba(139,146,165,0.15)', fg: '#8b92a5', border: 'rgba(139,146,165,0.3)' },
    'green':     { bg: 'rgba(46,160,67,0.15)',   fg: '#3fb950', border: 'rgba(46,160,67,0.3)' },
    'yellow':    { bg: 'rgba(210,153,34,0.15)',  fg: '#d29922', border: 'rgba(210,153,34,0.3)' },
    'blue':      { bg: 'rgba(79,142,247,0.15)',  fg: '#4F8EF7', border: 'rgba(79,142,247,0.3)' },
  };
  return map[colorName] || map['blue-gray'];
}

const PROJECT_PALETTE = [
  '#4F8EF7', '#f472b6', '#34d399', '#fbbf24', '#a78bfa',
  '#fb923c', '#22d3ee', '#f87171', '#60a5fa', '#c084fc',
  '#2dd4bf', '#facc15',
];

function parseJiraSeconds(seconds) {
  if (!seconds || typeof seconds !== 'number') return 0;
  return seconds;
}

function formatHours(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0 && m === 0) return '0h';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatHoursDecimal(totalSeconds) {
  return (totalSeconds / 3600).toFixed(1);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, subtext, accentColor, delay }) {
  return (
    <div className="analytics-metric-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="metric-icon" style={{ color: accentColor, backgroundColor: `${accentColor}18` }}>
        <Icon size={20} />
      </div>
      <div className="metric-info">
        <span className="metric-value">{value}</span>
        <span className="metric-label">{label}</span>
        {subtext && <span className="metric-subtext">{subtext}</span>}
      </div>
    </div>
  );
}

function BarChartSection({ data, title, icon: Icon, formatValue, maxVal }) {
  if (!data || data.length === 0) return null;
  const max = maxVal || Math.max(...data.map(d => d.value), 1);

  return (
    <div className="analytics-card bar-chart-card">
      <div className="card-header">
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      <div className="bar-chart">
        {data.map((item, i) => (
          <div className="bar-row" key={item.label} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="bar-label">{item.label}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max((item.value / max) * 100, 2)}%`,
                  background: item.color || 'var(--accent-blue)',
                }}
                title={formatValue ? formatValue(item.value) : item.value}
              />
            </div>
            <span className="bar-value">{formatValue ? formatValue(item.value) : item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ segments, centerLabel, centerValue }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  let cumulativePercent = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 100 100" className="donut-svg">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashArray = `${pct * circumference} ${circumference}`;
          const offset = -cumulativePercent * circumference;
          cumulativePercent += pct;
          return (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="8"
              strokeDasharray={dashArray}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="donut-segment"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <span className="donut-center-value">{centerValue}</span>
        <span className="donut-center-label">{centerLabel}</span>
      </div>
    </div>
  );
}

function HeatmapGrid({ data, title, icon: Icon }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="analytics-card heatmap-card">
      <div className="card-header">
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      <div className="heatmap-grid">
        {data.map((cell, i) => {
          const intensity = cell.value / max;
          return (
            <div
              key={i}
              className="heatmap-cell"
              style={{
                backgroundColor: `rgba(79,142,247,${Math.max(intensity * 0.8, 0.06)})`,
                animationDelay: `${i * 30}ms`,
              }}
              title={`${cell.label}: ${cell.value} issues`}
            >
              <span className="heatmap-day">{cell.shortLabel}</span>
              <span className="heatmap-count">{cell.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Analytics Component ────────────────────────────────────────────────

export function Analytics({ issues, worklogs = [], worklogsLoading = false, userAccountId }) {
  // ── Key Metrics ────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total = issues.length;
    let overdue = 0;
    let done = 0;
    let totalAgeSeconds = 0;
    let totalTimeEstimated = 0;
    const now = new Date();

    issues.forEach(issue => {
      const status = issue.fields?.status?.statusCategory?.key;
      const dueDate = issue.fields?.duedate;

      if (status === 'done') done++;
      if (dueDate && new Date(dueDate) < now && status !== 'done') overdue++;

      const created = issue.fields?.created ? new Date(issue.fields.created) : null;
      if (created && isValid(created)) {
        totalAgeSeconds += (now - created) / 1000;
      }

      const timeEstimate = parseJiraSeconds(issue.fields?.timetracking?.originalEstimateSeconds);
      totalTimeEstimated += timeEstimate;
    });

    // Use real worklog data for total time spent (filtered to current user if available)
    let totalTimeSpent = 0;
    if (worklogs.length > 0) {
      worklogs.forEach(wl => {
        if (!userAccountId || wl.authorAccountId === userAccountId) {
          totalTimeSpent += wl.timeSpentSeconds || 0;
        }
      });
    } else {
      // Fallback to issue-level timetracking if worklogs haven't loaded yet
      issues.forEach(issue => {
        totalTimeSpent += parseJiraSeconds(issue.fields?.timetracking?.timeSpentSeconds);
      });
    }

    const avgAgeDays = total > 0 ? Math.round(totalAgeSeconds / total / 86400) : 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const inProgress = total - done;

    return {
      total, overdue, done, inProgress, avgAgeDays,
      completionRate, totalTimeSpent, totalTimeEstimated,
    };
  }, [issues, worklogs, userAccountId]);

  // ── Project Distribution ───────────────────────────────────────────────

  const projectData = useMemo(() => {
    const counts = {};
    issues.forEach(issue => {
      const name = issue.fields?.project?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        label: name,
        value: count,
        color: PROJECT_PALETTE[i % PROJECT_PALETTE.length],
      }));
  }, [issues]);

  // ── Status Distribution ────────────────────────────────────────────────

  const statusData = useMemo(() => {
    const counts = {};
    const colors = {};
    issues.forEach(issue => {
      const name = issue.fields?.status?.name || 'Unknown';
      const colorName = issue.fields?.status?.statusCategory?.colorName || 'blue-gray';
      counts[name] = (counts[name] || 0) + 1;
      colors[name] = getStatusColor(colorName);
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        label: name,
        value: count,
        color: colors[name].fg,
        bg: colors[name].bg,
        border: colors[name].border,
      }));
  }, [issues]);

  // ── Priority Breakdown ─────────────────────────────────────────────────

  const priorityData = useMemo(() => {
    const priorityColors = {
      'Highest': '#f85149',
      'High':    '#fb923c',
      'Medium':  '#fbbf24',
      'Low':     '#34d399',
      'Lowest':  '#8b92a5',
    };
    const counts = {};
    issues.forEach(issue => {
      const name = issue.fields?.priority?.name || 'None';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => {
        const order = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .map(([name, count]) => ({
        label: name,
        value: count,
        color: priorityColors[name] || '#8b92a5',
      }));
  }, [issues]);

  // ── Daily Time Logged from real worklogs (last 14 days) ────────────────

  const dailyTimeData = useMemo(() => {
    const dayMap = {};
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      dayMap[format(d, 'yyyy-MM-dd')] = 0;
    }

    // Use actual worklog entries — each has its own `started` date
    worklogs.forEach(wl => {
      // Only count current user's worklogs if we know the user
      if (userAccountId && wl.authorAccountId !== userAccountId) return;

      if (wl.started && wl.timeSpentSeconds > 0) {
        const dateKey = format(new Date(wl.started), 'yyyy-MM-dd');
        if (dateKey in dayMap) {
          dayMap[dateKey] += wl.timeSpentSeconds;
        }
      }
    });

    return Object.entries(dayMap).map(([dateStr, seconds]) => ({
      label: format(parseISO(dateStr), 'MMM d'),
      shortLabel: format(parseISO(dateStr), 'EEE'),
      value: seconds,
    }));
  }, [worklogs, userAccountId]);

  // ── Time Logged by Project (from worklogs) ─────────────────────────────

  const timeByProjectData = useMemo(() => {
    const projectMap = {};
    worklogs.forEach(wl => {
      if (userAccountId && wl.authorAccountId !== userAccountId) return;
      const project = wl.projectName || 'Unknown';
      projectMap[project] = (projectMap[project] || 0) + (wl.timeSpentSeconds || 0);
    });
    return Object.entries(projectMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, seconds], i) => ({
        label: name,
        value: seconds,
        color: PROJECT_PALETTE[i % PROJECT_PALETTE.length],
      }));
  }, [worklogs, userAccountId]);

  // ── Activity Heatmap (last 14 days — issues updated) ───────────────────

  const activityData = useMemo(() => {
    const dayMap = {};
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      const key = format(d, 'yyyy-MM-dd');
      dayMap[key] = { label: format(d, 'MMM d'), shortLabel: format(d, 'EEE'), value: 0 };
    }

    issues.forEach(issue => {
      const updated = issue.fields?.updated;
      if (updated) {
        const dateKey = format(new Date(updated), 'yyyy-MM-dd');
        if (dayMap[dateKey]) {
          dayMap[dateKey].value++;
        }
      }
    });

    return Object.values(dayMap);
  }, [issues]);

  // ── Issue Type Breakdown ───────────────────────────────────────────────

  const issueTypeData = useMemo(() => {
    const counts = {};
    issues.forEach(issue => {
      const name = issue.fields?.issuetype?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        label: name,
        value: count,
        color: PROJECT_PALETTE[(i + 3) % PROJECT_PALETTE.length],
      }));
  }, [issues]);

  // ── Recently Overdue ───────────────────────────────────────────────────

  const overdueIssues = useMemo(() => {
    const now = new Date();
    return issues
      .filter(issue => {
        const dueDate = issue.fields?.duedate;
        const status = issue.fields?.status?.statusCategory?.key;
        return dueDate && new Date(dueDate) < now && status !== 'done';
      })
      .sort((a, b) => new Date(a.fields.duedate) - new Date(b.fields.duedate))
      .slice(0, 5);
  }, [issues]);

  // ── Render ─────────────────────────────────────────────────────────────

  const hasTimeData = dailyTimeData.some(d => d.value > 0);
  const hasWorklogData = worklogs.length > 0;

  return (
    <div className="analytics-container">
      {/* ── KPI Metrics Row ────────────────────────────────────────── */}
      <section className="analytics-metrics-row">
        <MetricCard icon={FolderKanban} label="Total Issues" value={metrics.total}
          subtext={`${metrics.inProgress} active`} accentColor="#4F8EF7" delay={0} />
        <MetricCard icon={CheckCircle2} label="Completion Rate" value={`${metrics.completionRate}%`}
          subtext={`${metrics.done} done`} accentColor="#3fb950" delay={80} />
        <MetricCard icon={AlertTriangle} label="Overdue" value={metrics.overdue}
          subtext={metrics.overdue > 0 ? 'Need attention' : 'All on track'}
          accentColor={metrics.overdue > 0 ? '#f85149' : '#3fb950'} delay={160} />
        <MetricCard icon={Calendar} label="Avg. Age" value={`${metrics.avgAgeDays}d`}
          subtext="Per issue" accentColor="#a78bfa" delay={240} />
        <MetricCard icon={Timer} label="Time Logged" value={formatHours(metrics.totalTimeSpent)}
          subtext={metrics.totalTimeEstimated > 0 ? `Est. ${formatHours(metrics.totalTimeEstimated)}` : 'No estimates'}
          accentColor="#fbbf24" delay={320} />
      </section>

      {/* ── Charts Grid ────────────────────────────────────────────── */}
      <section className="analytics-charts-grid">
        {/* Project Distribution */}
        <div className="analytics-card donut-card">
          <div className="card-header">
            <FolderKanban size={18} />
            <h3>Project Distribution</h3>
          </div>
          <div className="donut-content">
            <DonutChart
              segments={projectData}
              centerLabel="Projects"
              centerValue={projectData.length}
            />
            <div className="legend">
              {projectData.map((p, i) => (
                <div className="legend-item" key={p.label} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="legend-swatch" style={{ backgroundColor: p.color }} />
                  <span className="legend-name">{p.label}</span>
                  <span className="legend-value">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="analytics-card status-card">
          <div className="card-header">
            <Activity size={18} />
            <h3>Status Breakdown</h3>
          </div>
          <div className="status-list">
            {statusData.map((s, i) => (
              <div className="status-row" key={s.label} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="status-info">
                  <span className="status-indicator" style={{ backgroundColor: s.color }} />
                  <span className="status-name">{s.label}</span>
                </div>
                <div className="status-bar-track">
                  <div
                    className="status-bar-fill"
                    style={{
                      width: `${(s.value / metrics.total) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
                <span className="status-count">{s.value}</span>
                <span className="status-pct">{Math.round((s.value / metrics.total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Analysis */}
        <BarChartSection
          data={priorityData}
          title="Priority Analysis"
          icon={Flame}
          formatValue={(v) => `${v} issues`}
        />

        {/* Issue Types */}
        <BarChartSection
          data={issueTypeData}
          title="Issue Types"
          icon={BarChart3}
          formatValue={(v) => `${v}`}
        />

        {/* Daily Time Logged */}
        {(hasTimeData || worklogsLoading) && (
          <div className="analytics-card time-chart-card span-2">
            <div className="card-header">
              <Clock size={18} />
              <h3>Daily Time Logged <span className="card-subtitle">(Last 14 days)</span></h3>
              {worklogsLoading && (
                <span className="card-loading-indicator">
                  <Loader2 size={14} className="spinning" />
                  <span>Fetching worklogs…</span>
                </span>
              )}
            </div>
            {hasTimeData ? (
              <div className="time-bars">
                {dailyTimeData.map((d, i) => {
                  const maxVal = Math.max(...dailyTimeData.map(x => x.value), 1);
                  const pct = (d.value / maxVal) * 100;
                  return (
                    <div className="time-bar-col" key={d.label} style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="time-bar-container">
                        <div
                          className="time-bar-fill-vertical"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                          title={formatHours(d.value)}
                        />
                      </div>
                      <span className="time-bar-day">{d.shortLabel}</span>
                      <span className="time-bar-date">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="worklogs-loading-placeholder">
                <p>Loading worklog data from Jira…</p>
              </div>
            )}
          </div>
        )}

        {/* Time by Project (from worklogs) */}
        {hasWorklogData && timeByProjectData.length > 0 && (
          <BarChartSection
            data={timeByProjectData}
            title="Time Logged by Project"
            icon={Timer}
            formatValue={(v) => formatHours(v)}
          />
        )}

        {/* Activity Heatmap */}
        <HeatmapGrid
          data={activityData}
          title="Activity Heatmap (Last 14 Days)"
          icon={TrendingUp}
        />

        {/* Overdue Issues */}
        {overdueIssues.length > 0 && (
          <div className="analytics-card overdue-card">
            <div className="card-header danger">
              <AlertTriangle size={18} />
              <h3>Overdue Issues</h3>
            </div>
            <div className="overdue-list">
              {overdueIssues.map((issue, i) => {
                const daysOverdue = differenceInDays(new Date(), new Date(issue.fields.duedate));
                return (
                  <div className="overdue-item" key={issue.key} style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="overdue-key">{issue.key}</div>
                    <div className="overdue-summary">{issue.fields?.summary}</div>
                    <div className="overdue-badge">
                      {daysOverdue}d overdue
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
