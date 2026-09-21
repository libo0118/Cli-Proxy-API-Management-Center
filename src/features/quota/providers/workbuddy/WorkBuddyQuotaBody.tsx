import { useTranslation } from 'react-i18next';
import type { WorkBuddyQuotaState } from '@/services/api/workbuddyQuota';
import type { QuotaBodyProps } from '../../types';
import styles from '../../components/QuotaBody.module.scss';
import { QoderQuotaBody } from '../qoder/QoderQuotaBody';

export function WorkBuddyQuotaBody({ quota, classes }: QuotaBodyProps<WorkBuddyQuotaState>) {
  const { t } = useTranslation();
  if (!quota.data)
    return <div className={classes.quotaMessage}>{t('workbuddy_quota.empty_data')}</div>;
  const { summary, pools, plan } = quota.data;
  return (
    <>
      <QoderQuotaBody
        classes={classes}
        quota={{
          ...quota,
          data: { plan, pools: [{ ...summary, name: t('workbuddy_quota.total') }] },
        }}
      />
      {pools.length > 0 && (
        <details className={styles.creditPackages}>
          <summary className={classes.quotaModel}>
            {t('workbuddy_quota.packages', { count: pools.length })}
          </summary>
          <div className={classes.quotaRow}>
            <QoderQuotaBody classes={classes} quota={{ ...quota, data: { plan: '', pools } }} />
          </div>
        </details>
      )}
    </>
  );
}
