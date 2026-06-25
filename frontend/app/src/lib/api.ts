const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function uploadFile(file: File, sessionId?: string): Promise<{ session_id: string; chunks_indexed: number }> {
  const form = new FormData();
  form.append('file', file);
  if (sessionId) {
    form.append('session_id', sessionId);
  }

  const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail ?? 'Upload failed');
  }

  return res.json();
}

export async function askQuestion(question: string, sessionId: string): Promise<{ answer: string }> {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail ?? 'Request failed');
  }

  return res.json();
}

export async function clearSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/session/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to clear session' }));
    throw new Error(err.detail ?? 'Failed to clear session');
  }
}
