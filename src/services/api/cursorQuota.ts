import { apiClient } from './client';

export const CURSOR_WINDOWS = ['plan', 'on_demand_individual', 'on_demand_team', 'credit_grants'] as const;
export interface CursorQuotaWindow {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  remainingFraction: number | null;
  resetTime: string | null;
}
export interface CursorQuotaData { plan: string; windows: CursorQuotaWindow[] }
export interface CursorQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: CursorQuotaData;
  error?: string;
  errorStatus?: number;
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const amount = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('cursor_quota.invalid_data');
  return value;
};

/** The plugin contract reports USD. Keep absent amounts unknown, including real zero. */
export function parseCursorQuota(value: unknown): CursorQuotaData {
  const payload = record(value);
  if (payload.error) throw new Error('cursor_quota.load_error');
  if (payload.groups !== undefined && !Array.isArray(payload.groups))
    throw new Error('cursor_quota.invalid_data');
  if (payload.summary !== undefined && !Array.isArray(payload.summary))
    throw new Error('cursor_quota.invalid_data');
  const metrics = new Map<string, number | null>();
  for (const item of Array.isArray(payload.summary) ? payload.summary : []) {
    const metric = record(item);
    if (metric.format !== 'currency' || metric.currency !== 'USD' || typeof metric.key !== 'string') continue;
    if (metrics.has(metric.key)) throw new Error('cursor_quota.invalid_data');
    metrics.set(metric.key, amount(metric.value));
  }
  const buckets = new Map<string, { bucket: Record<string, unknown>; label: string }>();
  for (const item of Array.isArray(payload.groups) ? payload.groups : []) {
    const group = record(item);
    if (group.buckets !== undefined && !Array.isArray(group.buckets)) throw new Error('cursor_quota.invalid_data');
    for (const value of Array.isArray(group.buckets) ? group.buckets : []) {
      const bucket = record(value);
      if (typeof bucket.window !== 'string') throw new Error('cursor_quota.invalid_data');
      if (buckets.has(bucket.window)) throw new Error('cursor_quota.invalid_data');
      buckets.set(bucket.window, { bucket, label: typeof group.displayName === 'string' ? group.displayName : '' });
    }
  }
  const windows = CURSOR_WINDOWS.flatMap((key): CursorQuotaWindow[] => {
    const match = buckets.get(key);
    const used = metrics.get(`${key}_used`) ?? null;
    const limit = metrics.get(`${key}_limit`) ?? null;
    const remaining = metrics.get(`${key}_remaining`) ?? null;
    const remainingFraction = amount(match?.bucket.remainingFraction);
    if (remainingFraction !== null && remainingFraction > 1) throw new Error('cursor_quota.invalid_data');
    const reset = match?.bucket.resetTime;
    const resetTime = typeof reset === 'string' && Number.isFinite(Date.parse(reset)) ? reset : null;
    if (used === null && limit === null && remaining === null && remainingFraction === null) return [];
    return [{ key, label: match?.label ?? '', used, limit, remaining, remainingFraction, resetTime }];
  });
  const plan = record(payload.subscription).plan;
  if (!windows.length) throw new Error('cursor_quota.empty_data');
  return { plan: typeof plan === 'string' ? plan : '', windows };
}

export async function fetchCursorQuota(authIndex: string): Promise<CursorQuotaData> {
  return parseCursorQuota(await apiClient.post('/quota/fetch', { auth_index: authIndex, provider: 'cursor' }));
}
