// @flow
/*
    Pillar Wallet: the personal data locker
    Copyright (C) 2019 Stiftung Pillar Project

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/
import get from 'lodash.get';
import orderBy from 'lodash.orderby';
import { Sentry } from 'react-native-sentry';
import { sdkConstants } from '@smartwallet/sdk';
import { NETWORK_PROVIDER } from 'react-native-dotenv';

// constants
import {
  SET_HISTORY,
  TRANSACTION_PENDING_EVENT,
  TRANSACTION_CONFIRMATION_EVENT,
  TRANSACTION_CONFIRMATION_SENDER_EVENT,
  SET_GAS_INFO,
  TX_CONFIRMED_STATUS,
  TX_FAILED_STATUS,
  TX_PENDING_STATUS,
} from 'constants/historyConstants';
import { UPDATE_APP_SETTINGS } from 'constants/appSettingsConstants';
import { ETH } from 'constants/assetsConstants';
import {
  SET_SMART_WALLET_LAST_SYNCED_TRANSACTION_ID,
  SMART_WALLET_UPGRADE_STATUSES,
} from 'constants/smartWalletConstants';

// utils
import { buildHistoryTransaction, updateAccountHistory, updateHistoryRecord } from 'utils/history';
import {
  checkIfKeyBasedAccount,
  checkIfSmartWalletAccount,
  getAccountAddress,
  getAccountId,
  getAccountWalletId,
  getActiveAccount,
  getActiveAccountAddress,
  getActiveAccountId,
} from 'utils/accounts';
import { addressesEqual, getAssetsAsList } from 'utils/assets';
import { getEthereumProvider, uniqBy } from 'utils/common';
import { parseSmartWalletTransactions } from 'utils/smartWallet';

// services
import smartWalletService from 'services/smartWallet';
import { accountAssetsSelector } from 'selectors/assets';

// types
import type SDKWrapper from 'services/api';
import type { Dispatch, GetState } from 'reducers/rootReducer';

// actions
import { checkForMissedAssetsAction, fetchAssetsBalancesAction } from './assetsActions';
import { saveDbAction } from './dbActions';
import { getExistingTxNotesAction } from './txNoteActions';
import { checkAssetTransferTransactionsAction, syncVirtualAccountTransactionsAction } from './smartWalletActions';
import { checkEnableExchangeAllowanceTransactionsAction } from './exchangeActions';

const TRANSACTIONS_HISTORY_STEP = 10;

const currentProvider = getEthereumProvider(NETWORK_PROVIDER);

const afterHistoryUpdatedAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      featureFlags: {
        data: {
          SMART_WALLET_ENABLED: smartWalletFeatureEnabled,
        },
      },
    } = getState();
    if (smartWalletFeatureEnabled) dispatch(checkAssetTransferTransactionsAction());
    dispatch(checkEnableExchangeAllowanceTransactionsAction());
  };
};

const syncAccountHistory = (apiHistory, accountId, dispatch, getState) => {
  const { history: { data: currentHistory } } = getState();
  const accountHistory = currentHistory[accountId] || [];

  const pendingTransactions = apiHistory.filter(tx => tx.status === TX_PENDING_STATUS);
  const minedTransactions = apiHistory.filter(tx => tx.status !== TX_PENDING_STATUS);

  const updatedAccountHistory = uniqBy([...minedTransactions, ...accountHistory, ...pendingTransactions], 'hash');
  const updatedHistory = updateAccountHistory(currentHistory, accountId, updatedAccountHistory);
  dispatch(saveDbAction('history', { history: updatedHistory }, true));

  dispatch({
    type: SET_HISTORY,
    payload: updatedHistory,
  });

  dispatch(afterHistoryUpdatedAction());
};

// NOTE: use this action for key based accounts only
export const fetchAssetTransactionsAction = (asset: string = 'ALL', fromIndex: number = 0) => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const { accounts: { data: accounts } } = getState();

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount || checkIfSmartWalletAccount(activeAccount)) return;
    const accountId = getAccountId(activeAccount);
    const accountAddress = getAccountAddress(activeAccount);

    const history = await api.fetchHistory({
      address1: accountAddress,
      asset,
      nbTx: TRANSACTIONS_HISTORY_STEP,
      fromIndex,
    });

    if (!history.length) return;

    dispatch(getExistingTxNotesAction());
    syncAccountHistory(history, accountId, dispatch, getState);
  };
};

export const fetchSmartWalletTransactionsAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      accounts: { data: accounts },
      assets: { supportedAssets },
      smartWallet: { lastSyncedTransactionId },
    } = getState();

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount || !checkIfSmartWalletAccount(activeAccount)) return;

    await dispatch(syncVirtualAccountTransactionsAction());

    const accountId = getActiveAccountId(accounts);
    const smartWalletTransactions = await smartWalletService.getAccountTransactions(lastSyncedTransactionId);
    const accountAssets = accountAssetsSelector(getState());
    const assetsList = getAssetsAsList(accountAssets);
    const history = parseSmartWalletTransactions(smartWalletTransactions, supportedAssets, assetsList);

    if (!history.length) return;

    if (smartWalletTransactions.length) {
      const newLastSyncedId = smartWalletTransactions[0].id;
      dispatch({
        type: SET_SMART_WALLET_LAST_SYNCED_TRANSACTION_ID,
        payload: newLastSyncedId,
      });
      dispatch(saveDbAction('smartWallet', { lastSyncedTransactionId: newLastSyncedId }));
    }

    dispatch(getExistingTxNotesAction());
    syncAccountHistory(history, accountId, dispatch, getState);
  };
};

// NOTE: use this action for key based accounts only
export const fetchContactTransactionsAction = (contactAddress: string, asset?: string = 'ALL') => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const { accounts: { data: accounts } } = getState();

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount || checkIfSmartWalletAccount(activeAccount)) return;

    const accountId = getAccountId(activeAccount);
    const accountAddress = getAccountAddress(activeAccount);

    const history = await api.fetchHistory({
      address1: accountAddress,
      address2: contactAddress,
      asset,
      nbTx: TRANSACTIONS_HISTORY_STEP,
      fromIndex: 0,
    });
    if (!history.length) return;

    syncAccountHistory(history, accountId, dispatch, getState);
  };
};

// NOTE: use this action for key based accounts only
export const fetchTransactionsHistoryNotificationsAction = () => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const {
      accounts: { data: accounts },
      appSettings: { data: { lastTxSyncDatetimes = {} } },
    } = getState();

    // TODO: that's the only action that should be called for both types of accounts
    // maybe we should move it to some other place?
    await dispatch(checkForMissedAssetsAction());

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount || checkIfSmartWalletAccount(activeAccount)) return;

    const accountId = getAccountId(activeAccount);
    const walletId = getAccountWalletId(activeAccount);
    const lastTxSyncDatetime = lastTxSyncDatetimes[accountId] || 0;

    const d = new Date(lastTxSyncDatetime * 1000);
    const types = [
      TRANSACTION_PENDING_EVENT,
      TRANSACTION_CONFIRMATION_EVENT,
      TRANSACTION_CONFIRMATION_SENDER_EVENT,
    ];
    const historyNotifications = await api.fetchNotifications(walletId, types.join(' '), d.toISOString());
    const mappedHistoryNotifications = historyNotifications
      .map(({ payload, type, createdAt }) => ({ ...payload, type, createdAt }));

    const minedTransactions = mappedHistoryNotifications
      .filter(tx => tx.status !== TX_PENDING_STATUS)
      .reduce((memo, tx) => {
        memo[tx.hash] = tx;
        return memo;
      }, {});

    const pendingTransactions = mappedHistoryNotifications
      .filter(tx => tx.status === TX_PENDING_STATUS);

    // add new records & update data for mined transactions
    const { history: { data: currentHistory } } = getState();
    const accountHistory = (currentHistory[accountId] || []).filter(tx => !!tx.createdAt);
    const updatedAccountHistory = uniqBy([...accountHistory, ...pendingTransactions], 'hash')
      .map(tx => {
        if (!minedTransactions[tx.hash]) return tx;
        const {
          status,
          gasUsed,
          gasPrice,
          blockNumber,
        } = minedTransactions[tx.hash];
        return {
          ...tx,
          status,
          gasUsed: gasUsed || tx.gasUsed,
          gasPrice: gasPrice || tx.gasPrice,
          blockNumber,
        };
      });

    const lastCreatedAt = Math.max(...updatedAccountHistory.map(({ createdAt }) => createdAt).concat(0)) || 0;
    const updatedHistory = updateAccountHistory(currentHistory, accountId, updatedAccountHistory);
    dispatch(saveDbAction('history', { history: updatedHistory }, true));
    const updatedLastTxSyncDatetimes = {
      ...lastTxSyncDatetimes,
      [accountId]: lastCreatedAt,
    };
    dispatch(saveDbAction('app_settings', { appSettings: { lastTxSyncDatetimes: updatedLastTxSyncDatetimes } }));
    dispatch({
      type: UPDATE_APP_SETTINGS,
      payload: { lastTxSyncDatetimes: updatedLastTxSyncDatetimes },
    });
    dispatch({
      type: SET_HISTORY,
      payload: updatedHistory,
    });
    dispatch(afterHistoryUpdatedAction());
  };
};

export const fetchGasInfoAction = () => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const gasInfo = await api.fetchGasInfo();
    dispatch({
      type: SET_GAS_INFO,
      payload: gasInfo,
    });
  };
};

export const updateTransactionStatusAction = (hash: string) => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const {
      accounts: { data: accounts },
      session: { data: { isOnline } },
    } = getState();

    if (!isOnline) return;

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount) return;

    const txInfo = await api.fetchTxInfo(hash);
    const txReceipt = await api.fetchTransactionReceipt(hash);
    const lastBlockNumber = await api.fetchLastBlockNumber();
    if (!txInfo || !txReceipt || !lastBlockNumber) return;

    const nbConfirmations = lastBlockNumber - txReceipt.blockNumber;
    const status = txReceipt.status ? TX_CONFIRMED_STATUS : TX_FAILED_STATUS;

    if (checkIfSmartWalletAccount(activeAccount)) {
      const sdkRawStatus = await smartWalletService.getTransactionStatus(hash);
      const TRANSACTION_COMPLETED = get(sdkConstants, 'AccountTransactionStates.Completed', '');
      // TODO: add support for failed transactions
      const sdkStatus = sdkRawStatus === TRANSACTION_COMPLETED ? TX_CONFIRMED_STATUS : TX_PENDING_STATUS;
      if (sdkStatus !== status) {
        console.log('Wrong transaction status');
        Sentry.captureMessage('Wrong transaction status', {
          level: 'info',
          extra: {
            hash,
            sdkStatus,
            blockchainStatus: status,
          },
        });
      }
      return;
    }

    const { history: { data: currentHistory } } = getState();
    const { updatedHistory } = updateHistoryRecord(
      currentHistory,
      hash,
      (transaction) => ({
        ...transaction,
        nbConfirmations,
        status,
        gasPrice: txInfo.gasPrice ? txInfo.gasPrice.toNumber() : transaction.gasPrice,
        gasUsed: txReceipt.gasUsed ? txReceipt.gasUsed.toNumber() : transaction.gasUsed,
      }));

    dispatch({
      type: SET_HISTORY,
      payload: updatedHistory,
    });

    dispatch(saveDbAction('history', { history: updatedHistory }, true));
    dispatch(afterHistoryUpdatedAction());
    dispatch(fetchAssetsBalancesAction());
  };
};

// NOTE: use this action for key based accounts only
export const restoreTransactionHistoryAction = () => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const {
      accounts: { data: accounts },
      user: { data: { walletId } },
    } = getState();

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount || checkIfSmartWalletAccount(activeAccount)) return;
    const walletAddress = getAccountAddress(activeAccount);

    const [allAssets, _erc20History, ethHistory] = await Promise.all([
      api.fetchSupportedAssets(walletId),
      api.importedErc20TransactionHistory(walletAddress),
      api.importedEthTransactionHistory(walletAddress),
    ]);

    if (!allAssets || !allAssets.length) return;
    if (!Array.isArray(allAssets)) {
      // sentry issue ID 1308336621
      Sentry.captureMessage('Wrong allAssets type received from back-end', { extra: { allAssets } });
      return;
    }

    const erc20History = _erc20History.filter(tx => {
      const hashExists = ethHistory.find(el => el.hash === tx.transactionHash);
      return !hashExists;
    });

    const { history: { data: currentHistory } } = getState();
    const accountHistory = currentHistory[walletAddress] || [];

    // 1) filter out records those exists in accountHistory
    const ethTransactions = ethHistory.filter(tx => {
      const hashExists = accountHistory.find(el => el.hash === tx.hash);
      return !hashExists;
    });

    // 2) filter out records those exists in accountHistory
    const erc20Transactions = erc20History
      .filter(tx => {
        const hashExists = accountHistory.find(el => el.hash === tx.transactionHash);
        return !hashExists;
      })
      // 3) filter out unsupported tokens
      .filter(tx => {
        const tokenAddress = get(tx, 'tokenInfo.address');
        const tokenSupported = allAssets.find(el => addressesEqual(el.address, tokenAddress));
        return !!tokenAddress && tokenSupported;
      });

    // 4) combine accountHistory, ethHistory and erc20History (convert to the same format)
    const updatedAccountHistory = [
      ...accountHistory,
      ...ethTransactions.map(tx => buildHistoryTransaction({
        from: tx.from,
        to: tx.to,
        hash: tx.hash,
        value: tx.value,
        asset: ETH,
        createdAt: tx.timestamp,
        status: tx.success ? TX_CONFIRMED_STATUS : TX_FAILED_STATUS,
      })),
      ...erc20Transactions.map(tx => {
        const tokenAddress = get(tx, 'tokenInfo.address');
        const assetInfo = allAssets.find(el => addressesEqual(el.address, tokenAddress)) || {};
        return buildHistoryTransaction({
          asset: assetInfo.symbol,
          createdAt: tx.timestamp,
          from: tx.from,
          hash: tx.transactionHash,
          status: TX_CONFIRMED_STATUS,
          to: tx.to,
          value: tx.value,
        });
      }),
    ];

    // 5) sort by date
    const sortedHistory = orderBy(updatedAccountHistory, ['createdAt'], ['desc']);

    // 6) update history in storage
    const updatedHistory = updateAccountHistory(currentHistory, walletAddress, sortedHistory);

    await dispatch(saveDbAction('history', { history: updatedHistory }, true));
    dispatch({
      type: SET_HISTORY,
      payload: updatedHistory,
    });
  };
};

/*
 * Unified method to fetch tx history for key based and smart wallets
 * For the key based wallet it uses ethplorer as a data provider
 * For smart wallets data will be fetched through the Archanova SDK
 */
export const fetchTransactionsHistoryAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const { accounts: { data: accounts } } = getState();

    const activeAccount = getActiveAccount(accounts);
    if (!activeAccount) return Promise.resolve();

    if (checkIfKeyBasedAccount(activeAccount)) {
      return dispatch(restoreTransactionHistoryAction());
    }

    return dispatch(fetchSmartWalletTransactionsAction());
  };
};

export const startListeningForBalanceChangeAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      accounts: { data: accounts },
      smartWallet: {
        upgrade: {
          status: upgradeStatus,
          transfer: {
            transactions: transferTransactions = [],
          },
        },
      },
    } = getState();
    if (upgradeStatus !== SMART_WALLET_UPGRADE_STATUSES.TRANSFERRING_ASSETS || !transferTransactions.length) return;

    const activeAccount = getActiveAccount(accounts);
    if (activeAccount) {
      const walletAddress = getAccountAddress(activeAccount);

      currentProvider.on(walletAddress, () => {
        dispatch(fetchAssetsBalancesAction(true));
      });
    }
  };
};

export const stopListeningForBalanceChangeAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      accounts: { data: accounts },
    } = getState();
    const walletAddress = getActiveAccountAddress(accounts);
    if (walletAddress && currentProvider) {
      currentProvider.removeListener(walletAddress);
    }
  };
};
