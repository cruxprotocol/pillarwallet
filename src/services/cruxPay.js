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
export { CruxStorageService };
