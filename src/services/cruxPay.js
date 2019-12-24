// @flow
import map from 'lodash.map';
import { baseColors } from 'utils/variables';

// services
import Storage from 'services/storage';
import { CruxPay } from '@cruxpay/rn-sdk';
import { Alert } from 'react-native';

// constants
import { CRUXPAY_REGISTRATION, CRUXPAY_INJECTED_SCREEN, HOME } from 'constants/navigationConstants';

// components
import Toast from 'components/Toast';

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

const getCruxWebViewInput = async (cruxClient: Object, inputExtension: Object) => {
  const { getAssetMap, getAddressMap, walletClientName } = cruxClient;
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
    subdomainRegistrar: cruxClient._nameService._subdomainRegistrar,
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

const confirmCloseCruxUI = (navigation) => {
  Alert.alert(
    'Cancel CruxPay Setup',
    'outside Are you sure you want to cancel the setup?',
    [
      {
        text: 'Yes',
        onPress: () => navigation.goBack(),
      },
      {
        text: 'No',
        style: 'cancel',
      },
    ],
    { cancelable: true },
  );
};

const processRegisterSuccess = async (loadCruxIDState, cruxPay, navigation, map) => {
  // TODO: discuss what to do if a few failed?
  await loadCruxIDState();
  Toast.show({
    title: 'Registration Success',
    message: `Your CRUX ID: ${cruxPay.cruxID} is being updated. It takes about few hours to complete registration.`,
    type: 'success',
    autoClose: true,
  });
  navigation.navigate(HOME);
};


const processPutAddressSuccess = async (loadCruxIDState, cruxPay, navigation, map) => {
  await loadCruxIDState();
  Toast.show({
    title: 'Update CruxPay Addresses',
    message: `Your CRUX ID: ${cruxPay.cruxID} is has been updated!`,
    type: 'success',
    autoClose: true,
  });
  navigation.navigate(HOME);
};


const getExtendedInputs = (assets, cruxID, suggestedCruxIDSubdomain) => {
  const availableCurrencies = {};
  Object.keys(assets)
    .forEach((key) => {
      // eslint-disable-next-line max-len
      availableCurrencies[key.toLowerCase()] = assets[key].address ? { addressHash: assets[key].address } : { addressHash: assets[key].address };
    });
  const inputExtension = {
    availableCurrencies,
    theme: '#3742fa',
    cruxIDSubdomain: cruxID ? getCruxPaySubdomain(cruxID) : '',
    suggestedCruxIDSubdomain,
  };
  return inputExtension;
};

export {
  CruxStorageService,
  InMemStorage,
  getCruxWebViewInput,
  isValidCruxID,
  getCruxPaySubdomain,
  getCruxStatusIcon,
  CruxClientError,
  confirmCloseCruxUI,
  processRegisterSuccess,
  processPutAddressSuccess,
  getExtendedInputs,
};
