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
import styled from 'styled-components/native';
import type { NavigationScreenProp } from 'react-navigation';
import { connect } from 'react-redux';
import { Linking } from 'react-native';
import { CachedImage } from 'react-native-cached-image';
import { createStructuredSelector } from 'reselect';

// components
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { ScrollWrapper, Wrapper } from 'components/Layout';
import { MediumText, BoldText, TextLink } from 'components/Typography';
import Button from 'components/Button';

import { baseColors, fontStyles, spacing } from 'utils/variables';
import { responsiveSize } from 'utils/ui';


import { accountAssetsSelector } from 'selectors/assets';

// constants
import { CRUXPAY_REGISTRATION, CRUXPAY_INJECTED_SCREEN, HOME } from 'constants/navigationConstants';

// model
import type { Assets } from 'models/Asset';

// service
import {
  getCruxWebViewInput,
  getExtendedInputs,
  confirmCloseCruxUI,
  processRegisterSuccess,
} from 'services/cruxPay';


// actions
import { setBrowsingWebViewAction } from 'actions/appSettingsActions';
import { loadCruxIDStateAction } from 'actions/cruxPayActions';


type Props = {
  navigation: NavigationScreenProp<*>,
  assets: Assets,
  cruxPay: Object,
  user: Object,
  addNetwork: Function,
  baseFiatCurrency: ?string,
}

type State = {
  showDeployPayOptions: boolean,
  loadCruxIDState: Function,
}

const CustomWrapper = styled.View`
  flex: 1;
  padding: ${spacing.large}px 40px ${spacing.large}px 40px;
`;

const Title = styled(BoldText)`
  color: ${baseColors.black};
  ${fontStyles.rJumbo};
`;

const BodyText = styled(MediumText)`
  color: ${baseColors.persianBlue};
  ${fontStyles.rBig};
  margin-top: ${responsiveSize(26)}px;
`;

const ButtonWrapper = styled(Wrapper)`
  margin: 20px 20px;
  padding: 0 0;
`;

const FeatureIcon = styled(CachedImage)`
  height: 64px;
  width: 64px;
  margin-bottom: ${spacing.large}px;
`;

const InlineIconTitle = styled.View`
  flex: 1;
  flex-direction: row;
`;

const CruxPayIcon = require('assets/images/logo_cruxpay.png');

class CruxPayIntro extends React.PureComponent<Props, State> {
  onClosePress = () => {
    const { navigation } = this.props;
    confirmCloseCruxUI(navigation);
  };

  onRegisterSuccess = async (map: Object) => {
    const { navigation, cruxPay, loadCruxIDState } = this.props;
    await processRegisterSuccess(loadCruxIDState, cruxPay, navigation, map);
  };

  getInputExtension = () => {
    const { user: { username }, assets, cruxPay: { cruxID } } = this.props;
    return getExtendedInputs(assets, cruxID, username);
  };

  render() {
    const {
      navigation,
      cruxPay,
    } = this.props;

    return (
      <ContainerWithHeader
        headerProps={{
          floating: true,
          transparent: true,
        }}
        backgroundColor={baseColors.zircon}
      >
        <ScrollWrapper contentContainerStyle={{ paddingTop: 80 }}>
          <CustomWrapper>
            <InlineIconTitle>
              <FeatureIcon source={CruxPayIcon} />
              <Title>
                CruxPay
              </Title>
            </InlineIconTitle>
            <BodyText>
              CruxPay is a protocol which aims to link any blockchain address to a human-readable name, and let users
              interact with each other and dApps with ease.
            </BodyText>
            <BodyText>
              Clicking setup below registers your CRUX ID and ties it with your account. After registration
              is completed, you can manage your CRUX ID account directly from manage section in settings.
              Be noted that all address selected would now be publicly exposed.
            </BodyText>
            <BodyText>
              For more information, visit&nbsp;
              <TextLink onPress={() => Linking.openURL('https://cruxpay.com')}>
                https://cruxpay.com
              </TextLink>
            </BodyText>
          </CustomWrapper>
          <ButtonWrapper>
            <Button
              block
              title="Setup CruxPay"
              onPress={() => navigation.navigate(CRUXPAY_INJECTED_SCREEN, {
                pageTitle: 'Register CruxPay',
                onClosePress: this.onClosePress,
                onRegisterSuccess: this.onRegisterSuccess,
                inputExtension: this.getInputExtension(),
                cruxClient: cruxPay.cruxClient,
                getCruxWebViewInput,
              })}
              style={{
                backgroundColor: baseColors.persianBlue,
                marginTop: 40,
                marginBottom: 20,
                borderRadius: 6,
              }}
              textStyle={{ color: baseColors.white }}
            />
          </ButtonWrapper>
        </ScrollWrapper>
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

export default connect(combinedMapStateToProps, mapDispatchToProps)(CruxPayIntro);
