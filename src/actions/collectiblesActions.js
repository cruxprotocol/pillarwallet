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
import { COLLECTIBLES } from 'constants/assetsConstants';
import {
  UPDATE_COLLECTIBLES,
  SET_COLLECTIBLES_TRANSACTION_HISTORY,
  COLLECTIBLE_TRANSACTION,
} from 'constants/collectiblesConstants';
import { getActiveAccountAddress, getActiveAccountId } from 'utils/accounts';
import SDKWrapper from 'services/api';
import type { Collectible } from 'models/Collectible';
import type { GetState, Dispatch } from 'reducers/rootReducer';
import { saveDbAction } from './dbActions';
import { getExistingTxNotesAction } from './txNoteActions';
import { checkAssetTransferTransactionsAction } from './smartWalletActions';

const safeImage = (url: string): string => {
  return (/\.(jpg|png|gif)$/i).test(url) ? url : '';
};

const collectibleFromResponse = (responseItem: Object): Collectible => {
  const {
    token_id: id,
    asset_contract: assetContract,
    name,
    description,
    image_url: fullImage,
    image_preview_url: preview,
  } = responseItem;

  const { name: category, address: contractAddress } = assetContract;
  const collectibleName = name || `${category} ${id}`;

  const image = safeImage(fullImage);
  const previewImage = safeImage(preview);

  return {
    id,
    category,
    image: image || previewImage,
    name: collectibleName,
    description,
    icon: previewImage || image,
    contractAddress,
    assetContract: category,
    tokenType: COLLECTIBLES,
  };
};

export const fetchCollectiblesAction = () => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const {
      accounts: { data: accounts },
      collectibles: { data: collectibles },
    } = getState();
    const walletAddress = getActiveAccountAddress(accounts);
    const accountId = getActiveAccountId(accounts);
    const response = await api.fetchCollectibles(walletAddress);

    if (response.error || !response.assets) return;

    const accountCollectibles = response.assets.map(collectibleFromResponse);

    const updatedCollectibles = {
      ...collectibles,
      [accountId]: accountCollectibles,
    };

    dispatch(saveDbAction('collectibles', { collectibles: updatedCollectibles }, true));
    dispatch({ type: UPDATE_COLLECTIBLES, payload: updatedCollectibles });
  };
};

const collectibleTransaction = (event) => {
  const {
    asset,
    transaction,
    to_account: toAcc,
    from_account: fromAcc,
  } = event;

  const {
    asset_contract: assetContract,
    name,
    token_id: id,
    description,
    image_preview_url: imagePreviewUrl,
    image_url: imageUrl,
  } = asset;
  const { name: category, address: contractAddress } = assetContract;
  const { transaction_hash: trxHash, block_number: blockNumber, timestamp } = transaction;

  const collectibleName = name || `${category} ${id}`;

  const previewIcon = safeImage(imagePreviewUrl);
  const image = safeImage(imageUrl) || previewIcon;

  const assetData = {
    id,
    category,
    name: collectibleName,
    description,
    icon: previewIcon,
    image,
    contractAddress,
    assetContract: category,
    tokenType: COLLECTIBLES,
  };

  return {
    to: toAcc.address,
    from: fromAcc.address,
    hash: trxHash,
    createdAt: (new Date(timestamp).getTime()) / 1000,
    _id: transaction.id,
    protocol: 'Ethereum',
    asset: collectibleName,
    contractAddress,
    value: 1,
    blockNumber,
    status: 'confirmed',
    type: COLLECTIBLE_TRANSACTION,
    icon: previewIcon,
    assetData,
  };
};

export const fetchCollectiblesHistoryAction = () => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const {
      accounts: { data: accounts },
      collectibles: { transactionHistory: collectiblesHistory },
    } = getState();
    const walletAddress = getActiveAccountAddress(accounts);
    const accountId = getActiveAccountId(accounts);
    const response = await api.fetchCollectiblesTransactionHistory(walletAddress);

    if (response.error || !response.asset_events) return;

    // NOTE: for some rare transactions we don't have information about the asset sent
    const accountCollectiblesHistory = response.asset_events
      .filter(event => !!event.asset)
      .map(collectibleTransaction);

    const updatedCollectiblesHistory = {
      ...collectiblesHistory,
      [accountId]: accountCollectiblesHistory,
    };

    dispatch(getExistingTxNotesAction());
    dispatch(saveDbAction('collectiblesHistory', { collectiblesHistory: updatedCollectiblesHistory }, true));
    dispatch({ type: SET_COLLECTIBLES_TRANSACTION_HISTORY, payload: updatedCollectiblesHistory });
  };
};

export const fetchAllCollectiblesDataAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      featureFlags: { data: { SMART_WALLET_ENABLED: smartWalletFeatureEnabled } },
    } = getState();
    await dispatch(fetchCollectiblesAction());
    await dispatch(fetchCollectiblesHistoryAction());
    if (smartWalletFeatureEnabled) dispatch(checkAssetTransferTransactionsAction());
  };
};
