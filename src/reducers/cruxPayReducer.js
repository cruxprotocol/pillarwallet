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
  SET_CRUXPAY_CLIENT_INIT,
  SET_CRUXID_STATE,
} from 'constants/cruxPayConstants';

export type CruxPayReducerState = {
  walletClientName: string,
  clientInitialized: boolean,
  cruxClient: Object,
  cruxID: string | null,
  status: {
    status: string,
    statusDetail: string,
  }
};

export type CruxPayReducerAction = {
  type: string,
  payload?: any,
};

export const initialState = {
  walletClientName: 'testwallet3',
  clientInitialized: false,
  cruxClient: {},
  cruxID: null,
  status: {
    status: 'NONE',
    statusDetail: '',
  },
};

export default function cruxPayReducer(
  state: CruxPayReducerState = initialState,
  action: CruxPayReducerAction,
): CruxPayReducerState {
  switch (action.type) {
    case SET_CRUXPAY_CLIENT_INIT:
      return {
        ...state,
        clientInitialized: action.payload.clientInitialized,
        cruxClient: action.payload.cruxClient,
      };
    case SET_CRUXID_STATE:
      return {
        ...state,
        cruxID: action.payload.cruxID,
        status: action.payload.status,
      };
    default:
      return state;
  }
}
