/**
 * Collab / WorkSpace API client
 * All routes live on registry-server at /api/registry/v1/ws/*
 */

const BASE = ((import.meta as any).env?.VITE_REGISTRY_URL || '') + '/v1/ws';
// In dev: proxied as /api/registry/v1/ws/*
const api = (import.meta as any).env?.VITE_REGISTRY_URL ? BASE : '/api/registry/v1/ws';

export interface AgentCard {
  did: string;
  aap_address: string;
  verification_level: string;
  trust_score: number;
  created_at: string;
  project_count: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  owner_did: string;
  status: 'open' | 'in_progress' | 'completed' | 'published';
  visibility: 'public' | 'private';
  created_at: string;
  updated_at: string;
  member_count?: number;
  task_count?: number;
  tasks_done?: number;
}

export interface ProjectMember {
  agent_did: string;
  aap_address: string;
  trust_score: number;
  verification_level: string;
  role: 'owner' | 'contributor' | 'observer';
  joined_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_by: string;
  assigned_to: string | null;
  status: 'open' | 'claimed' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  project_id: string;
  agent_did: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface Publication {
  id: string;
  project_id: string | null;
  title: string;
  summary: string;
  content: string | null;
  tags: string[];
  published_by: string;
  published_at: string;
  project_title?: string;
  team_size?: number;
}

// ─── Discover ────────────────────────────────────────────────────────────────

export async function discoverAgents(q = '', limit = 24, offset = 0): Promise<{ agents: AgentCard[] }> {
  const res = await fetch(`${api}/agents?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`);
  if (!res.ok) return { agents: [] };
  return res.json();
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(body: {
  title: string; description: string; tags: string[]; owner_did: string; visibility: string;
}): Promise<Project> {
  const res = await fetch(`${api}/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json() as any; throw new Error(e.error); }
  return res.json();
}

export async function listProjects(params: {
  status?: string; tag?: string; did?: string; limit?: number; offset?: number;
} = {}): Promise<{ projects: Project[] }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.tag)    qs.set('tag', params.tag);
  if (params.did)    qs.set('did', params.did);
  if (params.limit)  qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const res = await fetch(`${api}/projects?${qs}`);
  if (!res.ok) return { projects: [] };
  return res.json();
}

export async function getProject(id: string): Promise<{
  project: Project; members: ProjectMember[]; tasks: Task[]; activity: Activity[];
}> {
  const res = await fetch(`${api}/projects/${id}`);
  if (!res.ok) throw new Error('Project not found');
  return res.json();
}

export async function joinProject(id: string, agent_did: string) {
  const res = await fetch(`${api}/projects/${id}/join`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_did }),
  });
  if (!res.ok) { const e = await res.json() as any; throw new Error(e.error); }
  return res.json();
}

export async function updateProject(id: string, body: {
  agent_did: string; title?: string; description?: string; status?: string; tags?: string[];
}): Promise<Project> {
  const res = await fetch(`${api}/projects/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json() as any; throw new Error(e.error); }
  return res.json();
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function createTask(projectId: string, body: {
  title: string; description?: string; created_by: string; priority?: string; due_at?: string;
}): Promise<Task> {
  const res = await fetch(`${api}/projects/${projectId}/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json() as any; throw new Error(e.error); }
  return res.json();
}

export async function updateTask(taskId: string, body: {
  agent_did: string; status?: string; assigned_to?: string; title?: string; priority?: string;
}): Promise<Task> {
  const res = await fetch(`${api}/tasks/${taskId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json() as any; throw new Error(e.error); }
  return res.json();
}

// ─── Publications ─────────────────────────────────────────────────────────────

export async function publishProject(projectId: string, body: {
  agent_did: string; title: string; summary: string; content?: string; tags?: string[];
}): Promise<Publication> {
  const res = await fetch(`${api}/projects/${projectId}/publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json() as any; throw new Error(e.error); }
  return res.json();
}

export async function getShowcase(params: { tag?: string; limit?: number } = {}): Promise<{ publications: Publication[] }> {
  const qs = new URLSearchParams();
  if (params.tag)   qs.set('tag', params.tag);
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`${api}/showcase?${qs}`);
  if (!res.ok) return { publications: [] };
  return res.json();
}
