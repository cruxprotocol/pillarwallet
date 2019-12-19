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
import * as React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components/native';
import { Keyboard, Alert } from 'react-native';
import isEmpty from 'lodash.isempty';
import t from 'tcomb-form-native';
import { createStructuredSelector } from 'reselect';
import Separator from 'components/Separator';
import { ACCOUNTS, SEND_COLLECTIBLE_CONFIRM } from 'constants/navigationConstants';
import { COLLECTIBLES } from 'constants/assetsConstants';
import { CHAT } from 'constants/chatConstants';
import { ACCOUNT_TYPES } from 'constants/accountsConstants';
import { baseColors, fontSizes, spacing, UIColors } from 'utils/variables';
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { Container, Footer } from 'components/Layout';
import Button from 'components/Button';
import SingleInput from 'components/TextInput/SingleInput';
import ListItemWithImage from 'components/ListItem/ListItemWithImage';
import type { NavigationScreenProp } from 'react-navigation';
import QRCodeScanner from 'components/QRCodeScanner';
import Spinner from 'components/Spinner';
import { navigateToSendTokenAmountAction } from 'actions/smartWalletActions';
import { syncContactsSmartAddressesAction } from 'actions/contactsActions';
import { isValidETHAddress } from 'utils/validators';
import { pipe, decodeETHAddress, isCaseInsensitiveMatch } from 'utils/common';
import { getAccountAddress, getAccountName, getInactiveUserAccounts } from 'utils/accounts';
import { isPillarPaymentNetworkActive } from 'utils/blockchainNetworks';
import type { Account, Accounts } from 'models/Account';
import type { ContactSmartAddressData } from 'models/Contacts';
import type { BlockchainNetwork } from 'models/BlockchainNetwork';
import { activeAccountSelector } from 'selectors';
import { isValidCruxID, CruxClientError } from 'services/cruxPay';
import { HelpText } from 'components/Typography';

type Props = {
  navigation: NavigationScreenProp<*>,
  accounts: Accounts,
  localContacts: Object[],
  wallet: Object,
  cruxPay: Object,
  navigateToSendTokenAmount: Function,
  contactsSmartAddressesSynced: boolean,
  syncContactsSmartAddresses: Function,
  contactsSmartAddresses: ContactSmartAddressData[],
  isOnline: boolean,
  blockchainNetworks: BlockchainNetwork[],
  activeAccount: ?Account,
};

type State = {
  isScanning: boolean,
  isResolvingCruxId: boolean,
  value: {
    address: string,
  },
  formStructure: t.struct,
  cruxAccount: Object,
};

const qrCode = require('assets/images/qr.png');
const keyWalletIcon = require('assets/icons/icon_ethereum_network.png');
const smartWalletIcon = require('assets/icons/icon_smart_wallet.png');
const cruxPayIcon = require('assets/icons/icon_cruxpay.png');

const FormWrapper = styled.View`
  padding: ${spacing.mediumLarge}px ${spacing.large}px 6px;
  background-color: ${baseColors.white};
  border-bottom-color: ${baseColors.mediumLightGray};
  border-bottom-width: 1px;
`;

const ContactCardList = styled.FlatList`
  background-color: ${UIColors.defaultBackgroundColor};
`;

// make Dynamic once more tokens supported
const ETHValidator = (address: string): boolean => pipe(decodeETHAddress, isValidETHAddress)(address);
const { Form } = t.form;

function AddressInputTemplate(locals) {
  const { config: { onIconPress } } = locals;
  const errorMessage = locals.error;
  const inputProps = {
    onChange: locals.onChange,
    onBlur: locals.onBlur,
    placeholder: 'Username, CRUX ID or wallet address',
    value: locals.value,
    keyboardType: locals.keyboardType,
    textAlign: 'left',
    maxLength: 42,
    letterSpacing: 0.1,
    fontSize: fontSizes.small,
  };
  return (
    <SingleInput
      errorMessage={errorMessage}
      outterIconText="SCAN"
      outterIcon={qrCode}
      id="address"
      onPress={onIconPress}
      inputProps={inputProps}
      fontSize={fontSizes.medium}
    />
  );
}

