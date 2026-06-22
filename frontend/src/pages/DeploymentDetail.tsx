import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { deploymentsApi, projectsApi, Deployment, LogEntry, Project } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import LogViewer from '../components/LogViewer';
import { formatDistanceToNow } from 'date-fns';

export default function DeploymentDetail() {
  const { id: projectId, deploymentId } = useParams<{ id: string; deploymentId: string }>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !deploymentId) return;
    async function load() {
      try {
        const [dep, proj, depLogs] = await Promise.all([
          deploymentsApi.get(projectId!, deploymentId!),
          projectsApi.get(projectId!).catch(() => null),
          deploymentsApi.getLogs(projectId!, deploymentId!).catch(() => []),
        ]);
        setDeployment(dep);
        setProject(proj);
        setLogs(depLogs);
      } catch { /* handle */ }
      setLoading(false);
    }
    load();
  }, [projectId, deploymentId]);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading deployment...</div>;
  }

  if (!deployment) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Deployment not found.</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to={`/projects/${projectId}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            ← {project?.name || 'Project'}
          </Link>
          <h1 style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
            Deployment <StatusBadge status={deployment.status} />
          </h1>
        </div>
        <a href={deployment.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
          Visit URL →
        </a>
      </div>

      <div className="metrics-grid">
        <div className="section" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</div>
          <div><StatusBadge status={deployment.status} /></div>
        </div>
        <div className="section" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Branch</div>
          <div style={{ fontWeight: 500 }}>{deployment.branch || 'main'}</div>
        </div>
        <div className="section" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Commit</div>
          <div style={{ fontFamily: 'monospace' }}>{deployment.commitSha?.slice(0, 7) || '—'}</div>
        </div>
        <div className="section" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Created</div>
          <div style={{ fontSize: 14 }}>
            {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
          </div>
        </div>
      </div>

      {deployment.commitMessage && (
        <div className="section">
          <h2>Commit Message</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{deployment.commitMessage}</div>
        </div>
      )}

      <div className="section">
        <h2>Build Logs</h2>
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
