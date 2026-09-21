import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useAuthStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { isRecord } from '@/utils/helpers';
import {
  keyPoliciesApi,
  policyPeriods,
  validPolicyAmount,
  type KeyPolicy,
  type PolicyPeriod,
  type PolicyReport,
} from '@/services/api/keyPolicies';
import styles from './KeyPoliciesPage.module.scss';

export function KeyPoliciesPage() {
  const { t } = useTranslation();
  const apiBase = useAuthStore((s) => s.apiBase);
  const managementKey = useAuthStore((s) => s.managementKey);
  const connected = useAuthStore((s) => s.isAuthenticated && s.connectionStatus === 'connected');
  const generation = useRef(0);
  const [report, setReport] = useState<PolicyReport | null>(null);
  const [draft, setDraft] = useState<KeyPolicy | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const currentSession = useCallback(() => {
    const s = useAuthStore.getState();
    return (
      s.isAuthenticated &&
      s.connectionStatus === 'connected' &&
      s.apiBase === apiBase &&
      s.managementKey === managementKey
    );
  }, [apiBase, managementKey]);
  const errorText = useCallback(
    (err: unknown) =>
      t(
        isRecord(err) && err.status === 404
          ? 'key_policies.unavailable'
          : isRecord(err) && err.status === 409
            ? 'key_policies.conflict'
            : 'key_policies.failed'
      ),
    [t]
  );
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    if (!currentSession()) return;
    setBusy(true);
    setError('');
    try {
      const data = await keyPoliciesApi.get();
      if (ticket !== generation.current || !currentSession()) return;
      setReport(data);
      setDraft(null);
      setStale(false);
    } catch (err) {
      if (ticket === generation.current && currentSession()) setError(errorText(err));
    } finally {
      if (ticket === generation.current && currentSession()) setBusy(false);
    }
  }, [currentSession, errorText]);
  useEffect(() => {
    setReport(null);
    setDraft(null);
    setStale(false);
    setError('');
    setBusy(false);
    if (connected) void load();
    return () => {
      generation.current += 1;
    };
  }, [connected, load]);
  useHeaderRefresh(load, connected && !busy && !draft);
  const save = async () => {
    if (!draft || !currentSession() || busy || stale) return;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      await keyPoliciesApi.save(revision, draft);
      if (ticket !== generation.current || !currentSession()) return;
      await load();
    } catch (err) {
      if (ticket === generation.current && currentSession()) {
        setError(errorText(err));
        if (isRecord(err) && err.status === 409) setStale(true);
      }
    } finally {
      if (ticket === generation.current && currentSession()) setBusy(false);
    }
  };
  const changeRule = (resourceId: string, change: Partial<KeyPolicy['rules'][number]>) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          rules: d.rules.map((r) => (r.resourceId === resourceId ? { ...r, ...change } : r)),
        }
    );
  const invalid = draft?.rules.some((r) => r.limitUsd !== null && !validPolicyAmount(r.limitUsd));
  const resourceName = (id: string) =>
    report?.resources.find((r) => r.resourceId === id)?.label || id;
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('key_policies.title')}</h1>
        <Button variant="secondary" disabled={busy || !connected} onClick={() => void load()}>
          {t('key_policies.reload')}
        </Button>
      </div>
      <Card>
        <p className={styles.note}>
          {t('key_policies.intro')} <Link to="/api-keys">{t('key_policies.manage_keys')}</Link>
        </p>
        <p className={styles.note}>{t('key_policies.soft_budget')}</p>
        <p className={styles.note}>{t('key_policies.period_help')}</p>
      </Card>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {busy && <p role="status">{t('common.loading')}</p>}
      {report && currentSession() && (
        <>
          <Card title={t('key_policies.keys')}>
            {!report.keys.length ? (
              <p>{t('key_policies.empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {['key', 'scope', 'actions'].map((k) => (
                      <TableHead key={k}>{t('key_policies.' + k)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.keys.map((key) => (
                    <TableRow key={key.keyId} selected={draft?.keyId === key.keyId}>
                      <TableCell>
                        <code>{key.keyPreview}</code>
                        <span className={styles.meta}>{key.label || '—'}</span>
                      </TableCell>
                      <TableCell>
                        {t(
                          key.allowAll
                            ? 'key_policies.all'
                            : key.rules.length
                              ? 'key_policies.selected'
                              : 'key_policies.deny'
                        )}{' '}
                        {!key.allowAll && key.rules.length > 0 && '(' + key.rules.length + ')'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setDraft({ ...key, rules: key.rules.map((r) => ({ ...r })) });
                            setRevision(report.revision);
                            setStale(false);
                            setError('');
                            requestAnimationFrame(() =>
                              editor.current?.scrollIntoView({ block: 'start' })
                            );
                          }}
                        >
                          {t('key_policies.edit')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {draft && (
            <div ref={editor} className={styles.editor}>
              <Card title={t('key_policies.edit') + ' · ' + draft.keyPreview}>
                <fieldset disabled={busy || stale} style={{ border: 0, padding: 0, minWidth: 0 }}>
                  <Input
                    label={t('key_policies.label')}
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={draft.allowAll}
                      onChange={(e) => setDraft({ ...draft, allowAll: e.target.checked })}
                    />
                    {t('key_policies.all')}
                  </label>
                  <p className={styles.note}>
                    {t(draft.allowAll ? 'key_policies.all_help' : 'key_policies.selected_help')}
                  </p>
                  {[
                    ...report.resources,
                    ...draft.rules
                      .filter((r) => !report.resources.some((v) => v.resourceId === r.resourceId))
                      .map((r) => ({
                        resourceId: r.resourceId,
                        label: t('key_policies.missing'),
                        provider: '',
                        kind: '',
                        disabled: true,
                        models: [],
                        fileName: '',
                      })),
                  ].map((resource) => {
                    const rule = draft.rules.find((r) => r.resourceId === resource.resourceId);
                    return (
                      <div className={styles.rule} key={resource.resourceId}>
                        <label className={styles.check}>
                          <input
                            type="checkbox"
                            checked={!!rule}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                rules: e.target.checked
                                  ? [
                                      ...draft.rules,
                                      {
                                        resourceId: resource.resourceId,
                                        period: 'month',
                                        limitUsd: null,
                                      },
                                    ]
                                  : draft.rules.filter((r) => r.resourceId !== resource.resourceId),
                              })
                            }
                          />
                          <strong>{resource.label || resource.resourceId}</strong>
                        </label>
                        {resource.fileName && (
                          <code className={styles.meta}>{resource.fileName}</code>
                        )}
                        <span className={styles.meta}>
                          {resource.kind
                            ? t('key_policies.kind_' + resource.kind)
                            : t('key_policies.missing')}{' '}
                          · {resource.provider}{' '}
                          {resource.disabled && '· ' + t('key_policies.disabled')}
                          <br />
                          {resource.resourceId}
                          <br />
                          {resource.models.join(', ')}
                        </span>
                        {rule && (
                          <div className={styles.fields}>
                            <label>
                              {t('key_policies.period')}
                              <select
                                className="input"
                                value={rule.period}
                                onChange={(e) =>
                                  changeRule(rule.resourceId, {
                                    period: e.target.value as PolicyPeriod,
                                  })
                                }
                              >
                                {policyPeriods.map((p) => (
                                  <option key={p} value={p}>
                                    {t('key_policies.period_' + p)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div>
                              <label className={styles.check}>
                                <input
                                  type="checkbox"
                                  checked={rule.limitUsd === null}
                                  onChange={(e) =>
                                    changeRule(rule.resourceId, {
                                      limitUsd: e.target.checked ? null : '0',
                                    })
                                  }
                                />
                                {t('key_policies.unlimited')}
                              </label>
                              {rule.limitUsd !== null && (
                                <Input
                                  label={t('key_policies.limit')}
                                  inputMode="decimal"
                                  value={rule.limitUsd}
                                  error={
                                    !validPolicyAmount(rule.limitUsd)
                                      ? t('key_policies.invalid_amount')
                                      : undefined
                                  }
                                  onChange={(e) =>
                                    changeRule(rule.resourceId, { limitUsd: e.target.value })
                                  }
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
                <div className={styles.actions}>
                  <p className={styles.note}>{t('key_policies.price_help')}</p>
                  <Button disabled={busy || stale || invalid} onClick={() => void save()}>
                    {t('key_policies.save')}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
                    {t('key_policies.cancel')}
                  </Button>
                </div>
              </Card>
            </div>
          )}
          <Card title={t('key_policies.usage')}>
            <Table className={styles.usageTable}>
              <TableHeader>
                <TableRow>
                  {[
                    'key',
                    'resource',
                    'period',
                    'used',
                    'reserved',
                    'remaining',
                    'reset',
                    'status',
                  ].map((k) => (
                    <TableHead key={k}>{t('key_policies.' + k)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.budgets
                  .filter((b) => !draft || b.keyId === draft.keyId)
                  .map((b) => (
                    <TableRow key={b.keyId + b.resourceId + b.period}>
                      <TableCell>
                        {report.keys.find((k) => k.keyId === b.keyId)?.keyPreview || '—'}
                      </TableCell>
                      <TableCell>
                        {resourceName(b.resourceId)}
                        <span className={styles.meta}>
                          {report.resources.find((r) => r.resourceId === b.resourceId)?.fileName}
                        </span>
                      </TableCell>
                      <TableCell>{t('key_policies.period_' + b.period)}</TableCell>
                      <TableCell>{b.usedUsd}</TableCell>
                      <TableCell>{b.reservedUsd}</TableCell>
                      <TableCell>{b.remainingUsd ?? t('key_policies.unlimited')}</TableCell>
                      <TableCell>
                        {b.resetAt && !b.resetAt.startsWith('0001') ? b.resetAt : '—'}
                      </TableCell>
                      <TableCell>
                        {b.status}
                        <span className={styles.meta}>
                          {t('key_policies.unpriced', { count: b.unpricedRequests })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
