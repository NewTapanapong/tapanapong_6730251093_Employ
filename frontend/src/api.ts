import { API_URL } from './config';

export type Employee = {
  id: string;
  name: string;
  position: string;
  status: 'Active' | 'On Leave';
  salary: number;
};

export type SalaryCluster = {
  group: string;
  centroid: number | null;
  count: number;
};

type ApiResult<T> = { success: boolean; message?: string } & T;

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${API_URL}. Check that the server is running and the URL is correct.`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data as ApiResult<T>;
}

export const api = {
  login: (username: string, password: string) => request<{ token: string }>('/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  employees: (token: string, search = '') => request<{ employees: Employee[] }>(`/employees?q=${encodeURIComponent(search)}`, token),
  addEmployee: (token: string, employee: { name: string; position: string; status: Employee['status']; salary: number }) => request<{ employee: Employee }>('/employees', token, {
    method: 'POST',
    body: JSON.stringify(employee),
  }),
  updateEmployee: (token: string, id: string, employee: Omit<Employee, 'id'>) => request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}`, token, {
    method: 'PUT',
    body: JSON.stringify(employee),
  }),
  toggleStatus: (token: string, id: string) => request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}/status`, token, { method: 'PUT' }),
  deleteEmployee: (token: string, id: string) => request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}`, token, { method: 'DELETE' }),
  salaryClusters: (token: string) => request<{ clusters: SalaryCluster[] }>('/employees/salary-clusters', token),
};