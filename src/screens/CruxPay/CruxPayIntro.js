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

import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import { ScrollWrapper, Wrapper } from 'components/Layout';
import { MediumText, BoldText, TextLink } from 'components/Typography';
import Button from 'components/Button';

import { baseColors, fontStyles } from 'utils/variables';
import { responsiveSize } from 'utils/ui';


import { CRUXPAY_REGISTRATION } from 'constants/navigationConstants';


type Props = {
  navigation: NavigationScreenProp<*>,
  addNetwork: Function,
  baseFiatCurrency: ?string,
}

type State = {
  showDeployPayOptions: boolean,
}

const CustomWrapper = styled.View`
  flex: 1;
  padding: 20px 55px 20px 46px;
`;

const Title = styled(BoldText)`
  color: ${baseColors.persianBlue};
  ${fontStyles.rJumbo};
`;

const BodyText = styled(MediumText)`
  color: ${baseColors.persianBlue};
  ${fontStyles.rBig};
  margin-top: ${responsiveSize(26)}px;
`;

const ButtonWrapper = styled(Wrapper)`
  margin: 30px 0 50px;
  padding: 0 46px;
`;


const FeatureIcon = styled(CachedImage)`
  height: 124px;
  width: 124px;
  margin-bottom: 24px;
`;

const CruxPayIcon = require('assets/images/logo_cruxpay.png');

class CruxPayIntro extends React.PureComponent<Props, State> {
  render() {
    const {
      navigation,
    } = this.props;
    const isDeployed = navigation.getParam('deploy', false);

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
            <FeatureIcon source={CruxPayIcon} />
            <Title>
              CruxPay
            </Title>
            <BodyText>
              CruxPay is a protocol which aims to link any blockchain address to a human-readable name, and let users
              interact with each other and dApps with ease.
            </BodyText>
            <BodyText>
              Clicking setup below registers your CruxID and ties it with your account. After registration is completed,
              you can manage your CruxID account directly from manage section. Be noted that all address selected
              would now be publicly exposed.
            </BodyText>
            <BodyText>
              Registering CruxID may take several hours.
            </BodyText>
            <BodyText>
              Visit <TextLink onPress={() => Linking.openURL('https://cruxpay.com')}>
                https://cruxpay.com
            </TextLink> for more information.
            </BodyText>
          </CustomWrapper>
          <ButtonWrapper>
            <Button
              block
              title={isDeployed ? 'Manage Address' : 'Setup CruxPay'}
              onPress={() => navigation.navigate(CRUXPAY_REGISTRATION, { backNavivation: true })}
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

export default connect()(CruxPayIntro);
