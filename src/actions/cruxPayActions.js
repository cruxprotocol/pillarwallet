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
import { CruxPay } from '@cruxpay/rn-sdk';

// types
import type { Dispatch, GetState } from 'reducers/rootReducer';

// constants
import {
  SET_CRUXPAY_CLIENT_INIT,
  SET_CRUXID_STATE,
} from 'constants/cruxPayConstants';

// services
import { InMemStorage } from 'services/cruxPay';

export const initCruxPayClientAction = (walletPrivateKey: string) => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      cruxPay,
    } = getState();
    const s = new InMemStorage();
    const cruxClientOptions = {
      getEncryptionKey: () => 'fookey',
      walletClientName: cruxPay.walletClientName,
      storage: s,
      privateKey: walletPrivateKey,
    };
    const cruxClient = new CruxPay.CruxClient(cruxClientOptions);
    dispatch({
      type: SET_CRUXPAY_CLIENT_INIT,
      payload: {
        clientInitialized: true,
        cruxClient,
      },
    });
  };
};

export const loadCruxIDStateAction = () => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const {
      cruxPay: {
        cruxClient,
      },
    } = getState();
    const cruxIDState: CruxPay.ICruxIDState = await cruxClient.getCruxIDState();
    dispatch({
      type: SET_CRUXID_STATE,
      payload: cruxIDState,
    });
  };
};
