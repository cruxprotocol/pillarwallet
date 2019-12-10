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

// service
import { getCruxWebViewInput } from 'services/cruxPay';

// type
import type { Assets } from 'models/Asset';

// constants
import { CRUXPAY_INTRO } from 'constants/navigationConstants';

// actions
import { setBrowsingWebViewAction } from 'actions/appSettingsActions';


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

  componentDidMount = () => {
    getCruxWebViewInput().then((currentInputData) => {
      this.setState({
        loading: false,
        currentInputData,
      });
      this.props.setBrowsingWebView(true);
    }).catch(() => {});
  };

  componentWillUnmount() {
    this.props.setBrowsingWebView(false);
  }

  cruxPayCallback = async (event) => {
    const { cruxPay, navigation } = this.props;

    const { putAddressMap, registerCruxID } = cruxPay.cruxClient;
    const parsedPostMessage = JSON.parse(event.nativeEvent.data);
    switch (parsedPostMessage.type) {
      case 'editExisting':
        putAddressMap(parsedPostMessage.data.checkedCurrencies).then((map) => {
          console.log(map);
        }).catch((err) => {
          console.error(err);
        });
        break;
      case 'createNew':
        registerCruxID(parsedPostMessage.data.newCruxIDSubdomain).then(() => {
          putAddressMap(parsedPostMessage.data.checkedCurrencies).then((map) => {
            console.log(map);
          }).catch((err) => {
            console.error(err);
          });
        }).catch((err) => {
          console.error(err);
        });
        break;
      case 'close':
        navigation.navigate(CRUXPAY_INTRO);
        break;
      default:
        break;
    }
  };

  render() {
    const { assets } = this.props;
    const {
      loading,
      currentInputData,
    } = this.state;
    const cruxPayURL = 'https://s3-ap-southeast-1.amazonaws.com/files.coinswitch.co/openpay-setup/1.0.0/build/index.html';
    const availableCurrencies = {};
    Object.keys(assets).forEach((key) => {
      availableCurrencies[key] = assets[key].address;
    });
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
  cruxPay,
}) => ({
  cruxPay,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch: Function) => ({
  setBrowsingWebView: isBrowsing => dispatch(setBrowsingWebViewAction(isBrowsing)),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(CruxPayRegistration);
