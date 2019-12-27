// @flow
import { baseColors } from 'utils/variables';

// services
import Storage from 'services/storage';
import { CruxPay } from '@cruxpay/rn-sdk';
import { CruxUIUtil } from '@cruxpay/rn-crux-ui';
import { Alert } from 'react-native';

// constants
import { HOME } from 'constants/navigationConstants';

// components
import Toast from 'components/Toast';

const { CruxClientError } = CruxPay.errors;
const { isValidCruxID, getCruxPaySubdomain } = CruxUIUtil;
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

const processRegisterSuccess = async (loadCruxIDState: Function, cruxID: string, navigation, map: Object) => {
  // TODO: discuss what to do if a few failed?
  await loadCruxIDState();
  Toast.show({
    title: 'Registration Success',
    message: `Your CRUX ID: ${cruxID} is being updated. It takes about few hours to complete registration.`,
    type: 'success',
    autoClose: true,
  });
  navigation.navigate(HOME);
};

const processPutAddressSuccess = async (loadCruxIDState: Function, cruxID: string, navigation, map: Object) => {
  await loadCruxIDState();
  Toast.show({
    title: 'Update CruxPay Addresses',
    message: `Your CRUX ID: ${cruxID} is has been updated!`,
    type: 'success',
    autoClose: true,
  });
  navigation.navigate(HOME);
};

const getExtendedInputs = (assets: Object, suggestedCruxIDSubdomain: string) => {
  const availableCurrencies = {};
  const theme = '#3742fa';
  Object.keys(assets)
    .forEach((key) => {
      // eslint-disable-next-line max-len
      availableCurrencies[key.toLowerCase()] = assets[key].address ? { addressHash: assets[key].address } : { addressHash: assets[key].address };
    });
  return {
    theme,
    availableCurrencies,
    suggestedCruxIDSubdomain,
  };
};

const handleCruxError = (error: CruxClientError) => {
  console.error('CruxPay handleError: ', error);
};

export {
  CruxStorageService,
  InMemStorage,
  isValidCruxID,
  getCruxPaySubdomain,
  getCruxStatusIcon,
  CruxClientError,
  confirmCloseCruxUI,
  processRegisterSuccess,
  processPutAddressSuccess,
  getExtendedInputs,
  handleCruxError,
};
