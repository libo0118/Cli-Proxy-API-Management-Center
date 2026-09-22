import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  buildOAuthProviderOptions,
  getAuthFileIcon,
  QUOTA_PROVIDER_TYPES,
  supportsAuthFileManualRefresh,
} from '../src/features/authFiles/constants';
import { resolveAuthFileQuotaType } from '../src/features/authFiles/logic';
import { parseCursorQuota } from '../src/services/api/cursorQuota';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { CursorQuotaBody } from '../src/features/quota/providers/cursor/CursorQuotaBody';
import type { QuotaBodyProps } from '../src/features/quota/types';
import type { CursorQuotaState } from '../src/services/api/cursorQuota';

describe('Cursor auth files', () => {
  test('renders Free plan percentage without inventing monetary quota', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'zh-CN', resources: { 'zh-CN': { translation: { cursor_quota: { plan: '套餐额度', remaining: '剩余 {{amount}}', used_total: '已用 {{used}} / {{total}}' } } } } });
    const props: QuotaBodyProps<CursorQuotaState> = {
      quota: { status: 'success', data: { plan: 'Free', windows: [{ key: 'plan', label: 'Plan', used: null, limit: null, remaining: null, remainingFraction: 1, resetTime: null }] } },
      classes: {} as QuotaBodyProps<CursorQuotaState>['classes'],
    };
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(CursorQuotaBody, props)));
    expect(html).toContain('剩余 100%');
    expect(html).toContain('套餐额度');
    expect(html).not.toContain('已用');
  });
  test('recognizes the brand and quota without declaring credential refresh', () => {
    expect(buildOAuthProviderOptions(['cursor', 'future-provider'])).toContain('cursor');
    expect(buildOAuthProviderOptions(['cursor', 'future-provider'])).toContain('future-provider');
    expect(getAuthFileIcon(' Cursor ', 'light')).toBe(
      'https://ptht05hbb1ssoooe.public.blob.vercel-storage.com/assets/brand/brand-logo-5.svg'
    );
    expect([...QUOTA_PROVIDER_TYPES]).toContain('cursor');
    expect(resolveAuthFileQuotaType({ name: 'cursor.json', type: 'cursor' }, 'all')).toBe('cursor');
    expect(supportsAuthFileManualRefresh('cursor')).toBe(false);
    for (const provider of ['qoder', 'workbuddy', 'codex'] as const) {
      expect(QUOTA_PROVIDER_TYPES.has(provider)).toBe(true);
    }
  });

  test('all locales name Cursor and provide quota text', () => {
    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru']) {
      const messages = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'));
      expect(messages.auth_files.filter_cursor).toBe('Cursor');
      expect(messages.cursor_quota.remaining).toBeTruthy();
    }
  });

  test('keeps USD, zero, missing amounts, stable windows and reset times distinct', () => {
    const data = parseCursorQuota({
      subscription: { plan: 'Pro' },
      groups: [{ displayName: 'Plan', buckets: [{ window: 'plan', remainingFraction: 0, resetTime: '2026-10-01T00:00:00Z' }] }],
      summary: [
        { key: 'plan_remaining', value: 0, format: 'currency', currency: 'USD' },
        { key: 'plan_used', value: 12.34, format: 'currency', currency: 'USD' },
        { key: 'on_demand_team_used', value: 1.25, format: 'currency', currency: 'USD' },
      ],
    });
    expect(data.plan).toBe('Pro');
    expect(data.windows[0]).toMatchObject({ key: 'plan', remaining: 0, used: 12.34, limit: null, remainingFraction: 0, resetTime: '2026-10-01T00:00:00Z' });
    expect(data.windows[1]).toMatchObject({ key: 'on_demand_team', used: 1.25, remaining: null, remainingFraction: null, resetTime: null });
    expect(() => parseCursorQuota({ error: 'failed' })).toThrow();
    expect(() => parseCursorQuota({ groups: [] })).toThrow();
    expect(() => parseCursorQuota({ groups: [{ buckets: [{ window: 'plan', remainingFraction: 2 }] }] })).toThrow();
  });
});
