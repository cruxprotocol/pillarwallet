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
import type { NavigationScreenProp } from 'react-navigation';

// components
import Separator from 'components/Separator';
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { Container, Footer } from 'components/Layout';
import Button from 'components/Button';
import SingleInput from 'components/TextInput/SingleInput';
import ListItemWithImage from 'components/ListItem/ListItemWithImage';
import AddressScanner from 'components/QRCodeScanner/AddressScanner';
import Spinner from 'components/Spinner';

// constants
import { COLLECTIBLES, BTC } from 'constants/assetsConstants';
import { ACCOUNTS, SEND_COLLECTIBLE_CONFIRM } from 'constants/navigationConstants';
import { CHAT } from 'constants/chatConstants';
import { ACCOUNT_TYPES } from 'constants/accountsConstants';

// actions
import { navigateToSendTokenAmountAction } from 'actions/smartWalletActions';
import { syncContactsSmartAddressesAction } from 'actions/contactsActions';

// utils
import { addressValidator } from 'utils/validators';
import { isCaseInsensitiveMatch } from 'utils/common';
import { isPillarPaymentNetworkActive } from 'utils/blockchainNetworks';
import { baseColors, fontSizes, spacing, UIColors } from 'utils/variables';
import { getAccountAddress, getAccountName, getInactiveUserAccounts } from 'utils/accounts';

// selectors
import { activeAccountSelector } from 'selectors';

// models, types
import type { Account, Accounts } from 'models/Account';
import type { ContactSmartAddressData } from 'models/Contacts';
import type { BlockchainNetwork } from 'models/BlockchainNetwork';
import type { SendNavigateOptions } from 'models/Navigation';
import type { AssetData } from 'models/Asset';
import type { Dispatch, RootReducerState } from 'reducers/rootReducer';

type Props = {
  navigation: NavigationScreenProp<*>,
  accounts: Accounts,
  localContacts: Object[],
  wallet: Object,
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
  value: {
    address: string,
  },
  formStructure: t.struct,
};

const qrCode = require('assets/images/qr.png');
const keyWalletIcon = require('assets/icons/icon_ethereum_network.png');
const smartWalletIcon = require('assets/icons/icon_smart_wallet.png');

const FormWrapper = styled.View`
  padding: ${spacing.mediumLarge}px ${spacing.large}px 6px;
  background-color: ${baseColors.white};
  border-bottom-color: ${baseColors.mediumLightGray};
  border-bottom-width: 1px;
`;

const ContactCardList = styled.FlatList`
  background-color: ${UIColors.defaultBackgroundColor};
`;

const { Form } = t.form;

function AddressInputTemplate(locals) {
  const { config: { onIconPress } } = locals;
  const errorMessage = locals.error;
  const inputProps = {
    onChange: locals.onChange,
    onBlur: locals.onBlur,
    placeholder: 'Username or wallet address',
    value: locals.value,
    keyboardType: locals.keyboardType,
    textAlign: 'left',
    maxLength: 42,
    letterSpacing: 0.1,
    fontSize: fontSizes.medium,
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

const getFormStructure = (ownAddress: string, token: string) => {
  const { validator, message } = addressValidator(token);

  const Address = t.refinement(t.String, (address): boolean => {
    return address.length && validator(address) && ownAddress !== address;
  });

  Address.getValidationErrorMessage = (address): string => {
    if (address === '') {
      return 'Address must be provided.';
    }

    if (ownAddress === address) {
      return 'You are not allowed to make transaction to yourself';
    }

    return message;
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
  assetData: AssetData;
  isPPNTransaction: boolean;

  constructor(props: Props) {
    super(props);
    const { navigation, blockchainNetworks } = this.props;
    this.assetData = navigation.getParam('assetData', {});
    this.isPPNTransaction = isPillarPaymentNetworkActive(blockchainNetworks);
    const { token } = this.assetData;

    this.state = {
      isScanning: false,
      value: { address: '' },
      formStructure: getFormStructure(this.props.wallet.address, token),
    };
  }

  componentDidMount() {
    const { isOnline, syncContactsSmartAddresses } = this.props;
    if (isOnline) {
      syncContactsSmartAddresses();
    }
  }

  handleChange = (value: Object) => {
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
    this.navigateToNextScreen(ethAddress);
  };

  renderContact = ({ item: user }) => {
    const {
      username,
      hasSmartWallet,
      profileImage,
      isUserAccount,
      type,
    } = user;

    const customProps = {};
    if (isUserAccount) {
      customProps.itemImageSource = type === ACCOUNT_TYPES.KEY_BASED ? keyWalletIcon : smartWalletIcon;
      customProps.noImageBorder = true;
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

  navigateToNextScreen(receiverAddress) {
    const { navigation, navigateToSendTokenAmount } = this.props;

    if (this.assetData.tokenType === COLLECTIBLES) {
      navigation.navigate(SEND_COLLECTIBLE_CONFIRM, {
        assetData: this.assetData,
        receiver: receiverAddress,
        source: 'Contact',
      });
      return;
    }
    navigateToSendTokenAmount({
      assetData: this.assetData,
      receiver: receiverAddress,
      source: 'Contact',
    });
  }

  renderContacts() {
    const {
      localContacts = [],
      contactsSmartAddresses,
      accounts,
    } = this.props;
    const { value } = this.state;

    const isSearchQueryProvided = !!(value && value.address.length);
    const userAccounts = getInactiveUserAccounts(accounts).map(account => ({
      ...account,
      ethAddress: getAccountAddress(account),
      username: getAccountName(account.type, accounts),
      sortToTop: true,
      isUserAccount: true,
    }));

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

    if (!contactsToRender.length) {
      return null;
    }

    return (
      <ContactCardList
        data={contactsToRender}
        renderItem={this.renderContact}
        keyExtractor={({ username }) => username}
        ItemSeparatorComponent={() => <Separator spaceOnLeft={82} />}
        contentContainerStyle={{ paddingTop: spacing.mediumLarge, paddingBottom: 40 }}
      />
    );
  }

  render() {
    const {
      localContacts = [],
      contactsSmartAddressesSynced,
      isOnline,
    } = this.props;
    const { tokenType, name, token } = this.assetData;
    const isCollectible = tokenType === COLLECTIBLES;

    const { isScanning, formStructure, value } = this.state;
    const isSearchQueryProvided = !!(value && value.address.length);
    const formOptions = generateFormOptions({ onIconPress: this.handleQRScannerOpen });

    const showContacts = isCollectible || token !== BTC;
    const defaultAssetName = this.isPPNTransaction ? 'synthetic asset' : 'asset';
    const tokenName = isCollectible ? (name || token) : (token || defaultAssetName);
    const headerTitle = `Send ${tokenName}`;
    const showSpinner = isOnline && !contactsSmartAddressesSynced && !isEmpty(localContacts);

    return (
      <ContainerWithHeader
        headerProps={{ centerItems: [{ title: headerTitle }] }}
        inset={{ bottom: 0 }}
      >
        <FormWrapper>
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
        {showContacts && this.renderContacts()}
        <AddressScanner
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
}: RootReducerState): $Shape<Props> => ({
  accounts,
  localContacts,
  wallet,
  contactsSmartAddresses,
  contactsSmartAddressesSynced,
  isOnline,
  blockchainNetworks,
});

const structuredSelector = createStructuredSelector({
  activeAccount: activeAccountSelector,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
  navigateToSendTokenAmount: (options: SendNavigateOptions) => dispatch(navigateToSendTokenAmountAction(options)),
  syncContactsSmartAddresses: () => dispatch(syncContactsSmartAddressesAction()),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(SendTokenContacts);
