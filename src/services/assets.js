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
import { Contract, utils } from 'ethers';
import { NETWORK_PROVIDER, COLLECTIBLES_NETWORK } from 'react-native-dotenv';
import cryptocompare from 'cryptocompare';
import { Sentry } from 'react-native-sentry';

import { BTC, ETH, HOT, HOLO, supportedFiatCurrencies } from 'constants/assetsConstants';
import { getEthereumProvider, parseTokenBigNumberAmount } from 'utils/common';

import ERC20_CONTRACT_ABI from 'abi/erc20.json';
import ERC721_CONTRACT_ABI from 'abi/erc721.json';
import ERC721_CONTRACT_ABI_SAFE_TRANSFER_FROM from 'abi/erc721_safeTransferFrom.json';
import ERC721_CONTRACT_ABI_TRANSFER_FROM from 'abi/erc721_transferFrom.json';

import type { Asset } from 'models/Asset';

type Address = string;

type ERC20TransferOptions = {
  contractAddress: ?string,
  to: Address,
  amount: number | string,
  wallet: Object,
  decimals: number,
  nonce?: number,
  signOnly?: ?boolean,
  gasLimit: number,
  gasPrice: number,
  data?: string,
};

type ERC721TransferOptions = {
  contractAddress: ?string,
  from: Address,
  to: Address,
  tokenId: string,
  wallet: Object,
  nonce?: number,
  signOnly?: ?boolean,
  gasLimit?: ?number,
  gasPrice?: ?number,
};

type ETHTransferOptions = {
  gasLimit: number,
  gasPrice: number,
  amount: number | string,
  to: Address,
  wallet: Object,
  nonce?: number,
  signOnly?: ?boolean,
  data?: string,
};

function contractHasMethod(contractCode, encodedMethodName) {
  return contractCode.includes(encodedMethodName);
}

export async function transferERC20(options: ERC20TransferOptions) {
  const {
    contractAddress,
    amount,
    wallet,
    decimals: defaultDecimals = 18,
    nonce,
    gasLimit,
    gasPrice,
    signOnly = false,
  } = options;
  let { data, to } = options;

  wallet.connect(getEthereumProvider(NETWORK_PROVIDER));

  const contract = new Contract(contractAddress, ERC20_CONTRACT_ABI, wallet);
  const contractAmount = parseTokenBigNumberAmount(amount, defaultDecimals);

  if (!data) {
    try {
      data = await contract.interface.functions.transfer.encode([to, contractAmount]);
    } catch (e) {
      //
    }
    to = contractAddress;
  }

  const transaction = {
    gasLimit,
    gasPrice: utils.bigNumberify(gasPrice),
    to,
    nonce,
    data,
  };
  if (!signOnly) return wallet.sendTransaction(transaction);

  const signedHash = await wallet.sign(transaction);
  return { signedHash, value: contractAmount };
}

export function getERC721ContractTransferMethod(code: any): string {
  // first 4 bytes of the encoded signature for a lookup in the contract code
  // encoding: utils.keccak256(utils.toUtf8Bytes(signature)
  const transferHash = 'a9059cbb'; // transfer(address,uint256)
  const transferFromHash = '23b872dd'; // transferFrom(address,address,uint256)
  const safeTransferFromHash = '42842e0e'; // safeTransferFrom(address,address,uint256)

  if (contractHasMethod(code, safeTransferFromHash)) {
    return 'safeTransferFrom';
  } else if (contractHasMethod(code, transferHash)) {
    return 'transfer';
  } else if (contractHasMethod(code, transferFromHash)) {
    return 'transferFrom';
  }
  return '';
}

export async function transferERC721(options: ERC721TransferOptions) {
  const {
    contractAddress,
    from,
    to,
    tokenId,
    wallet: walletInstance,
    nonce,
    gasLimit,
    gasPrice,
    signOnly = false,
  } = options;
  const wallet = walletInstance.connect(getEthereumProvider(COLLECTIBLES_NETWORK));
  let contract;
  const code = await wallet.provider.getCode(contractAddress);
  const contractTransferMethod = getERC721ContractTransferMethod(code);

  // used if signOnly
  let contractSignedTransaction;
  let data;
  if (signOnly) {
    contractSignedTransaction = {
      gasLimit,
      gasPrice: utils.bigNumberify(gasPrice),
      to: contractAddress,
      nonce,
    };
  }

  try {
    switch (contractTransferMethod) {
      case 'safeTransferFrom':
        contract = new Contract(contractAddress, ERC721_CONTRACT_ABI_SAFE_TRANSFER_FROM, wallet);
        if (!signOnly) return contract.safeTransferFrom(from, to, tokenId, { nonce });
        data = await contract.interface.functions.safeTransferFrom.encode([from, to, tokenId]);
        return wallet.sign({ ...contractSignedTransaction, data });
      case 'transfer':
        contract = new Contract(contractAddress, ERC721_CONTRACT_ABI, wallet);
        if (!signOnly) return contract.transfer(to, tokenId, { nonce });
        data = await contract.interface.functions.transfer.encode([to, tokenId]);
        return wallet.sign({ ...contractSignedTransaction, data });
      case 'transferFrom':
        contract = new Contract(contractAddress, ERC721_CONTRACT_ABI_TRANSFER_FROM, wallet);
        if (!signOnly) return contract.transferFrom(from, to, tokenId, { nonce });
        data = await contract.interface.functions.transferFrom.encode([from, to, tokenId]);
        return wallet.sign({ ...contractSignedTransaction, data });
      default:
    }
  } catch (e) {
    // unable to transfer
  }

  Sentry.captureMessage('Could not transfer collectible',
    {
      level: 'info',
      extra: {
        networkProvider: COLLECTIBLES_NETWORK,
        contractAddress,
        tokenId,
      },
    });
  return { error: 'can not be transferred', noRetry: true };
}

