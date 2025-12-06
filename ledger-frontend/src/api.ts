import type { LedgerData } from './types';

const BASE_URL = '/ledger';

export async function checkAuth(): Promise<{ authenticated: boolean; user?: { name: string | null; phoneNumber: string } }> {
  const res = await fetch(`${BASE_URL}/check-auth`, { credentials: 'include' });
  if (!res.ok) {
    return { authenticated: false };
  }
  return res.json();
}

export async function requestOtp(phoneNumber: string): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch(`${BASE_URL}/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
    credentials: 'include',
  });
  return res.json();
}

export async function verifyOtp(phoneNumber: string, code: string): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, code }),
    credentials: 'include',
  });
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getLedgerData(): Promise<LedgerData> {
  const res = await fetch(`${BASE_URL}/data`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to fetch ledger data');
  }
  return res.json();
}
