import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi, deploymentsApi, Project, Deployment } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export default function Deployments() {
  const [deployments, setDeployments] = useState<(Deployment & { projectName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const projects = await projectsApi.list();
        const all: (Deployment & { projectName?: string })[] = [];
        for (const proj of projects) {
          try {
            const deps = await deploymentsApi.list(proj.id);
            all.push(...deps.map((d) => ({ ...d, projectName: proj.name })));
          } catch { /* skip */ }
        }
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDeployments(all);
      } catch { /* handle */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading deployments...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Deployments</h1>
      </div>

      {deployments.length === 0 ? (
        <div className="empty-state">
          <h3>No deployments yet</h3>
          <p>Deploy a project to see deployments here.</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>URL</th>
                <th>Branch</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((dep) => (
                <tr key={dep.id}>
                  <td>
                    <Link to={`/projects/${dep.projectId}`} style={{ fontWeight: 500 }}>
                      {dep.projectName || dep.projectId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/projects/${dep.projectId}/deployments/${dep.id}`}>
                      <StatusBadge status={dep.status} />
                    </Link>
                  </td>
                  <td>
                    <a href={dep.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                      {dep.url}
                    </a>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dep.branch || 'main'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
