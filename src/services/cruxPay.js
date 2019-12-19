// @flow
import map from 'lodash.map';
import { baseColors } from 'utils/variables';

// services
import Storage from 'services/storage';
import { CruxPay } from '@cruxpay/rn-sdk';

const { CruxClientError } = CruxPay.errors;
const { PENDING, DONE, REJECT } = CruxPay.blockstackService.SubdomainRegistrationStatus;

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

const getCruxWebViewInput = async (cruxPay: string, inputExtension: Object) => {
  const { getAssetMap, getAddressMap, walletClientName } = cruxPay.cruxClient;
  const assetMap = await getAssetMap();
  const assetDetailList = map(assetMap, (value, key) => {
    return value;
  });
  const cruxPayPublicAddressCurrencies = Object.keys(await getAddressMap());
  const clientMapping = {};
  map(assetMap, (value, key) => {
    clientMapping[key] = value.assetId;
  });
  let currentInputData = {
    experience: 'react-native',
    publicAddressCurrencies: cruxPayPublicAddressCurrencies,
    assetList: assetDetailList,
    theme: '#3742fa',
    subdomainRegistrar: 'https://registrar.cruxpay.com',
    subdomainRegistrar1: cruxPay.cruxClient._nameService._subdomainRegistrar,
    walletClientName,
    clientMapping,
  };
  currentInputData = Object.assign(currentInputData, inputExtension);
  return currentInputData;
};

const getCruxPaySubdomain = (input: string) => {
  return input.split('@')[0];
};

// TODO: ask js-sdk to export this
const isValidCruxID = (input: string) => {
  return input.includes('crux') && input.includes('@') && getCruxPaySubdomain(input).length > 3;
};

const getCruxStatusIcon = (status: string) => {
  const cruxStatusIcons = {
    PENDING: { name: 'warning-circle', color: baseColors.vividOrange },
    REJECT: { name: 'info-circle', color: baseColors.fireEngineRed },
    DONE: { name: 'tick-circle', color: baseColors.limeGreen },
  };
  return cruxStatusIcons[status];
};


export {
  CruxStorageService,
  InMemStorage,
  getCruxWebViewInput,
  isValidCruxID,
  getCruxPaySubdomain,
  getCruxStatusIcon,
  CruxClientError,
};
