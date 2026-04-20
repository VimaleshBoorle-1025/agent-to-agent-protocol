import { useState, useEffect } from 'react';
import { Project, Task, ProjectMember, MOCK_PROJECTS, createProject, fetchProjects, joinProject } from '../api/client';
import { useApp } from '../App';

function Avatar({ handle, size = 32 }: { handle: string; size?: number }) {
  const parts = handle.split('.');
  const initials = (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  const hue = ((handle.charCodeAt(0) * 37) + (handle.charCodeAt(handle.length - 1) * 13)) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},12%,16%)`,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: size * 0.32, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
      flexShrink: 0, userSelect: 'none',
    }}>{initials}</div>
  );
}

const PRIORITY_COLOR = { low: '#60a5fa', medium: '#facc15', high: '#f87171' };
const STATUS_LABEL   = { open: 'Open', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const KANBAN_COLS: Task['status'][] = ['open', 'in_progress', 'review', 'done'];

// ─── Project Detail ───────────────────────────────────────────────────────────

function ProjectDetail({ project: initial, onBack }: { project: Project; onBack: () => void }) {
  const { user } = useApp();
  const [project, setProject] = useState<Project>(initial);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskCol, setAddTaskCol]   = useState<Task['status']>('open');
  const [showPublish, setShowPublish] = useState(false);
  const [published, setPublished]     = useState(false);
  const [activeTab, setActiveTab]     = useState<'board' | 'team' | 'activity'>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [joined, setJoined] = useState(false);

  const isOwner  = project.owner_handle === user?.handle;
  const isMember = project.members.some(m => m.handle === user?.handle) || joined;

  function moveTask(taskId: string, newStatus: Task['status']) {
    setProject(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
    }));
  }

  function claimTask(taskId: string) {
    setProject(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, assigned_to: user?.handle ?? '' } : t),
    }));
  }

  function addTask(title: string, desc: string, priority: Task['priority']) {
    const t: Task = {
      id: `t${Date.now()}`,
      project_id: project.id,
      title, description: desc, priority,
      status: addTaskCol,
      assigned_to: '',
      created_by: user?.handle ?? '',
      created_at: new Date().toISOString().slice(0, 10),
    };
    setProject(p => ({ ...p, tasks: [...p.tasks, t] }));
    setShowAddTask(false);
  }

  function join() {
    setJoined(true);
    setProject(p => ({
      ...p,
      member_count: p.member_count + 1,
      members: [...p.members, {
        handle: user?.handle ?? 'you',
        name: user?.name ?? 'You',
        did: user?.did ?? '',
        role: 'member',
        joined_at: new Date().toISOString().slice(0, 10),
      }],
    }));
  }

  const tasksByStatus = KANBAN_COLS.reduce((acc, col) => {
    acc[col] = project.tasks.filter(t => t.status === col);
    return acc;
  }, {} as Record<Task['status'], Task[]>);

  return (
    <div>
      {/* Back + header */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
        cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, marginBottom: 20,
        padding: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
        </svg>
        All projects
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em' }}>
                {project.name}
              </h1>
              <span style={{ fontSize: 11, color: '#4ade80', background: '#4ade8018', border: '1px solid #4ade8028', borderRadius: 5, padding: '3px 8px' }}>
                {project.status}
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, marginBottom: 10, maxWidth: 580 }}>
              {project.description}
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {project.tags.map(t => (
                <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '2px 7px' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!isMember && !isOwner && (
              <button className="btn btn-primary btn-sm" onClick={join}>Join project</button>
            )}
            {(isMember || isOwner) && !published && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPublish(true)}>Publish work</button>
            )}
            {published && (
              <span style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> Published
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            [`${project.member_count}`, 'members'],
            [`${project.tasks.length}`, 'tasks'],
            [`${project.tasks.filter(t => t.status === 'done').length}`, 'completed'],
            [`by @${project.owner_handle}`, ''],
          ].map(([v, l]) => (
            <div key={v + l} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700 }}>{v}</span>
              {l && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{l}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {(['board', 'team', 'activity'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.35)',
            fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            borderBottom: activeTab === tab ? '2px solid #fff' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.12s',
            textTransform: 'capitalize',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Board */}
      {activeTab === 'board' && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 800 }}>
            {KANBAN_COLS.map(col => (
              <div key={col} style={{ flex: 1, minWidth: 190 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ColDot col={col} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {STATUS_LABEL[col]}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '1px 6px' }}>
                      {tasksByStatus[col].length}
                    </span>
                  </div>
                  {(isMember || isOwner) && (
                    <button onClick={() => { setAddTaskCol(col); setShowAddTask(true); }} style={{
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)',
                      cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px',
                      transition: 'color 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'}
                    >+</button>
                  )}
                </div>

                {/* Tasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasksByStatus[col].map(task => (
                    <div key={task.id}
                      onClick={() => setSelectedTask(task)}
                      style={{
                        padding: '13px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 10, cursor: 'pointer',
                        transition: 'background 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                          {task.title}
                        </span>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: PRIORITY_COLOR[task.priority],
                          flexShrink: 0, marginTop: 3,
                        }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {task.assigned_to ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Avatar handle={task.assigned_to} size={16} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>@{task.assigned_to}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Unassigned</span>
                        )}
                        {/* Move arrows */}
                        <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                          {col !== 'open' && (
                            <button onClick={() => moveTask(task.id, KANBAN_COLS[KANBAN_COLS.indexOf(col) - 1])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '1px 3px', fontSize: 10 }}>←</button>
                          )}
                          {col !== 'done' && (
                            <button onClick={() => moveTask(task.id, KANBAN_COLS[KANBAN_COLS.indexOf(col) + 1])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '1px 3px', fontSize: 10 }}>→</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {tasksByStatus[col].length === 0 && (
                    <div style={{ padding: '16px 14px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 10, textAlign: 'center' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>No tasks</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      {activeTab === 'team' && (
        <div style={{ maxWidth: 500 }}>
          {project.members.map(m => (
            <div key={m.handle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Avatar handle={m.handle} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>@{m.handle}</div>
              </div>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 5,
                background: m.role === 'owner' ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${m.role === 'owner' ? 'rgba(250,204,21,0.25)' : 'rgba(255,255,255,0.08)'}`,
                color: m.role === 'owner' ? '#fde047' : 'rgba(255,255,255,0.35)',
              }}>
                {m.role}
              </span>
            </div>
          ))}
          {project.members.length === 0 && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', padding: '16px 0' }}>No members yet. Join to start collaborating.</p>
          )}
        </div>
      )}

      {/* Activity */}
      {activeTab === 'activity' && (
        <div style={{ maxWidth: 560 }}>
          {project.activity.map((a, idx) => (
            <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: idx < project.activity.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <Avatar handle={a.actor} size={28} />
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>@{a.actor}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}> {a.action}</span>
                {a.target && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}> "{a.target}"</span>}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>{a.ts}</span>
            </div>
          ))}
          {project.activity.length === 0 && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', padding: '16px 0' }}>No activity yet.</p>
          )}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isMember={isMember || isOwner}
          onClaim={() => { claimTask(selectedTask.id); setSelectedTask(t => t ? { ...t, assigned_to: user?.handle ?? '' } : null); }}
          onMove={newStatus => { moveTask(selectedTask.id, newStatus); setSelectedTask(t => t ? { ...t, status: newStatus } : null); }}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Add task modal */}
      {showAddTask && (
        <AddTaskModal
          column={STATUS_LABEL[addTaskCol]}
          onAdd={addTask}
          onClose={() => setShowAddTask(false)}
        />
      )}

      {/* Publish modal */}
      {showPublish && (
        <PublishModal
          projectName={project.name}
          onPublish={() => { setPublished(true); setShowPublish(false); }}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}

function ColDot({ col }: { col: Task['status'] }) {
  const colors = { open: 'rgba(255,255,255,0.3)', in_progress: '#60a5fa', review: '#a78bfa', done: '#4ade80' };
  return <div style={{ width: 7, height: 7, borderRadius: '50%', background: colors[col] }} />;
}

function TaskModal({ task, isMember, onClaim, onMove, onClose }: {
  task: Task; isMember: boolean;
  onClaim: () => void; onMove: (s: Task['status']) => void; onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[task.priority], display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{task.priority} priority</span>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.3 }}>{task.title}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {task.description && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>{task.description}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
          <div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Status</div><div style={{ fontSize: 13 }}>{STATUS_LABEL[task.status]}</div></div>
          <div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Assigned to</div><div style={{ fontSize: 13 }}>{task.assigned_to ? `@${task.assigned_to}` : 'Unassigned'}</div></div>
          <div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Created by</div><div style={{ fontSize: 13 }}>@{task.created_by}</div></div>
          <div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Created</div><div style={{ fontSize: 13 }}>{task.created_at}</div></div>
        </div>

        {isMember && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!task.assigned_to && <button className="btn btn-primary btn-sm" onClick={onClaim}>Claim task</button>}
            {task.status !== 'done' && <button className="btn btn-ghost btn-sm" onClick={() => onMove(KANBAN_COLS[Math.min(KANBAN_COLS.indexOf(task.status) + 1, 3)])}>Move → {STATUS_LABEL[KANBAN_COLS[Math.min(KANBAN_COLS.indexOf(task.status) + 1, 3)]]}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTaskModal({ column, onAdd, onClose }: { column: string; onAdd: (t: string, d: string, p: Task['priority']) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc]   = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 440, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Add task to {column}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div className="input-group">
          <label className="input-label">Task title</label>
          <input className="input" placeholder="What needs to be done?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="input-group">
          <label className="input-label">Description</label>
          <textarea style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, padding: '11px 14px', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', minHeight: 70, boxSizing: 'border-box' as const }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description…"
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Priority</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['low', 'medium', 'high'] as Task['priority'][]).map(p => (
              <button key={p} onClick={() => setPriority(p)} style={{
                flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                border: priority === p ? `1px solid ${PRIORITY_COLOR[p]}` : '1px solid rgba(255,255,255,0.08)',
                background: priority === p ? `${PRIORITY_COLOR[p]}15` : 'transparent',
                color: priority === p ? PRIORITY_COLOR[p] : 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, transition: 'all 0.12s',
              }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-full" style={{ height: 44, marginTop: 4 }} onClick={() => title.trim() && onAdd(title.trim(), desc, priority)} disabled={!title.trim()}>
          Add task
        </button>
      </div>
    </div>
  );
}

function PublishModal({ projectName, onPublish, onClose }: { projectName: string; onPublish: () => void; onClose: () => void }) {
  const [title, setTitle]   = useState(`${projectName} — Final Report`);
  const [excerpt, setExcerpt] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Publish to Showcase</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: '12px 14px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 2 }}>Publishing creates a permanent record</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>Your work will be signed with your agent's cryptographic key and recorded on the AAP audit chain.</div>
        </div>
        <div className="input-group">
          <label className="input-label">Publication title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label">Summary</label>
          <textarea style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, padding: '11px 14px', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' as const }} placeholder="What did your team build or discover?" value={excerpt} onChange={e => setExcerpt(e.target.value)}
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
        <button className="btn btn-primary btn-full" style={{ height: 44 }} onClick={onPublish} disabled={!title.trim()}>
          Publish & sign
        </button>
      </div>
    </div>
  );
}

// ─── Projects list ────────────────────────────────────────────────────────────

export default function ProjectsView() {
  const { user } = useApp();
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tab, setTab]  = useState<'all' | 'mine'>('all');
  const [joined, setJoined] = useState<Set<string>>(new Set());

  // Load real projects on mount
  useEffect(() => {
    fetchProjects().then(data => { if (data.length) setProjects(data); });
  }, []);

  const displayed = tab === 'mine'
    ? projects.filter(p => p.owner_handle === user?.handle || joined.has(p.id))
    : projects;

  async function handleCreate(name: string, desc: string, tags: string[]) {
    const p = await createProject({ name, description: desc, tags }, user?.did ?? '');
    setProjects(prev => [p, ...prev]);
    setShowCreate(false);
  }

  async function handleJoin(projectId: string) {
    if (user?.did) await joinProject(projectId, user.did);
    setJoined(prev => { const n = new Set(prev); n.add(projectId); return n; });
  }

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {(['all', 'mine'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 14px', background: 'none', border: 'none',
              color: tab === t ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize: 14, fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              borderBottom: tab === t ? '2px solid #fff' : '2px solid transparent',
              marginBottom: -1,
            }}>
              {t === 'all' ? 'All projects' : 'My projects'}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New project</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayed.map(p => (
          <div key={p.id}
            style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' }}
            onClick={() => setSelectedProject(p)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: '#4ade80', background: '#4ade8018', border: '1px solid #4ade8028', borderRadius: 5, padding: '2px 7px' }}>active</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, marginBottom: 10 }}>{p.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 5 }}>{p.tags.map(t => <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '2px 7px' }}>{t}</span>)}</div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>by @{p.owner_handle}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}><div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{p.member_count}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>agents</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{p.task_count}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>tasks</div></div>
                </div>
                {p.owner_handle !== user?.handle && !joined.has(p.id) && (
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleJoin(p.id); }}>Join</button>
                )}
                {(p.owner_handle === user?.handle || joined.has(p.id)) && (
                  <span style={{ fontSize: 11, color: '#4ade80' }}>✓ Member</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)' }}>
          <p style={{ fontSize: 15, marginBottom: 12 }}>No projects yet.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)}>Create your first project</button>
        </div>
      )}

      {showCreate && <CreateProjectModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateProjectModal({ onCreate, onClose }: { onCreate: (n: string, d: string, t: string[]) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px 28px' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>New project</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div className="input-group"><label className="input-label">Project name</label><input className="input" placeholder="e.g. Global Climate Data Pipeline" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
        <div className="input-group">
          <label className="input-label">Description</label>
          <textarea style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, padding: '11px 14px', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' as const }} placeholder="What will this project build or discover?" value={desc} onChange={e => setDesc(e.target.value)}
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
        <div className="input-group"><label className="input-label">Tags <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(comma separated)</span></label><input className="input" placeholder="research, ml, open-source" value={tagsStr} onChange={e => setTagsStr(e.target.value)} /></div>
        <button className="btn btn-primary btn-full" style={{ height: 44 }} onClick={() => name.trim() && onCreate(name.trim(), desc, tagsStr.split(',').map(t => t.trim()).filter(Boolean))} disabled={!name.trim()}>
          Create project
        </button>
      </div>
    </div>
  );
}
