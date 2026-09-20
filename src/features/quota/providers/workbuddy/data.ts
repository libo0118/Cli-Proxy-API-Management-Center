import {
  fetchWorkBuddyQuota,
  type WorkBuddyQuotaData,
  type WorkBuddyQuotaState,
} from '@/services/api/workbuddyQuota';
import { isDisabledAuthFile, resolveAuthProvider } from '@/utils/quota/validators';
import type { QuotaProviderData } from '../types';

export const WORKBUDDY_CONFIG: QuotaProviderData<WorkBuddyQuotaState, WorkBuddyQuotaData> = {
  type: 'workbuddy',
  i18nPrefix: 'workbuddy_quota',
  filterFn: (file) => resolveAuthProvider(file) === 'workbuddy' && !isDisabledAuthFile(file),
  fetchQuota: async (file, t) => {
    const index = file.authIndex ?? file.auth_index;
    if (index === null || index === undefined || String(index).trim() === '')
      throw new Error(t('workbuddy_quota.missing_index'));
    try {
      return await fetchWorkBuddyQuota(String(index));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('workbuddy_quota.'))
        error.message = t(error.message);
      throw error;
    }
  },
  storeSelector: (state) => state.workbuddyQuota,
  storeSetter: 'setWorkBuddyQuota',
  buildLoadingState: () => ({ status: 'loading' }),
  buildSuccessState: (data) => ({ status: 'success', data }),
  buildErrorState: (error, errorStatus) => ({ status: 'error', error, errorStatus }),
};
