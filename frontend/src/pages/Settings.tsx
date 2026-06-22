import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { projectsApi, Project } from '../api/client';

export default function Settings() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (id) {
        try {
          const proj = await projectsApi.get(id);
          setProject(proj);
          setName(proj.name);
          setFramework(proj.framework);
        } catch { /* handle */ }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSaving(true);
    try {
      const updated = await projectsApi.update(project.id, { name, framework } as Partial<Project>);
      setProject(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* handle */ }
    setSaving(false);
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading settings...</div>;
  }

  if (!project) {
    return (
      <div>
        <div className="page-header">
          <h1>Settings</h1>
        </div>
        <div className="section">
          <h2>Account Settings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
            Manage your account preferences.
          </p>
          <div className="form-group">
            <label>Display Name</label>
            <input placeholder="Your name" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input placeholder="you@example.com" type="email" />
          </div>
          <button className="btn btn-primary">Save Changes</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Project Settings</h1>
      </div>

      <div className="section">
        <h2>General</h2>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Project Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Framework</label>
            <select value={framework} onChange={(e) => setFramework(e.target.value)}>
              <option value="node">Node.js</option>
              <option value="static">Static</option>
              <option value="next">Next.js</option>
              <option value="react">React (Vite)</option>
              <option value="python">Python</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && (
              <span style={{ color: 'var(--success)', fontSize: 13 }}>✓ Saved</span>
            )}
          </div>
        </form>
      </div>

      <div className="section">
        <h2>Danger Zone</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          Once you delete a project, there is no going back. Please be certain.
        </p>
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (confirm('Are you sure you want to delete this project? This action is irreversible.')) {
              try {
                await projectsApi.delete(project.id);
                window.location.href = '/projects';
              } catch { /* handle */ }
            }
          }}
        >
          Delete Project
        </button>
      </div>
    </div>
  );
}
