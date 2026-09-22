import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import type { CursorQuotaState } from '@/services/api/cursorQuota';
import { buildResetDisplay, formatInstantShort, parseIsoToMs } from '@/utils/quota';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaBodyProps } from '../../types';
import styles from '../../components/QuotaBody.module.scss';

export function CursorQuotaBody({ quota, classes }: QuotaBodyProps<CursorQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const format = (value: number | null) => value === null ? '—' : value.toLocaleString(i18n.resolvedLanguage, { style: 'currency', currency: 'USD' });
  return <>
    {quota.data?.plan && <div className={classes.codexPlan}><span className={classes.codexPlanValue}>{quota.data.plan}</span></div>}
    {quota.data?.windows.map((window, index) => {
      const resetMs = parseIsoToMs(window.resetTime);
      const reset = resetMs === null ? null : buildResetDisplay(formatInstantShort(resetMs), resetMs, now, i18n.resolvedLanguage);
      const remaining = window.remaining !== null ? format(window.remaining) : window.remainingFraction !== null ? `${Math.round(window.remainingFraction * 100)}%` : '—';
      return <div className={classes.quotaRow} key={window.key}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t(`cursor_quota.${window.key}`, { defaultValue: window.label })}</span>
          <span className={classes.quotaPercent}>{t('cursor_quota.remaining', { amount: remaining })}</span>
        </div>
        {window.remainingFraction !== null && <QuotaMeter percent={window.remainingFraction * 100} classes={classes} index={index} />}
        <div className={`${classes.quotaMeta} ${styles.creditDetails}`}>
          {(window.used !== null || window.limit !== null) && <span className={classes.quotaAmount}>{t('cursor_quota.used_total', { used: format(window.used), total: format(window.limit) })}</span>}
          {reset && <span title={window.resetTime ?? undefined}><QuotaResetLabel display={reset} classes={classes} /></span>}
        </div>
      </div>;
    })}
  </>;
}
