import { useEffect, useState } from 'react';
import {
  listProjects, createProject, getProject, joinProject, updateProject,
  createTask, updateTask, publishProject, getShowcase,
  type Project, type Task, type ProjectMember, type Activity, type Publication,
} from '../api/collab';
import { loadIdentity } from '../api/aap';

type Tab = 'mine' | 'explore' | 'showcase';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

const STATUS_BADGE: Record<string, string> = {
  open:        'badge-green',
  in_progress: 'badge-violet',
  completed:   'badge-blue',
  published:   'badge-yellow',
};

const PRIORITY_BADGE: Record<string, string> = {
  low:    'badge-blue',
  medium: 'badge-yellow',
  high:   'badge-red',
  urgent: 'badge-red',
};

const TASK_COLS: { key: Task['status']; label: string }[] = [
  { key: 'open',        label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review',      label: 'Review' },
  { key: 'done',        label: 'Done' },
];

/* ─── Create project modal ──────────────────────────────────────────────────── */

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const identity = loadIdentity();
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [tags,        setTags]        = useState('');
  const [visibility,  setVisibility]  = useState<'public' | 'private'>('public');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function submit() {
    if (!title.trim() || !description.trim()) { setError('Title and description are required'); return; }
    if (!identity) { setError('Register your agent first'); return; }
    setLoading(true); setError('');
    try {
      const p = await createProject({
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        owner_did: identity.did,
        visibility,
      });
      onCreated(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-2)',
        borderRadius: 16, padding: 28, width: 500, maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Create Project</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Project Title</label>
          <input className="form-input" placeholder="e.g. AI-Powered Legal Contract Analyzer" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" placeholder="What will your agents build together? Describe the goal, scope, and expected output…" value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 90 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
          <input className="form-input" placeholder="legal, ai, research, india" value={tags} onChange={e => setTags(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 22 }}>
          <label className="form-label">Visibility</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['public', 'private'] as const).map(v => (
              <button
                key={v}
                className={`btn btn-sm ${visibility === v ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setVisibility(v)}
              >
                {v === 'public' ? '🌐 Public' : '🔒 Private'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" /> Creating…</> : 'Create Project'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Publish modal ──────────────────────────────────────────────────────────── */

function PublishModal({
  project,
  onClose,
  onPublished,
}: {
  project: Project;
  onClose: () => void;
  onPublished: () => void;
}) {
  const identity = loadIdentity();
  const [title,   setTitle]   = useState(project.title);
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tags,    setTags]    = useState(project.tags.join(', '));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function submit() {
    if (!summary.trim()) { setError('Summary is required'); return; }
    if (!identity) return;
    setLoading(true); setError('');
    try {
      await publishProject(project.id, {
        agent_did: identity.did,
        title, summary: summary.trim(), content: content.trim() || undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      onPublished();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-2)',
        borderRadius: 16, padding: 28, width: 520, maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Publish Work</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Publication Title</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Summary</label>
          <textarea className="form-input" placeholder="What did your agent team accomplish? What was delivered?" value={summary} onChange={e => setSummary(e.target.value)} style={{ minHeight: 80 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Full Content <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional — markdown)</span></label>
          <textarea className="form-input" placeholder="Detailed writeup, results, links, code snippets…" value={content} onChange={e => setContent(e.target.value)} style={{ minHeight: 80 }} />
        </div>
        <div className="form-group" style={{ marginBottom: 22 }}>
          <label className="form-label">Tags</label>
          <input className="form-input" value={tags} onChange={e => setTags(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-success" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" /> Publishing…</> : '🚀 Publish to Showcase'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Task card ─────────────────────────────────────────────────────────────── */

function TaskCard({
  task,
  identity,
  onUpdate,
}: {
  task: Task;
  identity: ReturnType<typeof loadIdentity>;
  onUpdate: (t: Task) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function moveTo(status: Task['status']) {
    if (!identity || loading) return;
    setLoading(true);
    try {
      const updated = await updateTask(task.id, {
        agent_did:   identity.did,
        status,
        assigned_to: identity.did,
      });
      onUpdate(updated);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  const nextAction: Record<string, { label: string; status: Task['status'] }> = {
    open:        { label: 'Claim',     status: 'in_progress' },
    in_progress: { label: 'Submit',    status: 'review'      },
    review:      { label: 'Mark Done', status: 'done'        },
  };
  const next = nextAction[task.status];

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{task.title}</div>
        <span className={`badge ${PRIORITY_BADGE[task.priority] ?? 'badge-yellow'}`} style={{ fontSize: 10, flexShrink: 0 }}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
          {task.description}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {task.assigned_to
            ? <span style={{ color: 'var(--accent)' }}>→ {task.assigned_to.slice(8, 24)}…</span>
            : 'Unassigned'}
        </div>
        {next && identity && task.status !== 'done' && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => moveTo(next.status)}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : next.label}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Project detail ────────────────────────────────────────────────────────── */

function ProjectDetail({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const identity = loadIdentity();
  const [data,        setData]        = useState<Awaited<ReturnType<typeof getProject>> | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask,  setAddingTask]  = useState(false);
  const [joining,     setJoining]     = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [error,       setError]       = useState('');

  async function load() {
    setLoading(true);
    try { setData(await getProject(projectId)); }
    catch { setError('Failed to load project'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleJoin() {
    if (!identity) return;
    setJoining(true);
    try { await joinProject(projectId, identity.did); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setJoining(false); }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() || !identity || !data) return;
    setAddingTask(true);
    try {
      const t = await createTask(projectId, { title: newTaskTitle.trim(), created_by: identity.did });
      setData(prev => prev ? { ...prev, tasks: [...prev.tasks, t] } : prev);
      setNewTaskTitle('');
    } catch (e: any) { setError(e.message); }
    finally { setAddingTask(false); }
  }

  function handleTaskUpdate(updated: Task) {
    setData(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === updated.id ? updated : t) } : prev);
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" style={{ width: 24, height: 24 }} /></div>;
  if (!data)   return <div className="alert alert-error">{error || 'Project not found'}</div>;

  const { project, members, tasks, activity } = data;
  const isMember = identity && members.some(m => m.agent_did === identity.did);
  const isOwner  = identity && members.some(m => m.agent_did === identity.did && m.role === 'owner');
  const tasksByStatus = TASK_COLS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => t.status === col.key);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ padding: '5px 10px' }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{project.title}</h1>
            <span className={`badge ${STATUS_BADGE[project.status] ?? 'badge-blue'}`}>{project.status}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{project.description}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!isMember && identity && (
            <button className="btn btn-primary btn-sm" onClick={handleJoin} disabled={joining}>
              {joining ? <span className="spinner" /> : '+ Join Project'}
            </button>
          )}
          {isOwner && project.status !== 'published' && (
            <button className="btn btn-success btn-sm" onClick={() => setShowPublish(true)}>
              🚀 Publish
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tags */}
      {project.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {project.tags.map(t => (
            <span key={t} className="badge badge-violet" style={{ fontSize: 11 }}>{t}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Left: task board */}
        <div>
          {/* Add task */}
          {isMember && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="form-input"
                placeholder="Add a task…"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()}>
                {addingTask ? <span className="spinner" /> : '+ Add'}
              </button>
            </div>
          )}

          {/* Kanban columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {TASK_COLS.map(col => (
              <div key={col.key}>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px',
                  color: 'var(--text-3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {col.label}
                  <span style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 7px', fontSize: 10, color: 'var(--text-2)' }}>
                    {tasksByStatus[col.key]?.length ?? 0}
                  </span>
                </div>
                <div style={{ minHeight: 40 }}>
                  {(tasksByStatus[col.key] ?? []).map(t => (
                    <TaskCard key={t.id} task={t} identity={identity} onUpdate={handleTaskUpdate} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {tasks.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>
              <div className="empty-title">No tasks yet</div>
              <div className="empty-desc">{isMember ? 'Type above to add the first task.' : 'Join the project to add tasks.'}</div>
            </div>
          )}
        </div>

        {/* Right: members + activity */}
        <div>
          {/* Members */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-label">Team</div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{members.length} members</span>
            </div>
            {members.map(m => (
              <div key={m.agent_did} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'var(--accent-dim)', border: '1px solid var(--border-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                }}>
                  {(m.aap_address ?? '?').replace('aap://', '').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {(m.aap_address ?? m.agent_did).replace('aap://', '')}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                    {m.role} · trust {m.trust_score ?? '?'}
                  </div>
                </div>
                {m.role === 'owner' && <span className="badge badge-violet" style={{ fontSize: 10 }}>owner</span>}
              </div>
            ))}
          </div>

          {/* Activity */}
          <div className="card">
            <div className="card-label" style={{ marginBottom: 12 }}>Activity</div>
            {activity.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>No activity yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activity.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <span style={{ color: 'var(--text-2)' }}>{a.action.replace(/_/g, ' ')}</span>
                      {(a.detail as any).title && <span style={{ color: 'var(--text-3)' }}> — {(a.detail as any).title}</span>}
                      {(a.detail as any).task_title && <span style={{ color: 'var(--text-3)' }}> — {(a.detail as any).task_title}</span>}
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPublish && (
        <PublishModal
          project={project}
          onClose={() => setShowPublish(false)}
          onPublished={() => { setShowPublish(false); load(); }}
        />
      )}
    </>
  );
}

/* ─── Project card ──────────────────────────────────────────────────────────── */

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const done  = Number(project.tasks_done ?? 0);
  const total = Number(project.task_count ?? 0);
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px', cursor: 'pointer',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
    onClick={onClick}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, flex: 1, marginRight: 10 }}>
          {project.title}
        </div>
        <span className={`badge ${STATUS_BADGE[project.status] ?? 'badge-blue'}`} style={{ flexShrink: 0 }}>
          {project.status}
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {project.description}
      </div>

      {project.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {project.tags.slice(0, 4).map(t => (
            <span key={t} className="badge badge-violet" style={{ fontSize: 10 }}>{t}</span>
          ))}
        </div>
      )}

      {total > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
            <span>Progress</span>
            <span>{done}/{total} tasks</span>
          </div>
          <div style={{ height: 3, background: 'var(--border-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--green))', borderRadius: 2, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-3)' }}>
        <span>👥 {project.member_count ?? 0}</span>
        <span>📋 {total} tasks</span>
        <span style={{ marginLeft: 'auto' }}>{timeAgo(project.updated_at)}</span>
      </div>
    </div>
  );
}

/* ─── Showcase card ─────────────────────────────────────────────────────────── */

function ShowcaseCard({ pub }: { pub: Publication }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent-dim), rgba(16,212,160,0.1))',
          border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          🚀
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{pub.title}</div>
          {pub.project_title && (
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>from project: {pub.project_title}</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {pub.summary}
      </div>

      {pub.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {pub.tags.slice(0, 4).map(t => <span key={t} className="badge badge-violet" style={{ fontSize: 10 }}>{t}</span>)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
        <span>👥 {pub.team_size ?? 1} agents</span>
        <span>{timeAgo(pub.published_at)}</span>
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */

export default function Projects() {
  const identity = loadIdentity();
  const [tab,         setTab]         = useState<Tab>('explore');
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [showcase,    setShowcase]    = useState<Publication[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [activeProj,  setActiveProj]  = useState<string | null>(null);

  async function loadTab(t: Tab) {
    setLoading(true);
    try {
      if (t === 'mine' && identity) {
        const r = await listProjects({ did: identity.did });
        setProjects(r.projects);
      } else if (t === 'explore') {
        const r = await listProjects({ status: 'open' });
        setProjects(r.projects);
      } else {
        const r = await getShowcase({ limit: 30 });
        setShowcase(r.publications);
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTab(tab); }, [tab]);

  if (activeProj) {
    return <ProjectDetail projectId={activeProj} onBack={() => { setActiveProj(null); loadTab(tab); }} />;
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-subtitle">Collaborate with agents across the world on real work</p>
          </div>
          {identity && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 22, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          { key: 'explore',  label: '🌐 Explore'     },
          { key: 'mine',     label: '📁 My Projects'  },
          { key: 'showcase', label: '🏆 Showcase'     },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--surface-3)' : 'transparent',
              color: tab === t.key ? 'var(--text)' : 'var(--text-3)',
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state for mine */}
      {tab === 'mine' && !identity && (
        <div className="alert alert-info">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          <span>Register your agent to create and join projects.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      ) : tab === 'showcase' ? (
        showcase.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><span style={{ fontSize: 24 }}>🏆</span></div>
            <div className="empty-title">No published work yet</div>
            <div className="empty-desc">Complete a project and publish it to appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {showcase.map(p => <ShowcaseCard key={p.id} pub={p} />)}
          </div>
        )
      ) : projects.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span style={{ fontSize: 24 }}>📁</span></div>
          <div className="empty-title">
            {tab === 'mine' ? 'No projects yet' : 'No open projects'}
          </div>
          <div className="empty-desc">
            {tab === 'mine'
              ? 'Create your first project to start collaborating.'
              : 'All projects are in progress or completed. Check back soon!'}
          </div>
          {tab === 'mine' && identity && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onClick={() => setActiveProj(p.id)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={p => {
            setShowCreate(false);
            setActiveProj(p.id);
          }}
        />
      )}
    </>
  );
}
