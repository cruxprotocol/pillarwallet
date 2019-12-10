// @flow

// services
import Storage from 'services/storage';
import { CruxPay } from '@cruxpay/rn-sdk';

const storage = Storage.getInstance('db');

class CruxStorageService extends CruxPay.storage.StorageService {
  setJSON = async (key: string, jsonObj: Object): Promise<void> => {
    return storage.save(key, jsonObj);
  };

  getJSON = async (key: string): Promise<Object | null> => {
    return storage.get(key);
  }
}

class InMemStorage extends CruxPay.storage.StorageService {
  constructor() {
    super();
    this.dataMemory = {};
  }

  setItem = async (key: string, value: string): Promise<void> => {
    this.dataMemory[key] = value;
  };

  getItem = async (key: string): Promise<string | null> => {
    return this.dataMemory[key];
  }
}

const getCruxWebViewInput = async () => {
  // eslint-disable-next-line max-len
  const allCurrencies = [{ assetId: '4e4d9982-3469-421b-ab60-2c0c2f05386a', symbol: 'ETH', name: 'Ethereum', assetType: null, decimals: 8, assetIdentifierName: null, assetIdentifierValue: null, parentAssetId: null }, { assetId: 'b38a1576-a704-479b-96fa-b9a83bda7ed5', symbol: 'ETC', name: 'Ethereum Classic', assetType: null, decimals: 8, assetIdentifierName: null, assetIdentifierValue: null, parentAssetId: null }, { assetId: 'abe0030a-d8e3-4518-879f-cd9939b7d8ab', symbol: 'XRP', name: 'Ripple', assetType: null, decimals: 6, assetIdentifierName: null, assetIdentifierValue: null, parentAssetId: null }, { assetId: 'a6d02462-e1b0-4135-bb64-49e567217a5f', symbol: 'CVC', name: 'Civic', assetType: 'ERC20', decimals: 8, assetIdentifierName: 'Contract Address', assetIdentifierValue: '0x41e5560054824ea6b0732e656e3ad64e20e94e45', parentAssetId: '4e4d9982-3469-421b-ab60-2c0c2f05386a' }, { assetId: '0a2f3bb6-5190-4c02-85a9-5eecea9ed912', symbol: 'DOGE', name: 'Dogecoin', assetType: null, decimals: 8, assetIdentifierName: null, assetIdentifierValue: null, parentAssetId: null }, { assetId: 'c72972bd-7e85-40b4-83e5-9634f827214e', symbol: 'ADA', name: 'Cardano', assetType: null, decimals: 5, assetIdentifierName: null, assetIdentifierValue: null, parentAssetId: null }, { assetId: 'aae85fa5-7d6a-427c-8088-37df459d55b8', symbol: 'NEO', name: 'NEO', assetType: 'NEOGoverningToken', decimals: 18, assetIdentifierName: 'Asset ID', assetIdentifierValue: 'c56f33fc6ecfcd0c225c4ab356fee59390af8560be0e930faebe74a6daff7c9b', parentAssetId: null }, { assetId: 'af9c0656-580e-4700-bec8-13d24d2ead87', symbol: 'ONT', name: 'Ontology', assetType: null, decimals: 1, assetIdentifierName: null, assetIdentifierValue: null, parentAssetId: null }];
  const currentInputData = {
    cruxIDSubdomain: '',
    suggestedCruxIDSubdomain: 'amitasaurus',
    walletClientName: 'zel',
    availableCurrencies: { btc: '3LoJFcGiBgCzy235poxmq8uZGFGSK3ZbJN', eth: '0x501906Ce564be7bA80Eb55A29EE31ECfaE41b6f2', xrp: 'rhVWrjB9EGDeK4zuJ1x2KXSjjSpsDQSaU6', neo: 'AdpCh7w8cLdWWztRmqj1MbUtGgBfkn3Tx9', ada: 'DdzFFzCqrhsjouCxmJaUN2Y5GoHuei5cA41jCHmxyKUfWD2jKmjujKnNKJb5pUkjHCiujxZPcgyMK1Mhrq2GBy1RGnBA91Cu5VdnFL9M' },
    publicAddressCurrencies: ['btc', 'eth', 'neo'],
    assetList: allCurrencies,
    theme: '#3742fa',
    experience: 'react-native',
    subdomainRegistrar: 'https://registrar.cruxpay.com',
    clientMapping: { eth: '4e4d9982-3469-421b-ab60-2c0c2f05386a', etc: 'b38a1576-a704-479b-96fa-b9a83bda7ed5', xrp: 'abe0030a-d8e3-4518-879f-cd9939b7d8ab', cvc: 'a6d02462-e1b0-4135-bb64-49e567217a5f', doge: '0a2f3bb6-5190-4c02-85a9-5eecea9ed912', ada: 'c72972bd-7e85-40b4-83e5-9634f827214e', neo: 'aae85fa5-7d6a-427c-8088-37df459d55b8', ont: 'af9c0656-580e-4700-bec8-13d24d2ead87' }
  };
  return currentInputData;
};

export {
  CruxStorageService,
  InMemStorage,
  getCruxWebViewInput,
};
