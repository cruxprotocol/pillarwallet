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
import {
  TRANSACTION_CONFIRMATION_EVENT,
  TRANSACTION_CONFIRMATION_SENDER_EVENT,
  TRANSACTION_PENDING_EVENT,
  TX_PENDING_STATUS,
} from 'constants/historyConstants';
import type { Transaction, TransactionEthers, TransactionsStore } from 'models/Transaction';

export const buildHistoryTransaction = ({
  from,
  hash,
  to,
  value,
  gasPrice,
  gasLimit,
  asset,
  note,
  status,
  createdAt,
  isPPNTransaction,
  tag,
  extra,
  stateInPPN,
}: TransactionEthers): Transaction => ({
  status: status || TX_PENDING_STATUS,
  gasUsed: gasLimit ? Number(gasLimit) : 0,
  gasPrice: gasPrice ? Number(gasPrice) : 0,
  value: typeof value === 'object' ? value.toString() : value,
  from,
  hash,
  to,
  _id: hash,
  asset,
  createdAt: createdAt || Math.round(+new Date() / 1000), // seconds
  nbConfirmations: 0,
  note,
  isPPNTransaction: !!isPPNTransaction,
  tag,
  extra,
  stateInPPN,
});

export const isTransactionEvent = (eventType: string) => {
  return [
    TRANSACTION_PENDING_EVENT,
    TRANSACTION_CONFIRMATION_EVENT,
    TRANSACTION_CONFIRMATION_SENDER_EVENT,
  ].includes(eventType);
};

export const updateAccountHistory = (
  history: TransactionsStore,
  accountId: string,
  accountHistory: Transaction[] = [],
) => {
  return {
    ...history,
    [accountId]: accountHistory,
  };
};

type UpdateHistoryRecordResult = {
  updatedHistory: TransactionsStore,
  txUpdated: ?Transaction,
};

export function updateHistoryRecord(
  allHistory: TransactionsStore,
  hashToUpdate: string,
  modifier: Function,
): UpdateHistoryRecordResult {
  hashToUpdate = hashToUpdate.toLowerCase();

  let txUpdated = null;
  const accounts = Object.keys(allHistory);
  const updatedHistory = accounts.reduce((history, accountId) => {
    const accountHistory = allHistory[accountId].map(transaction => {
      if (transaction.hash.toLowerCase() !== hashToUpdate) {
        return transaction;
      }
      txUpdated = modifier(transaction);
      return txUpdated;
    });
    return { ...history, [accountId]: accountHistory };
  }, {});

  return {
    updatedHistory,
    txUpdated,
  };
}
