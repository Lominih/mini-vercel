import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi, Project } from '../api/client';
import { formatDistanceToNow } from 'date-fns';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [framework, setFramework] = useState('node');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  async function loadProjects() {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch { /* handle */ }
    setLoading(false);
  }

  useEffect(() => { loadProjects(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const project = await projectsApi.create({ name: newName, framework });
      setProjects([project, ...projects]);
      setShowCreate(false);
      setNewName('');
      setFramework('node');
    } catch { /* handle */ }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project? This action cannot be undone.')) return;
    try {
      await projectsApi.delete(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch { /* handle */ }
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading projects...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Project
        </button>
      </div>

      {showCreate && (
        <div className="section" style={{ marginBottom: 24 }}>
          <h2>Create New Project</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <label>Project Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-project"
                required
              />
            </div>
            <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
              <label>Framework</label>
              <select value={framework} onChange={(e) => setFramework(e.target.value)}>
                <option value="node">Node.js</option>
                <option value="static">Static</option>
                <option value="next">Next.js</option>
                <option value="react">React (Vite)</option>
                <option value="python">Python</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects yet</h3>
          <p>Create your first project to get started with deployments.</p>
        </div>
      ) : (
        <div>
          {projects.map((project) => (
            <div
              key={project.id}
              className="section"
              style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{project.name}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {project.framework} · Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