export async function transferETH(options: ETHTransferOptions) {
  const {
    to,
    wallet,
    gasPrice,
    gasLimit,
    amount,
    nonce,
    signOnly = false,
    data,
  } = options;
  const value = utils.parseEther(amount.toString());
  const trx = {
    gasLimit,
    gasPrice: utils.bigNumberify(gasPrice),
    value,
    to,
    nonce,
    data,
  };
  wallet.connect(getEthereumProvider(NETWORK_PROVIDER));
  if (!signOnly) return wallet.sendTransaction(trx);
  const signedHash = await wallet.sign(trx);
  return { signedHash, value };
}

// Fetch methods are temporary until the BCX API provided

export function fetchETHBalance(walletAddress: Address) {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  return provider.getBalance(walletAddress).then(utils.formatEther);
}

export function fetchRinkebyETHBalance(walletAddress: Address) {
  const provider = getEthereumProvider('rinkeby');
  return provider.getBalance(walletAddress).then(utils.formatEther);
}

export function fetchERC20Balance(walletAddress: Address, contractAddress: Address, decimals: number = 18) {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  const contract = new Contract(contractAddress, ERC20_CONTRACT_ABI, provider);
  return contract.balanceOf(walletAddress).then((wei) => utils.formatUnits(wei, decimals));
}

export function fetchAssetBalances(assets: Asset[], walletAddress: string): Promise<Object[]> {
  const promises = assets
    .map(async (asset: Asset) => {
      const balance = asset.symbol === ETH
        ? await fetchETHBalance(walletAddress)
        : await fetchERC20Balance(walletAddress, asset.address, asset.decimals).catch(() => 0);
      return {
        balance,
        symbol: asset.symbol,
      };
    });
  return Promise.all(promises).catch(() => ([]));
}

export function getExchangeRates(assets: string[]): Promise<?Object> {
  if (!assets.length) return Promise.resolve({});
  const targetCurrencies = supportedFiatCurrencies.concat(ETH);

  assets = assets.map(token => {
    // rename HOT to HOLO
    if (token.toUpperCase() !== HOT) {
      return HOLO;
    }
    return token;
  });
  assets = assets.concat(BTC);

  return cryptocompare.priceMulti(assets, targetCurrencies)
    .then(data => {
      // rename HOLO to HOT
      if (data[HOLO]) {
        data[HOT] = { ...data[HOLO] };
        delete data[HOLO];
      }
      return data;
    }).catch(() => ({}));
}

// from the getTransaction() method you'll get the the basic tx info without the status
export function fetchTransactionInfo(hash: string): Promise<?Object> {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  return provider.getTransaction(hash).catch(() => null);
}

// receipt available for mined transactions only, here you can get the status of the tx
export function fetchTransactionReceipt(hash: string): Promise<?Object> {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  return provider.getTransactionReceipt(hash).catch(() => null);
}

export function fetchLastBlockNumber(): Promise<number> {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  return provider.getBlockNumber().then(parseInt).catch(() => 0);
}

export function transferSigned(signed: string) {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  return provider.sendTransaction(signed);
}

export function waitForTransaction(hash: string) {
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  return provider.waitForTransaction(hash);
}

export const DEFAULT_GAS_LIMIT = 500000;

export async function calculateGasEstimate(transaction: Object) {
  const {
    from,
    amount,
    symbol,
    contractAddress,
    decimals: defaultDecimals = 18,
    tokenId,
  } = transaction;
  let { to, data } = transaction;
  const provider = getEthereumProvider(NETWORK_PROVIDER);
  const value = symbol === ETH
    ? utils.parseEther(amount.toString())
    : '0x';
  try {
    if (tokenId) {
      let contract;
      const code = await provider.getCode(contractAddress);
      const contractTransferMethod = getERC721ContractTransferMethod(code);
      switch (contractTransferMethod) {
        case 'safeTransferFrom':
          contract = new Contract(contractAddress, ERC721_CONTRACT_ABI_SAFE_TRANSFER_FROM, provider);
          data = await contract.interface.functions.safeTransferFrom.encode([from, to, tokenId]);
          break;
        case 'transfer':
          contract = new Contract(contractAddress, ERC721_CONTRACT_ABI, provider);
          data = await contract.interface.functions.transfer.encode([to, tokenId]);
          break;
        case 'transferFrom':
          contract = new Contract(contractAddress, ERC721_CONTRACT_ABI_TRANSFER_FROM, provider);
          data = await contract.interface.functions.transferFrom.encode([from, to, tokenId]);
          break;
        default:
          return DEFAULT_GAS_LIMIT;
      }
    } else if (!data && contractAddress && symbol !== ETH) {
      /**
       * we check `symbol !== ETH` because our assets list also includes ETH contract address
       * so want to check if it's also not ETH send flow
       */
      const contract = new Contract(contractAddress, ERC20_CONTRACT_ABI, provider);
      const contractAmount = parseTokenBigNumberAmount(amount, defaultDecimals);
      data = await contract.interface.functions.transfer.encode([to, contractAmount]);
      to = contractAddress;
    }
  } catch (e) {
    return DEFAULT_GAS_LIMIT;
  }
  // all parameters are required in order to estimate gas limit precisely
  return provider.estimateGas({
    from,
    to,
    data,
    value,
  })
    .then(calculatedGasLimit =>
      Math.round(utils.bigNumberify(calculatedGasLimit).toNumber() * 1.5), // safe buffer multiplier
    )
    .catch(() => DEFAULT_GAS_LIMIT);
}
