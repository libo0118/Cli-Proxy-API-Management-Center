import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import type { QoderQuotaState } from '@/services/api/qoderQuota';
import { QuotaMeter } from '../../components/QuotaMeter';
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
              <span className={classes.quotaPercent}>
                {t('qoder_quota.remaining', { amount: format(pool.remaining) })}
              </span>
            </div>
            <div className={classes.quotaAmount}>
              {pool.total === null
                ? t('qoder_quota.used_unknown', { used: format(pool.used) })
                : t('qoder_quota.used_total', {
                    used: format(pool.used),
                    total: format(pool.total),
                  })}
            </div>
            {percent !== null && <QuotaMeter percent={percent} classes={classes} index={index} />}
            {pool.kind === 'dedicated' && (
              <div className={classes.quotaMessage}>{t('qoder_quota.dedicated_hint')}</div>
            )}
            {pool.expiresAt && (
              <div className={classes.quotaReset}>
                {t('qoder_quota.expires', {
                  date: new Date(pool.expiresAt).toLocaleString(i18n.resolvedLanguage),
                })}
              </div>
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
