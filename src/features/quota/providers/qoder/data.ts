import {
  fetchQoderQuota,
  type QoderQuotaData,
  type QoderQuotaState,
} from '@/services/api/qoderQuota';
import { isDisabledAuthFile, resolveAuthProvider } from '@/utils/quota/validators';
import type { QuotaProviderData } from '../types';

export const QODER_CONFIG: QuotaProviderData<QoderQuotaState, QoderQuotaData> = {
  type: 'qoder',
  i18nPrefix: 'qoder_quota',
  filterFn: (file) => resolveAuthProvider(file) === 'qoder' && !isDisabledAuthFile(file),
  fetchQuota: async (file, t) => {
    const index = file.authIndex ?? file.auth_index;
    if (index === null || index === undefined || String(index).trim() === '') {
      throw new Error(t('qoder_quota.missing_index'));
    }
    try {
      return await fetchQoderQuota(String(index));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('qoder_quota.')) {
        error.message = t(error.message);
      }
      throw error;
    }
  },
  storeSelector: (state) => state.qoderQuota,
  storeSetter: 'setQoderQuota',
  buildLoadingState: () => ({ status: 'loading' }),
  buildSuccessState: (data) => ({ status: 'success', data }),
  buildErrorState: (error, errorStatus) => ({ status: 'error', error, errorStatus }),
};
