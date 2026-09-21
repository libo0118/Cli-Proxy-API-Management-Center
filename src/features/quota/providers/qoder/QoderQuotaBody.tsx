import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import type { QoderQuotaState } from '@/services/api/qoderQuota';
import { buildResetDisplay, formatInstantShort, parseIsoToMs } from '@/utils/quota';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import styles from '../../components/QuotaBody.module.scss';
import type { QuotaBodyProps } from '../../types';

export function QoderQuotaBody({ quota, classes }: QuotaBodyProps<QoderQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const format = (value: number) =>
    value.toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  if (!quota.data?.pools.length)
    return <div className={classes.quotaMessage}>{t('qoder_quota.empty_data')}</div>;
  return (
    <>
      {quota.data.plan && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanValue}>{quota.data.plan}</span>
        </div>
      )}
      {quota.data.pools.map((pool, index) => {
        const expired = pool.expiresAt !== null && Date.parse(pool.expiresAt) <= now;
        const expiresAtMs = parseIsoToMs(pool.expiresAt);
        const expiryDisplay = pool.expiresAt
          ? buildResetDisplay(
              t('qoder_quota.expires', {
                date: expiresAtMs === null ? pool.expiresAt : formatInstantShort(expiresAtMs),
              }),
              expiresAtMs,
              now,
              i18n.resolvedLanguage
            )
          : null;
        const percent =
          pool.total !== null && pool.total > 0
            ? Math.min(100, (pool.remaining / pool.total) * 100)
            : null;
        return (
          <div className={classes.quotaRow} key={`${pool.kind}:${index}`}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>
                {pool.name || t(`qoder_quota.${pool.kind}`)}
              </span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>
                  {t('qoder_quota.remaining', { amount: format(pool.remaining) })}
                </span>
              </div>
            </div>
            {percent !== null && <QuotaMeter percent={percent} classes={classes} index={index} />}
            <div className={`${classes.quotaMeta} ${styles.creditDetails}`}>
              <span className={classes.quotaAmount}>
                {pool.total === null
                  ? t('qoder_quota.used_unknown', { used: format(pool.used) })
                  : t('qoder_quota.used_total', {
                      used: format(pool.used),
                      total: format(pool.total),
                    })}
              </span>
              {expiryDisplay && (
                <span title={pool.expiresAt ?? undefined}>
                  <QuotaResetLabel display={expiryDisplay} classes={classes} />
                </span>
              )}
            </div>
            {pool.kind === 'dedicated' && (
              <div className={classes.quotaMessage}>{t('qoder_quota.dedicated_hint')}</div>
            )}
            {(expired || !pool.available) && (
              <div className={classes.quotaMessage}>
                {t(expired ? 'qoder_quota.expired' : 'qoder_quota.unavailable')}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
