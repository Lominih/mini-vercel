import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi, deploymentsApi, Project, Deployment } from '../api/client';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentDeployments, setRecentDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);

        const allDeployments: Deployment[] = [];
        for (const proj of projs.slice(0, 5)) {
          try {
            const deps = await deploymentsApi.list(proj.id);
            allDeployments.push(...deps.slice(0, 3));
          } catch { /* skip */ }
        }
        allDeployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentDeployments(allDeployments.slice(0, 10));
      } catch { /* handle error */ }
      setLoading(false);
    }
    load();
  }, []);

  const activeProjects = projects.filter((p) =>
    p.latestDeployment?.status === 'ready' || p.latestDeployment?.status === 'building'
  ).length;

  const totalDeployments = recentDeployments.length;
  const failedDeployments = recentDeployments.filter((d) => d.status === 'failed').length;

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Projects" value={projects.length} icon="📁" />
        <MetricCard label="Active" value={activeProjects} icon="🟢" />
        <MetricCard label="Deployments" value={totalDeployments} icon="🚀" />
        <MetricCard label="Failed" value={failedDeployments} icon="🔴" />
      </div>

      <div className="section">
        <h2>Recent Activity</h2>
        {recentDeployments.length === 0 ? (
          <div className="empty-state">
            <h3>No deployments yet</h3>
            <p>Create a project and deploy to get started.</p>
            <Link to="/projects" className="btn btn-primary" style={{ marginTop: 16 }}>
              Create Project
            </Link>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>URL</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentDeployments.map((dep) => {
                  const project = projects.find((p) => p.id === dep.projectId);
                  return (
                    <tr key={dep.id}>
                      <td>
                        <Link to={`/projects/${dep.projectId}`} style={{ fontWeight: 500 }}>
                          {project?.name || dep.projectId.slice(0, 8)}
                        </Link>
                      </td>
                      <td><StatusBadge status={dep.status} /></td>
                      <td>
                        <a href={dep.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                          {dep.url}
                        </a>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
