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
import AsyncStorage from '@react-native-community/async-storage';
import { NavigationActions } from 'react-navigation';
import merge from 'lodash.merge';
import get from 'lodash.get';
import {
  DECRYPT_WALLET,
  UPDATE_WALLET_STATE,
  DECRYPTING,
  INVALID_PASSWORD,
  ENCRYPTING,
  GENERATE_ENCRYPTED_WALLET,
  DECRYPTED,
  WALLET_STORAGE_BACKUP_KEY,
} from 'constants/walletConstants';
import {
  APP_FLOW,
  AUTH_FLOW,
  ONBOARDING_FLOW,
  HOME,
  CHAT,
  PIN_CODE_UNLOCK,
  PEOPLE,
  LOGOUT_PENDING,
} from 'constants/navigationConstants';
import { UPDATE_USER, PENDING, REGISTERED } from 'constants/userConstants';
import { LOG_OUT } from 'constants/authConstants';
import { RESET_APP_SETTINGS } from 'constants/appSettingsConstants';
import { UPDATE_SESSION } from 'constants/sessionConstants';
import { BLOCKCHAIN_NETWORK_TYPES } from 'constants/blockchainNetworkConstants';
import { PRE_KEY_THRESHOLD } from 'configs/connectionKeysConfig';
import { delay } from 'utils/common';
import { getSaltedPin, decryptWallet, normalizeWalletAddress } from 'utils/wallet';
import Storage from 'services/storage';
import { navigate, getNavigationState, getNavigationPathAndParamsState } from 'services/navigation';
import ChatService from 'services/chat';
import smartWalletService from 'services/smartWallet';
import firebase from 'react-native-firebase';
import Intercom from 'react-native-intercom';
import { findKeyBasedAccount } from 'utils/accounts';
import { toastWalletBackup } from 'utils/toasts';
import { updateOAuthTokensCB, onOAuthTokensFailedCB } from 'utils/oAuth';
import { userHasSmartWallet } from 'utils/smartWallet';
import { clearWebViewCookies } from 'utils/exchange';
import { setKeychainDataObject } from 'utils/keychain';
import { setupSentryAction } from 'actions/appActions';
import { signalInitAction } from 'actions/signalClientActions';
import { updateConnectionKeyPairs } from 'actions/connectionKeyPairActions';
import { initOnLoginSmartWalletAccountAction } from 'actions/accountsActions';
import { updatePinAttemptsAction } from 'actions/walletActions';
import { fetchTransactionsHistoryAction } from 'actions/historyActions';
import { setAppThemeAction, setFirebaseAnalyticsCollectionEnabled } from 'actions/appSettingsActions';
import { setActiveBlockchainNetworkAction } from 'actions/blockchainNetworkActions';
import { fetchFeatureFlagsAction } from 'actions/featureFlagsActions';
import { getExchangeSupportedAssetsAction } from 'actions/exchangeActions';
import { labelUserAsLegacyAction } from 'actions/userActions';
import SDKWrapper from 'services/api';

import type { Dispatch, GetState } from 'reducers/rootReducer';

import { saveDbAction } from './dbActions';
import { getWalletsCreationEventsAction } from './userEventsActions';


const Crashlytics = firebase.crashlytics();

const storage = Storage.getInstance('db');
const chat = new ChatService();

export const updateFcmTokenAction = (walletId: string) => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    const { session: { data: { isOnline } } } = getState();
    if (!isOnline) return;
    const fcmToken = await firebase.messaging().getToken().catch(() => null);
    dispatch({ type: UPDATE_SESSION, payload: { fcmToken } });
    Intercom.sendTokenToIntercom(fcmToken).catch(() => null);
    await api.updateFCMToken(walletId, fcmToken);
  };
};

/**
 * ### IMPORTANT ###
 * If you plan to use any method within loginAction that calls
 * Pillar Wallet SDK API please make sure you wait until it completes
 * as first method might also perform tokens refresh during the request
 */
