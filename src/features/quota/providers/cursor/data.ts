import { fetchCursorQuota, type CursorQuotaData, type CursorQuotaState } from '@/services/api/cursorQuota';
import { isDisabledAuthFile, resolveAuthProvider } from '@/utils/quota/validators';
import type { QuotaProviderData } from '../types';

export const CURSOR_CONFIG: QuotaProviderData<CursorQuotaState, CursorQuotaData> = {
  type: 'cursor',
  i18nPrefix: 'cursor_quota',
  filterFn: (file) => resolveAuthProvider(file) === 'cursor' && !isDisabledAuthFile(file),
  fetchQuota: async (file, t) => {
    const index = file.authIndex ?? file.auth_index;
    if (index === null || index === undefined || String(index).trim() === '') throw new Error(t('cursor_quota.missing_index'));
    try { return await fetchCursorQuota(String(index)); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('cursor_quota.')) error.message = t(error.message);
      throw error;
    }
  },
  storeSelector: (state) => state.cursorQuota,
  storeSetter: 'setCursorQuota',
  buildLoadingState: () => ({ status: 'loading' }),
  buildSuccessState: (data) => ({ status: 'success', data }),
  buildErrorState: (error, errorStatus) => ({ status: 'error', error, errorStatus }),
};
