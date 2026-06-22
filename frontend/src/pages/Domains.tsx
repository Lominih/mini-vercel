import React, { useEffect, useState } from 'react';
import { projectsApi, domainsApi, Project, Domain } from '../api/client';

export default function Domains() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);
        if (projs.length > 0) {
          setSelectedProject(projs[0].id);
        }
      } catch { /* handle */ }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    async function loadDomains() {
      try {
        const doms = await domainsApi.list(selectedProject);
        setDomains(doms);
      } catch { /* handle */ }
    }
    loadDomains();
  }, [selectedProject]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject || !newDomain) return;
    setAdding(true);
    try {
      const domain = await domainsApi.add(selectedProject, newDomain);
      setDomains([...domains, domain]);
      setNewDomain('');
    } catch { /* handle */ }
    setAdding(false);
  }

  async function handleVerify(domainId: string) {
    if (!selectedProject) return;
    try {
      const verified = await domainsApi.verify(selectedProject, domainId);
      setDomains(domains.map((d) => d.id === domainId ? verified : d));
    } catch { /* handle */ }
  }

  async function handleRemove(domainId: string) {
    if (!selectedProject || !confirm('Remove this domain?')) return;
    try {
      await domainsApi.remove(selectedProject, domainId);
      setDomains(domains.filter((d) => d.id !== domainId));
    } catch { /* handle */ }
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Domains</h1>
      </div>

      <div className="section">
        <h2>Select Project</h2>
        <div className="form-group">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedProject && (
        <>
          <div className="section">
            <h2>Add Domain</h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Domain name</label>
                <input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? 'Adding...' : 'Add Domain'}
              </button>
            </form>
          </div>

          <div className="section">
            <h2>Configured Domains</h2>
            {domains.length === 0 ? (
              <div className="empty-state">
                <p>No domains configured for this project.</p>
              </div>
            ) : (
              <div>
                {domains.map((domain) => (
                  <div key={domain.id} className="domain-item">
                    <div>
                      <div className="domain-name">{domain.name}</div>
                    </div>
                    <div className="domain-meta">
                      <span style={{ color: domain.verified ? 'var(--success)' : 'var(--warning)' }}>
                        {domain.verified ? '✓ Verified' : 'Pending'}
                      </span>
                      <span style={{ color: domain.sslStatus === 'active' ? 'var(--success)' : 'var(--warning)' }}>
                        SSL: {domain.sslStatus}
                      </span>
                      {!domain.verified && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleVerify(domain.id)}
                        >
                          Verify
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemove(domain.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
