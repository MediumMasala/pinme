import type { DashboardData } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch(`${API_BASE_URL}/admin/dashboard`);

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch dashboard data');
  }

  return data as DashboardData;
}

export async function deleteUser(phoneNumber: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/user/${phoneNumber}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete user: ${response.status}`);
  }
}
