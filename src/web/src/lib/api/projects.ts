/**
 * Projects API client (IAM-SRS-006, GitHub issue #21).
 * Server enforces project-scoped access: non-admin sees only member projects.
 */
export interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsError {
  status: number;
  message: string;
}

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('buildflow.auth.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed?.accessToken ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    if (msg) throw { status: res.status, message: msg } satisfies ProjectsError;
  }
  throw { status: res.status, message: fallback } satisfies ProjectsError;
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Tải danh sách dự án thất bại (${res.status})`);
  }
  return (await res.json()) as Project[];
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Tải dự án thất bại (${res.status})`);
  }
  return (await res.json()) as Project;
}