export const loginAction = (
  pin: ?string,
  privateKey: ?string,
  onLoginSuccess: ?Function,
  updateKeychain?: boolean = false,
) => {
  return async (dispatch: Dispatch, getState: GetState, api: SDKWrapper) => {
    let { accounts: { data: accounts } } = getState();
    const {
      connectionKeyPairs: { data: connectionKeyPairs, lastConnectionKeyIndex },
      appSettings: {
        data: {
          userJoinedBeta = false,
          firebaseAnalyticsConnectionEnabled = true,
          blockchainNetwork = '',
        },
      },
      oAuthTokens: { data: oAuthTokens },
    } = getState();
    const { wallet: encryptedWallet } = await storage.get('wallet');

    const generateNewConnKeys = connectionKeyPairs.length <= PRE_KEY_THRESHOLD || lastConnectionKeyIndex === -1;

    dispatch({
      type: UPDATE_WALLET_STATE,
      payload: DECRYPTING,
    });
    await delay(100);

    await dispatch(fetchFeatureFlagsAction()); // wait until fetches new flags
    const smartWalletFeatureEnabled = get(getState(), 'featureFlags.data.SMART_WALLET_ENABLED');
    const bitcoinFeatureEnabled = get(getState(), 'featureFlags.data.BITCOIN_ENABLED');

    try {
      let wallet;

      /**
       * we want Firebase Analytics data collection to be off by default,
       * this check is used for existing users to turn off firebase Analytics
       * data collection after app update if the `firebaseAnalyticsConnectionEnabled`
       * was not set before (we set it during onboarding so unset value means existing user)
       */
      if (!userJoinedBeta && firebaseAnalyticsConnectionEnabled) {
        dispatch(setFirebaseAnalyticsCollectionEnabled(false));
      }
      if (pin) {
        const saltedPin = await getSaltedPin(pin, dispatch);
        const decryptionOptions = generateNewConnKeys ? { mnemonic: true } : {};
        wallet = await decryptWallet(encryptedWallet, saltedPin, decryptionOptions);
      } else if (privateKey) {
        const walletAddress = normalizeWalletAddress(encryptedWallet.address);
        wallet = { ...encryptedWallet, privateKey, address: walletAddress };
      } else {
        // nothing provided, invalid login
        throw new Error();
      }

      let { user = {} } = await storage.get('user');
      const userState = user.walletId ? REGISTERED : PENDING;
      if (userState === REGISTERED) {
        // signal credentials
        const signalCredentials = {
          userId: user.id,
          username: user.username,
          walletId: user.walletId,
          ethAddress: wallet.address,
        };

        // oauth fallback method for expired access token
        const updateOAuth = updateOAuthTokensCB(dispatch, signalCredentials);

        // oauth fallback method for all tokens expired or invalid
        const onOAuthTokensFailed = onOAuthTokensFailedCB(dispatch);

        // init API
        api.init(updateOAuth, oAuthTokens, onOAuthTokensFailed);

        // execute login success callback
        if (onLoginSuccess && wallet.privateKey) {
          let { privateKey: privateKeyParam } = wallet;
          privateKeyParam = privateKeyParam.indexOf('0x') === 0 ? privateKeyParam.slice(2) : privateKeyParam;
          await onLoginSuccess(privateKeyParam);
        }

        // set API username (local method)
        api.setUsername(user.username);

        // make first api call which can also trigger OAuth fallback methods
        const userInfo = await api.userInfo(user.walletId);

        // update FCM
        dispatch(updateFcmTokenAction(user.walletId));

        // perform signal init
        dispatch(signalInitAction({ ...signalCredentials, ...oAuthTokens }));

        // save updated user
        user = merge({}, user, userInfo);
        dispatch(saveDbAction('user', { user }, true));

        // update connections
        dispatch(updateConnectionKeyPairs(
          wallet.mnemonic,
          wallet.privateKey,
          user.walletId,
          generateNewConnKeys,
        ));

        // init smart wallet
        if (smartWalletFeatureEnabled && wallet.privateKey && userHasSmartWallet(accounts)) {
          await dispatch(initOnLoginSmartWalletAccountAction(wallet.privateKey));
        }

        // set ETHEREUM network as active
        // if we disable feature flag or end beta testing program
        // while user has set PPN or BTC as active network
        const revertToDefaultNetwork =
          (!smartWalletFeatureEnabled && blockchainNetwork === BLOCKCHAIN_NETWORK_TYPES.PILLAR_NETWORK) ||
          (!bitcoinFeatureEnabled && blockchainNetwork === BLOCKCHAIN_NETWORK_TYPES.BITCOIN);

        let newBlockchainNetwork = blockchainNetwork;

        if (!newBlockchainNetwork || revertToDefaultNetwork) {
          newBlockchainNetwork = BLOCKCHAIN_NETWORK_TYPES.ETHEREUM;
        }

        dispatch(setActiveBlockchainNetworkAction(newBlockchainNetwork));

        // to get exchange supported assets in order to show only supported assets on exchange selectors
        // and show exchange button on supported asset screen only
        dispatch(getExchangeSupportedAssetsAction());
      } else {
        api.init();
      }

      // re-fetch accounts as they might change at this point
      accounts = getState().accounts.data;

      Crashlytics.setUserIdentifier(user.username);
      dispatch({
        type: UPDATE_USER,
        payload: { user, state: userState },
      });

      if (userState === REGISTERED) {
        dispatch(labelUserAsLegacyAction());
      }

      const { address } = wallet;
      dispatch({
        type: DECRYPT_WALLET,
        payload: {
          address,
          privateKey: (userState === PENDING) ? wallet.privateKey : undefined,
        },
      });
      dispatch(updatePinAttemptsAction(false));

      // migrate older users for keychain access with biometrics
      if (wallet.privateKey && updateKeychain) {
        await setKeychainDataObject({ privateKey: wallet.privateKey });
      }

      if (!__DEV__) {
        dispatch(setupSentryAction(user, wallet));
      }

      dispatch(fetchTransactionsHistoryAction());

      const pathAndParams = getNavigationPathAndParamsState();
      if (!pathAndParams) return;
      const currentFlow = pathAndParams.path.split('/')[0];

      const { lastActiveScreen, lastActiveScreenParams } = getNavigationState();
      const navigateToLastActiveScreen = NavigationActions.navigate({
        // current active screen will be always AUTH_FLOW due to login/logout
        routeName: lastActiveScreen || HOME,
        params: lastActiveScreenParams,
      });

      const isOpeningAChatNotification = lastActiveScreen === CHAT && currentFlow === AUTH_FLOW;
      const navigateToRoute = isOpeningAChatNotification ?
        NavigationActions.navigate({
          routeName: PEOPLE,
          params: {},
          action: navigateToLastActiveScreen,
        }) : navigateToLastActiveScreen;
      const navigateToAppAction = NavigationActions.navigate({
        routeName: APP_FLOW,
        params: {},
        action: navigateToRoute,
      });

      // show toast if the wallet wasn't backed up
      const {
        isImported,
        isBackedUp,
      } = getState().wallet.backupStatus;

      const isWalletBackedUp = isImported || isBackedUp;
      const keyBasedAccount = findKeyBasedAccount(accounts);
      if (keyBasedAccount) {
        toastWalletBackup(isWalletBackedUp);
      }

      dispatch(getWalletsCreationEventsAction());
      navigate(navigateToAppAction);
    } catch (e) {
      dispatch(updatePinAttemptsAction(true));
      dispatch({
        type: UPDATE_WALLET_STATE,
        payload: INVALID_PASSWORD,
      });
    }
  };
};

