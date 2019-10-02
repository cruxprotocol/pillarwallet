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

export const SET_FEATURE_FLAGS = 'SET_FEATURE_FLAGS';
export const ENABLE_FEATURE_FLAG = 'ENABLE_FEATURE_FLAG';
export const DISABLE_FEATURE_FLAG = 'DISABLE_FEATURE_FLAG';
export const INITIAL_FEATURE_FLAGS = {
  SMART_WALLET_ENABLED: false,
};
export const DEVELOPMENT_FEATURE_FLAGS = {
  // SMART_WALLET_ENABLED: true,
};
