import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  projectsApi,
  deploymentsApi,
  domainsApi,
  envApi,
  Project,
  Deployment,
  Domain,
  EnvVariable,
} from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'deployments' | 'domains' | 'env';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('deployments');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [proj, deps, doms, envs] = await Promise.all([
          projectsApi.get(id!),
          deploymentsApi.list(id!).catch(() => []),
          domainsApi.list(id!).catch(() => []),
          envApi.list(id!).catch(() => []),
        ]);
        setProject(proj);
        setDeployments(deps);
        setDomains(doms);
        setEnvVars(envs);
      } catch { /* handle */ }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleDeploy() {
    if (!id) return;
    setDeploying(true);
    try {
      const dep = await deploymentsApi.create(id);
      setDeployments([dep, ...deployments]);
    } catch { /* handle */ }
    setDeploying(false);
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading project...</div>;
  }

  if (!project) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Project not found.</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'deployments', label: `Deployments (${deployments.length})` },
    { key: 'domains', label: `Domains (${domains.length})` },
    { key: 'env', label: `Environment (${envVars.length})` },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/projects" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← Projects</Link>
          <h1 style={{ marginTop: 4 }}>{project.name}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {project.framework} · Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying}>
          {deploying ? 'Deploying...' : '🚀 Deploy Now'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--text-primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'deployments' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>URL</th>
                <th>Branch</th>
                <th>Commit</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((dep) => (
                <tr key={dep.id}>
                  <td>
                    <Link to={`/projects/${id}/deployments/${dep.id}`}>
                      <StatusBadge status={dep.status} />
                    </Link>
                  </td>
                  <td>
                    <a href={dep.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                      {dep.url}
                    </a>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dep.branch || 'main'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {dep.commitSha?.slice(0, 7) || '—'}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
              {deployments.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No deployments yet. Click "Deploy Now" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'domains' && (
        <div>
          {domains.map((domain) => (
            <div key={domain.id} className="domain-item">
              <div>
                <div className="domain-name">{domain.name}</div>
              </div>
              <div className="domain-meta">
                <span style={{ color: domain.verified ? 'var(--success)' : 'var(--warning)' }}>
                  {domain.verified ? '✓ Verified' : 'Pending verification'}
                </span>
                <span style={{ color: domain.sslStatus === 'active' ? 'var(--success)' : 'var(--warning)' }}>
                  SSL: {domain.sslStatus}
                </span>
              </div>
            </div>
          ))}
          {domains.length === 0 && (
            <div className="empty-state">
              <h3>No domains configured</h3>
              <p>Add a domain in the Domains tab from the sidebar.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'env' && (
        <div>
          {envVars.map((env) => (
            <div key={env.id} className="domain-item">
              <div>
                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{env.key}</span>
                <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                  {env.value.substring(0, 20)}{env.value.length > 20 ? '•••' : ''}
                </span>
              </div>
              <div className="domain-meta">
                <span>{env.target.join(', ')}</span>
              </div>
            </div>
          ))}
          {envVars.length === 0 && (
            <div className="empty-state">
              <h3>No environment variables</h3>
              <p>Set environment variables in the Environment tab from the sidebar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
