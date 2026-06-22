import React, { useEffect, useState } from 'react';
import { projectsApi, envApi, Project, EnvVariable } from '../api/client';

export default function Environment() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newTarget, setNewTarget] = useState<string[]>(['production']);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);
        if (projs.length > 0) setSelectedProject(projs[0].id);
      } catch { /* handle */ }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    async function loadEnv() {
      try {
        const envs = await envApi.list(selectedProject);
        setEnvVars(envs);
      } catch { /* handle */ }
    }
    loadEnv();
  }, [selectedProject]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject || !newKey) return;
    try {
      const env = await envApi.set(selectedProject, newKey, newValue, newTarget);
      setEnvVars([...envVars, env]);
      setNewKey('');
      setNewValue('');
    } catch { /* handle */ }
  }

  async function handleUpdate(key: string) {
    if (!selectedProject) return;
    try {
      const env = await envApi.set(selectedProject, key, editValue);
      setEnvVars(envVars.map((e) => e.key === key ? env : e));
      setEditingId(null);
      setEditValue('');
    } catch { /* handle */ }
  }

  async function handleDelete(key: string) {
    if (!selectedProject || !confirm(`Delete env var "${key}"?`)) return;
    try {
      await envApi.delete(selectedProject, key);
      setEnvVars(envVars.filter((e) => e.key !== key));
    } catch { /* handle */ }
  }

  function toggleTarget(t: string) {
    setNewTarget((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Environment Variables</h1>
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
            <h2>Add Environment Variable</h2>
            <form onSubmit={handleAdd}>
              <div className="env-editor">
                <div className="env-row">
                  <input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="KEY"
                    required
                  />
                  <input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="value"
                    type="password"
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-sm">Add</button>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {['production', 'preview', 'development'].map((t) => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newTarget.includes(t)}
                        onChange={() => toggleTarget(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </form>
          </div>

          <div className="section">
            <h2>Environment Variables</h2>
            {envVars.length === 0 ? (
              <div className="empty-state">
                <p>No environment variables set.</p>
              </div>
            ) : (
              <div>
                {envVars.map((env) => (
                  <div key={env.id} className="domain-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{env.key}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setEditingId(env.id); setEditValue(env.value); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(env.key)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {editingId === env.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(env.key)}>Save</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {env.value.substring(0, 40)}{env.value.length > 40 ? '•••' : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Targets: {env.target.join(', ')}
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