const getFormStructure = (ownAddress: string) => {
  const Address = t.refinement(t.String, (address): boolean => {
    return address.length && isValidETHAddress(address) && ownAddress !== address;
  });

  Address.getValidationErrorMessage = (address): string => {
    if (ownAddress === address) {
      return 'You are not allowed to make transaction to yourself';
    }
    if (!isValidETHAddress(address)) {
      return 'Invalid Ethereum Address.';
    }
    return 'Address must be provided.';
  };

  return t.struct({
    address: Address,
  });
};

const generateFormOptions = (config: Object): Object => ({
  fields: {
    address: { template: AddressInputTemplate, config, label: 'To' },
  },
});

class SendTokenContacts extends React.Component<Props, State> {
  _form: t.form;
  assetData: Object;
  isPPNTransaction: boolean;

  constructor(props: Props) {
    super(props);
    const { navigation, blockchainNetworks } = this.props;
    this.assetData = navigation.getParam('assetData', {});
    this.isPPNTransaction = isPillarPaymentNetworkActive(blockchainNetworks);
    this.state = {
      isScanning: false,
      isResolvingCruxId: false,
      value: { address: '' },
      formStructure: getFormStructure(this.props.wallet.address),
      cruxAccount: {
        cruxID: null,
        valid: false,
        resolveErrorMessage: '',
        address: '',
      },
    };
  }

  componentDidMount() {
    const { isOnline, syncContactsSmartAddresses } = this.props;
    if (isOnline) {
      syncContactsSmartAddresses();
    }
  }

  handleChange = async (value: Object) => {
    const isCruxEnabled = this.assetData.tokenType !== COLLECTIBLES;
    const potentialCruxAddress = value.address;
    if (isCruxEnabled && isValidCruxID(potentialCruxAddress)) {
      this.setState({ isResolvingCruxId: true });
      const { cruxPay } = this.props;
      const { resolveCurrencyAddressForCruxID } = cruxPay.cruxClient;
      const currency = this.assetData.token;
      try {
        const resolvedAddress = await resolveCurrencyAddressForCruxID(potentialCruxAddress, currency);
        const resolvedCruxAccount = {
          address: resolvedAddress.addressHash,
          cruxID: potentialCruxAddress,
          valid: true,
        };
        this.setState({ cruxAccount: resolvedCruxAccount });
        this.setState({ isResolvingCruxId: false });
      } catch (e) {
        if (e instanceof CruxClientError) {
          console.log(`${e.errorCode}: ${e.message}`);
          let resolveErrorMessage = `${potentialCruxAddress} is invalid CRUX ID`;
          // Reference https://github.com/cruxprotocol/js-sdk/blob/master/error-handling.md
          if (e.errorCode === 1005) {
            resolveErrorMessage = `${currency} address not available for user`;
          }
          const resolvedCruxAccount = {
            address: '',
            cruxID: potentialCruxAddress,
            valid: false,
            resolveErrorMessage,
          };
          this.setState({ cruxAccount: resolvedCruxAccount });
          this.setState({ isResolvingCruxId: false });
        } else {
          throw e; // let others bubble up
        }
      }
    } else {
      const defaultCruxAccount = {
        address: '',
        cruxID: null,
        valid: false,
        resolveErrorMessage: '',
      };
      this.setState({ cruxAccount: defaultCruxAccount });
      this.setState({ isResolvingCruxId: false });
    }
    this.setState({ value });
  };

  handleFormSubmit = () => {
    const value = this._form.getValue();
    if (!value) return;
    this.navigateToNextScreen(value.address);
  };

  handleQRScannerOpen = async () => {
    this.setState({
      isScanning: !this.state.isScanning,
    }, () => {
      if (this.state.isScanning) {
        Keyboard.dismiss();
      }
    });
  };