type DecryptionSettings = {
  mnemonic: boolean,
};

const defaultDecryptionSettings = {
  mnemonic: false,
};

export const checkAuthAction = (
  pin: ?string,
  privateKey: ?string,
  onValidPin?: Function,
  options?: DecryptionSettings = defaultDecryptionSettings,
) => {
  return async (dispatch: Dispatch) => {
    const { wallet: encryptedWallet } = await storage.get('wallet');
    dispatch({
      type: UPDATE_WALLET_STATE,
      payload: DECRYPTING,
    });
    await delay(100);
    try {
      let wallet;
      if (pin) {
        const saltedPin = await getSaltedPin(pin, dispatch);
        wallet = await decryptWallet(encryptedWallet, saltedPin, options);
      } else if (privateKey) {
        const walletAddress = normalizeWalletAddress(encryptedWallet.address);
        wallet = { ...encryptedWallet, privateKey, address: walletAddress };
      }
      if (wallet) {
        dispatch({
          type: DECRYPT_WALLET,
          payload: {
            address: wallet.address,
          },
        });
        if (onValidPin) {
          onValidPin(pin, wallet);
        }
        return;
      }
    } catch (e) {
      // err
    }
    dispatch({
      type: UPDATE_WALLET_STATE,
      payload: INVALID_PASSWORD,
    });
  };
};

export const changePinAction = (newPin: string, currentPin: string) => {
  return async (dispatch: Dispatch) => {
    const { wallet: encryptedWallet } = await storage.get('wallet');

    dispatch({
      type: UPDATE_WALLET_STATE,
      payload: ENCRYPTING,
    });
    await delay(50);
    const currentSaltedPin = await getSaltedPin(currentPin, dispatch);
    const wallet = await decryptWallet(encryptedWallet, currentSaltedPin, {
      mnemonic: true,
    });

    const newSaltedPin = await getSaltedPin(newPin, dispatch);
    const newEncryptedWallet = await wallet.RNencrypt(newSaltedPin, { scrypt: { N: 16384 } })
      .then(JSON.parse)
      .catch(() => ({}));

    dispatch(saveDbAction('wallet', { wallet: newEncryptedWallet }));

    dispatch({
      type: GENERATE_ENCRYPTED_WALLET,
      payload: {
        address: wallet.address,
      },
    });
  };
};

export const resetIncorrectPasswordAction = () => {
  return async (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_WALLET_STATE,
      payload: DECRYPTED,
    });
  };
};

export const lockScreenAction = (onLoginSuccess?: Function, errorMessage?: string) => {
  return async () => {
    navigate(NavigationActions.navigate({
      routeName: AUTH_FLOW,
      params: {},
      action: NavigationActions.navigate({
        routeName: PIN_CODE_UNLOCK,
        params: {
          onLoginSuccess,
          errorMessage,
        },
      }),
    }));
  };
};

export const logoutAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    navigate(NavigationActions.navigate({ routeName: LOGOUT_PENDING }));
    Intercom.logout();
    await firebase.iid().delete().catch(() => {});
    await chat.client.resetAccount().catch(() => null);
    await AsyncStorage.removeItem(WALLET_STORAGE_BACKUP_KEY);
    await storage.removeAll();
    const smartWalletFeatureEnabled = get(getState(), 'featureFlags.data.SMART_WALLET_ENABLED');
    if (smartWalletFeatureEnabled) await smartWalletService.reset();
    clearWebViewCookies();
    dispatch({ type: LOG_OUT });
    dispatch({ type: RESET_APP_SETTINGS, payload: {} });
    dispatch(setAppThemeAction());
    navigate(NavigationActions.navigate({ routeName: ONBOARDING_FLOW }));
  };
};
