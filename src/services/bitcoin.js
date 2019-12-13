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
  ECPair,
  payments,
  networks,
  TransactionBuilder,
} from 'bitcoinjs-lib';

import { DEFAULT_BTC_NETWORK } from 'constants/bitcoinConstants';
import type {
  BitcoinUtxo,
  BitcoinTransactionTarget,
  BitcoinTransactionPlan,
  BTCBalance,
} from 'models/Bitcoin';
import { SPEED_TYPES } from 'constants/assetsConstants';
import {
  getAddressUtxosFromNode,
  sendRawTransactionToNode,
  getAddressBalanceFromNode,
} from 'services/insight';

const bip39 = require('bip39');
const bip32 = require('bip32');
const coinselect = require('coinselect');

const NETWORK = networks[DEFAULT_BTC_NETWORK];

const feeRateFromSpeed = (speed: string): number => {
  switch (speed) {
    // TODO: define rates
    case SPEED_TYPES.SLOW: return 50;
    case SPEED_TYPES.NORMAL: return 50;
    case SPEED_TYPES.FAST: return 50;
    default: return 50;
  }
};

const selectNetwork = (networkName: ?string) => {
  return networkName ? networks[networkName] : NETWORK;
};

export const exportKeyPair = (keyPair: ECPair): string => keyPair.toWIF();

export const collectOutputs = (
  targets: BitcoinTransactionTarget[],
  speed: string,
  unspent: BitcoinUtxo[],
  changeAddress: (value: number) => string,
): BitcoinTransactionPlan => {
  const feeRate = feeRateFromSpeed(speed);

  const utxos = unspent.map(utxo => ({ ...utxo, value: utxo.satoshis }));
  const {
    inputs,
    outputs,
    fee,
  } = coinselect(utxos, targets, feeRate);

  if (!inputs || !outputs) {
    return {
      fee,
      isValid: false,
      inputs: [],
      outputs: [],
    };
  }

  const planOutputs = outputs.map(out => {
    if (out.address) {
      return { ...out, isChange: false };
    }
    const address = changeAddress(out.value);

    return { ...out, address, isChange: true };
  });

  return {
    fee,
    isValid: true,
    inputs,
    outputs: planOutputs,
  };
};

export const sendRawTransaction = async (rawTx: string): Promise<string> => {
  return sendRawTransactionToNode(rawTx)
    .then(response => response.json())
    .then(({ txid }) => txid)
    .catch(() => null);
};

export const transactionFromPlan = (
  plan: BitcoinTransactionPlan,
  inputSigner: (address: string) => ECPair,
  networkName?: string,
): string => {
  const txb = new TransactionBuilder(selectNetwork(networkName));
  txb.setVersion(1);

  plan.inputs.forEach(utxo => {
    txb.addInput(
      utxo.txid,
      utxo.vout,
    );
  });
  plan.outputs.forEach(out => {
    txb.addOutput(out.address, out.value);
  });

  let utxoIndex = 0;
  plan.inputs.forEach(({ address }) => {
    const keyPair = inputSigner(address);

    txb.sign({
      keyPair,
      prevOutScriptType: 'p2pkh',
      vin: utxoIndex++,
    });
  });

  return txb.build().toHex();
};

export const rootFromMnemonic = async (mnemonic: string, networkName?: string): ECPair => {
  const seed = await bip39.mnemonicToSeed(mnemonic);

  return bip32.fromSeed(seed, selectNetwork(networkName));
};

export const keyPairAddress = (keyPair: ECPair): ?string => {
  try {
    const { address } = payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: keyPair.network,
    });

    return address;
  } catch (e) {
    return null;
  }
};

export const importKeyPair = (s: string, networkName?: string): ECPair => {
  return ECPair.fromWIF(s, selectNetwork(networkName));
};

export const getAddressUtxos = (address: string): Promise<BitcoinUtxo[]> => {
  return getAddressUtxosFromNode(address)
    .then(response => response.json());
};

export const getAddressBalance = (address: string): Promise<BTCBalance> => {
  return getAddressBalanceFromNode(address)
    .then(response => response.json());
};

export const getPrivateKeyForCruxPayInit = async (mnemonic: string) => {
  const node = await rootFromMnemonic(mnemonic);
  const cruxPrivateKeyDerivationPath = "m/889'/0'/0'";
  const child = node.derivePath(cruxPrivateKeyDerivationPath);
  // console.log("Derivation path", derivePath);
  // console.log("Address:", payments.p2pkh({ pubkey: child.publicKey, network: networks.mainnet }).address);
  // console.log("PublicKey", child.publicKey.toString('hex'));
  // console.log("PrivateKey", child.privateKey.toString('hex'));
  return child.privateKey.toString('hex');
};