  handleQRScannerClose = () => {
    this.setState({
      isScanning: false,
    });
  };

  handleQRRead = (address: string) => {
    this.setState({ value: { ...this.state.value, address }, isScanning: false }, () => {
      this.navigateToNextScreen(address);
    });
  };

  onContactPress = (user) => {
    const { navigation } = this.props;
    const {
      username,
      hasSmartWallet,
      ethAddress,
      isCruxID,
    } = user;
    if (this.isPPNTransaction && !hasSmartWallet) {
      Alert.alert(
        'This user is not on Pillar Network',
        'You both should be connected to Pillar Network in order to be able to send instant transactions for free',
        [
          { text: 'Open Chat', onPress: () => navigation.navigate(CHAT, { username }) },
          { text: 'Switch to Ethereum Mainnet', onPress: () => navigation.navigate(ACCOUNTS) },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
      return;
    }
    const cruxID = isCruxID ? username : undefined;
    this.navigateToNextScreen(ethAddress, cruxID);
  };

  renderContact = ({ item: user }) => {
    const {
      username,
      hasSmartWallet,
      profileImage,
      isUserAccount,
      type,
      isCruxID,
    } = user;

    const customProps = {};
    if (isUserAccount) {
      customProps.itemImageSource = type === ACCOUNT_TYPES.KEY_BASED ? keyWalletIcon : smartWalletIcon;
      customProps.noImageBorder = true;
    } else if (isCruxID) {
      customProps.itemImageSource = cruxPayIcon;
    } else {
      customProps.avatarUrl = profileImage;
    }

    return (
      <ListItemWithImage
        onPress={() => this.onContactPress(user)}
        wrapperOpacity={this.isPPNTransaction && !hasSmartWallet ? 0.3 : 1}
        label={username}
        {...customProps}
      />
    );
  };

  formatCruxAccountToContacts = (cruxAccount) => {
    if (cruxAccount.cruxID && cruxAccount.valid) {
      return {
        username: cruxAccount.cruxID,
        ethAddress: cruxAccount.address,
        hasSmartWallet: false,
        isUserAccount: false,
        isCruxID: true,
        type: null,
        sortToTop: true,
      };
    }
    return null;
  };

  navigateToNextScreen(ethAddress, cruxID) {
    if (this.assetData.tokenType === COLLECTIBLES) {
      this.props.navigation.navigate(SEND_COLLECTIBLE_CONFIRM, {
        assetData: this.assetData,
        receiver: ethAddress,
        source: 'Contact',
      });
      return;
    }
    this.props.navigateToSendTokenAmount({
      assetData: this.assetData,
      receiver: ethAddress,
      source: 'Contact',
      cruxID,
    });
  }

  render() {
    const {
      localContacts = [],
      contactsSmartAddresses,
      contactsSmartAddressesSynced,
      isOnline,
      accounts,
    } = this.props;
    const {
      isScanning,
      formStructure,
      value,
      cruxAccount,
      isResolvingCruxId,
    } = this.state;
    const isSearchQueryProvided = !!(value && value.address.length);
    const formOptions = generateFormOptions({ onIconPress: this.handleQRScannerOpen });

    const userAccounts = getInactiveUserAccounts(accounts).map(account => ({
      ...account,
      ethAddress: getAccountAddress(account),
      username: getAccountName(account.type, accounts),
      sortToTop: true,
      isUserAccount: true,
    }));

    // asset transfer between user accounts only in regular, but not in PPN send flow
    let contactsToRender = this.isPPNTransaction
      ? [...localContacts]
      : [...userAccounts, ...localContacts];
    if (isSearchQueryProvided) {
      const searchStr = value.address.toLowerCase();
      contactsToRender = contactsToRender.filter(({ username, ethAddress }) => {
        // $FlowFixMe
        const usernameFound = username.toLowerCase().includes(searchStr);
        if (value.address.length < 3) return usernameFound;
        return usernameFound || ethAddress.toLowerCase().startsWith(searchStr);
      });
    }

    if (contactsSmartAddresses) {
      const formattedCruxAccounts = this.formatCruxAccountToContacts(cruxAccount);
      if (formattedCruxAccounts) {
        contactsToRender.push(formattedCruxAccounts);
      }
      contactsToRender = contactsToRender
        .map(contact => {
          const { smartWallets = [] } = contactsSmartAddresses.find(
            ({ userId }) => contact.id && isCaseInsensitiveMatch(userId, contact.id),
          ) || {};
          return {
            ...contact,
            ethAddress: smartWallets[0] || contact.ethAddress,
            hasSmartWallet: !!smartWallets.length,
          };
        })
        .sort((a, b) => {
          // keep as it is
          if (a.hasSmartWallet === b.hasSmartWallet
            || (a.sortToTop && a.sortToTop === b.sortToTop)) return 0;
          // sort user accounts to top
          if (a.sortToTop || b.sortToTop) return 1;
          // sort smart wallet contacts to top
          return a.hasSmartWallet ? -1 : 1;
        });
    }

    const tokenName = this.assetData.tokenType === COLLECTIBLES ? this.assetData.name : this.assetData.token;
    const showSpinner = (isOnline && !contactsSmartAddressesSynced && !isEmpty(localContacts)) || (isResolvingCruxId);

    return (
      <ContainerWithHeader headerProps={{ centerItems: [{ title: `Send ${tokenName}` }] }} inset={{ bottom: 0 }}>
        <FormWrapper>
          {!!cruxAccount.cruxID && !cruxAccount.valid &&
          <HelpText style={{ color: baseColors.fireEngineRed }}>
            {cruxAccount.resolveErrorMessage}
          </HelpText>
          }
          <Form
            ref={node => {
              this._form = node;
            }}
            type={formStructure}
            options={formOptions}
            onChange={this.handleChange}
            onBlur={this.handleChange}
            value={value}
          />
        </FormWrapper>
        {showSpinner && <Container center><Spinner /></Container>}
        {!!contactsToRender.length &&
          <ContactCardList
            data={contactsToRender}
            renderItem={this.renderContact}
            keyExtractor={({ username }) => username}
            ItemSeparatorComponent={() => <Separator spaceOnLeft={82} />}
            contentContainerStyle={{ paddingTop: spacing.mediumLarge, paddingBottom: 40 }}
          />
        }
        <QRCodeScanner
          validator={ETHValidator}
          dataFormatter={decodeETHAddress}
          isActive={isScanning}
          onCancel={this.handleQRScannerClose}
          onRead={this.handleQRRead}
        />
        {isSearchQueryProvided &&
          <Footer keyboardVerticalOffset={35} backgroundColor={UIColors.defaultBackgroundColor}>
            <Button flexRight small disabled={!value.address.length} title="Next" onPress={this.handleFormSubmit} />
          </Footer>
        }
      </ContainerWithHeader>
    );
  }
}

const mapStateToProps = ({
  accounts: { data: accounts },
  contacts: { data: localContacts, contactsSmartAddresses: { addresses: contactsSmartAddresses } },
  wallet: { data: wallet },
  session: { data: { contactsSmartAddressesSynced, isOnline } },
  blockchainNetwork: { data: blockchainNetworks },
  cruxPay,
}) => ({
  accounts,
  localContacts,
  wallet,
  contactsSmartAddresses,
  contactsSmartAddressesSynced,
  isOnline,
  blockchainNetworks,
  cruxPay,
});

const structuredSelector = createStructuredSelector({
  activeAccount: activeAccountSelector,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch) => ({
  navigateToSendTokenAmount: (options) => dispatch(navigateToSendTokenAmountAction(options)),
  syncContactsSmartAddresses: () => dispatch(syncContactsSmartAddressesAction()),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(SendTokenContacts);
