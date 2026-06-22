import React, { useEffect, useState } from 'react';
import { projectsApi, functionsApi, Project, Function as Fn } from '../api/client';

export default function Functions() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [functions, setFunctions] = useState<Fn[]>([]);
  const [selectedFn, setSelectedFn] = useState<Fn | null>(null);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
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
    async function loadFns() {
      try {
        const fns = await functionsApi.list(selectedProject);
        setFunctions(fns);
        setSelectedFn(null);
        setCode('');
      } catch { /* handle */ }
    }
    loadFns();
  }, [selectedProject]);

  function handleSelectFn(fn: Fn) {
    setSelectedFn(fn);
    setCode(fn.code);
  }

  async function handleSave() {
    if (!selectedProject || !selectedFn) return;
    setSaving(true);
    try {
      const updated = await functionsApi.update(selectedProject, selectedFn.id, { code });
      setFunctions(functions.map((f) => f.id === updated.id ? updated : f));
      setSelectedFn(updated);
    } catch { /* handle */ }
    setSaving(false);
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Edge Functions</h1>
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
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <div className="section" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ margin: 0 }}>Functions</h2>
            </div>
            {functions.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No functions found
              </div>
            ) : (
              functions.map((fn) => (
                <button
                  key={fn.id}
                  onClick={() => handleSelectFn(fn)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 20px',
                    background: selectedFn?.id === fn.id ? 'var(--bg-hover)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{fn.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{fn.route}</div>
                </button>
              ))
            )}
          </div>

          <div className="section">
            {selectedFn ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedFn.name}</h2>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Route: {selectedFn.route} · Runtime: {selectedFn.runtime}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 400,
                    padding: 16,
                    background: '#0a0a0a',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                  }}
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="empty-state">
                <h3>Select a function</h3>
                <p>Choose a function from the list to view and edit its code.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
