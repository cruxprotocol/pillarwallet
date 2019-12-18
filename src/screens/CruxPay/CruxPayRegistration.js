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
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { Wrapper } from 'components/Layout';
import { WebView } from 'react-native-webview';
import type { NavigationScreenProp } from 'react-navigation';
import { createStructuredSelector } from 'reselect';
import Spinner from 'components/Spinner';
import styled from 'styled-components/native';
import { accountAssetsSelector } from 'selectors/assets';
import { Alert } from 'react-native';

// service
import { getCruxWebViewInput, getCruxPaySubdomain } from 'services/cruxPay';

// type
import type { Assets } from 'models/Asset';

// constants
import { CRUXPAY_INTRO, HOME } from 'constants/navigationConstants';

// actions
import { setBrowsingWebViewAction } from 'actions/appSettingsActions';
import { loadCruxIDStateAction } from 'actions/cruxPayActions';


export const LoadingSpinner = styled(Spinner)`
  padding-top: 20px;
  align-items: center;
  justify-content: center;
`;


type Props = {
  navigation: NavigationScreenProp<*>,
  assets: Assets,
  cruxPay: Object,
  setBrowsingWebView: Function,
}

type State = {
  loading: boolean,
  currentInputData: any,
};

class CruxPayRegistration extends React.PureComponent<Props, State> {
  state = {
    loading: true,
    currentInputData: {},
  };

  onClosePress = () => {
    const { navigation } = this.props;
    Alert.alert(
      'Cancel CruxPay Setup',
      'Are you sure you want to cancel the setup?',
      [
        { text: 'Yes', onPress: () => navigation.goBack() },
        { text: 'No', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  handleError(error: any) {
    console.error('CruxPay handleError: ', error);
  }

  onRegisterSuccess = async () => {
    // TODO: discuss what to do if a few failed?
    await this.props.loadCruxIDState();
    const { navigation, cruxPay } = this.props;
    Alert.alert(
      'Registration Success',
      `Your cruxID: ${cruxPay.cruxID} is being updated. It takes about 3-4 hours to complete registration on blockchain.`,
      [
        { text: 'OK', onPress: () => navigation.navigate(HOME) },
      ],
    );
  };

  onPutAddressSuccess = async () => {
    // TODO: discuss what to do if a few failed?
    await this.props.loadCruxIDState();
    const { navigation, cruxPay } = this.props;
    Alert.alert(
      'Update CruxPay Addresses',
      `Your cruxID: ${cruxPay.cruxID} is has been updated!`,
      [
        { text: 'OK', onPress: () => navigation.navigate(HOME) },
      ],
    );
  };

  componentDidMount = () => {
    const { user, assets, cruxPay } = this.props;
    const availableCurrencies = {};
    Object.keys(assets).forEach((key) => {
      // eslint-disable-next-line max-len
      availableCurrencies[key.toLowerCase()] = assets[key].address ? { addressHash: assets[key].address } : { addressHash: assets[key].address };
    });
    const inputExtension = {
      availableCurrencies,
      theme: '#3742fa',
      cruxIDSubdomain: cruxPay.cruxID ? getCruxPaySubdomain(cruxPay.cruxID) : '',
      suggestedCruxIDSubdomain: user.username,
    };
    getCruxWebViewInput(cruxPay, inputExtension).then((currentInputData) => {
      this.setState({
        loading: false,
        currentInputData,
      });
      this.props.setBrowsingWebView(true);
    }).catch(this.handleError);
  };

  componentWillUnmount() {
    this.props.setBrowsingWebView(false);
  }

  cruxPayCallback = async (event) => {
    const { cruxPay } = this.props;

    const { putAddressMap, registerCruxID } = cruxPay.cruxClient;
    const parsedPostMessage = JSON.parse(event.nativeEvent.data);
    switch (parsedPostMessage.type) {
      case 'editExisting':
        putAddressMap(parsedPostMessage.data.checkedCurrencies).then(async (map) => {
          await this.onPutAddressSuccess(map);
        }).catch(this.handleError);
        break;
      case 'createNew':
        registerCruxID(parsedPostMessage.data.newCruxIDSubdomain).then(() => {
          putAddressMap(parsedPostMessage.data.checkedCurrencies).then(async (map) => {
            await this.onRegisterSuccess(map);
          }).catch(this.handleError);
        }).catch(this.handleError);
        break;
      case 'close':
        this.onClosePress();
        break;
      default:
        break;
    }
  };

  render() {
    const {
      loading,
      currentInputData,
    } = this.state;
    const cruxPayURL = 'https://s3-ap-southeast-1.amazonaws.com/files.coinswitch.co/openpay-setup/1.0.0/build/index.html';
    const webviewCallsReact = `window.postMessage(${JSON.stringify(JSON.stringify(currentInputData))}, '*');`;
    return (
      <ContainerWithHeader headerProps={{ centerItems: [{ title: 'Register CruxPay' }] }} >
        <Wrapper regularPadding style={{ justifyContent: 'space-between', flex: 1 }}>
          {loading && <LoadingSpinner />}
          {!loading &&
            <WebView
              clearCache={false}
              source={{ uri: cruxPayURL }}
              originWhitelist={['*']}
              onMessage={this.cruxPayCallback}
              injectedJavaScript={webviewCallsReact}
            />
          }
        </Wrapper>
      </ContainerWithHeader>
    );
  }
}

const structuredSelector = createStructuredSelector({
  assets: accountAssetsSelector,
});

const mapStateToProps = ({
  user: { data: user },
  cruxPay,
}) => ({
  user,
  cruxPay,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch: Function) => ({
  setBrowsingWebView: isBrowsing => dispatch(setBrowsingWebViewAction(isBrowsing)),
  loadCruxIDState: () => dispatch(loadCruxIDStateAction()),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(CruxPayRegistration);
