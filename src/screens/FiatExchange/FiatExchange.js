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
import { WebView } from 'react-native-webview';
import type { NavigationScreenProp } from 'react-navigation';
import {
  MOONPAY_WIDGET_URL,
  MOONPAY_KEY,
} from 'react-native-dotenv';

import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { Wrapper } from 'components/Layout';
import ErrorMessage from 'components/ErrorMessage';
import { setBrowsingWebViewAction } from 'actions/appSettingsActions';
import { getActiveAccountAddress } from 'utils/accounts';

import type { RootReducerState } from 'reducers/rootReducer';
import type { Accounts } from 'models/Account';

type Props = {
  wallet: Object,
  navigation: NavigationScreenProp<*>,
  assets: Object,
  user: Object,
  accounts: Accounts,
  setBrowsingWebView: Function,
};

type State = {
  error: string,
  provider: string,
  moonPayURL: string,
};

class FiatExchange extends React.Component<Props, State> {
  state = {
    error: '',
    provider: '',
    moonPayURL: '',
  };

  componentDidMount = () => {
    const {
      user, accounts, navigation,
    } = this.props;

    const {
      fiatOfferOrder: {
        provider,
        fromAsset,
        toAsset,
        amount: sourceAmount,
      },
    } = navigation.state.params;
    const { code: sourceCurrency } = fromAsset;
    const { code: destCurrency } = toAsset;

    const { email = '' } = user;

    const destAddress = getActiveAccountAddress(accounts);

    const moonPayURL = `${MOONPAY_WIDGET_URL}`
      + `?apiKey=${MOONPAY_KEY}`
      + `&walletAddress=${destAddress}`
      + `&email=${email}&currencyCode=${destCurrency}`
      + `&baseCurrencyCode=${sourceCurrency}`
      + `&baseCurrencyAmount=${sourceAmount}`
      + '&feeBreakdown=true'
      + `&externalCustomerId=${user.id}`;

    this.setState({
      provider,
      moonPayURL,
    });

    this.props.setBrowsingWebView(true);
  };

  componentWillUnmount() {
    this.props.setBrowsingWebView(false);
  }

  sendWyreCallback = (event) => {
    const data = JSON.parse(event.nativeEvent.data);

    if (data) {
      this.props.navigation.goBack(null);
    }
  };

  render() {
    const {
      error,
      provider,
      moonPayURL,
    } = this.state;

    return (
      <ContainerWithHeader headerProps={{ centerItems: [{ title: `${provider} Payment` }] }} >
        {!!error && <ErrorMessage>{error}</ErrorMessage>}
        <Wrapper regularPadding style={{ justifyContent: 'space-between', flex: 1 }}>
          {
            provider === 'MoonPay'
            &&
            <WebView
              source={{ uri: moonPayURL }}
              originWhitelist={['*']}
            />
          }
        </Wrapper>
      </ContainerWithHeader>
    );
  }
}

const mapStateToProps = ({
  wallet: { data: wallet },
  user: { data: user },
  accounts: { data: accounts },
}: RootReducerState): $Shape<Props> => ({
  wallet,
  user,
  accounts,
});

const mapDispatchToProps = (dispatch: Function) => ({
  setBrowsingWebView: isBrowsing => dispatch(setBrowsingWebViewAction(isBrowsing)),
});

export default connect(mapStateToProps, mapDispatchToProps)(FiatExchange);
