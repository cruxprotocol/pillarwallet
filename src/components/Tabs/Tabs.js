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
import { Platform } from 'react-native';
import styled from 'styled-components/native';
import { CachedImage } from 'react-native-cached-image';
import Title from 'components/Title';
import Icon from 'components/Icon';
import { MediumText } from 'components/Typography';
import { Shadow } from 'components/Shadow';
import { baseColors, UIColors, spacing, fontSizes } from 'utils/variables';

type Tab = {
  id: string,
  name: string,
  icon?: string,
  onPress: () => void,
  unread?: number,
  tabImageNormal?: string,
  tabImageActive?: string
}

type Props = {
  initialActiveTab?: string,
  title?: string,
  tabs: Tab[],
  bgColor?: string,
  wrapperStyle?: Object,
  isFloating?: boolean,
  coverColor?: string,
  onTabChange?: (isChanging?: boolean) => void,
}

type TabWrapperProps = {
  children: React.Node,
  width?: number,
  showSVGShadow?: boolean,
}

type TabsComponentProps = {
  title: string,
  bgColor?: string,
  wrapperStyle?: Object,
  isFloating?: boolean,
  renderTabList: () => Array<React.Node>,
}

type State = {
  activeTab: string,
  tabLengths: Object,
}

const TabOuterWrapper = styled.View`
  background-color: ${props => props.backgroundColor ? props.backgroundColor : 'transparent'};
  padding: 12px ${spacing.large}px;
`;

const TabsWrapper = styled.View`
  flex-direction: row;
  background-color: ${baseColors.pattensBlue};
  padding: 2px;
  border-radius: 18px;
  height: 36px;
`;

const TabSizer = styled.View`
  flex-grow: 1;
  position: relative;
`;

const TabItem = styled.TouchableOpacity`
  height: ${props => props.isAndroid ? 53.5 : 32};
  align-items: flex-start;
  justify-content: center;
  background-color: ${props => props.active ? baseColors.white : 'transparent'};
  border-radius: 16px;
  flex-direction: row;
  flex-grow: 1;
  ${props => props.active
    ? `
    shadow-color: ${UIColors.tabShadowColor};
    shadow-radius: 10px;
    shadow-opacity: 1;
    shadow-offset: 0px 7px;
    `
    : ''}
`;

const TabItemIcon = styled(Icon)`
  font-size: ${fontSizes.regular}px;
  margin-right: 4px;
  margin-top: 2px;
  color: ${props => props.active ? baseColors.slateBlack : baseColors.electricBlue};
`;

const TabItemText = styled(MediumText)`
  font-size: ${fontSizes.regular}px;
  color: ${props => props.active ? baseColors.slateBlack : baseColors.electricBlue};
`;

const ActivityFeedHeader = styled.View`
  padding: 4px ${spacing.mediumLarge}px 0;
`;

const TextWrapper = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 32px;
  ${props => props.extraPadding
    ? `padding-left: 34px;
      padding-right: 34px;`
    : ''}
`;

const FloatingHeader = styled.View`
  width: 100%;
  position: absolute;
  top: -10px;
  left: 0;
  z-index: 10;
  background-color: transparent;
  min-height: 60px;
`;

const Cover = styled.View`
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  background-color: ${props => props.coverColor ? props.coverColor : UIColors.defaultBackgroundColor};
  height: 30px;
  justify-content: flex-start;
  align-items: center;
  padding-top: 0px;
`;


const TabWrapper = (props: TabWrapperProps) => {
  const {
    children,
    width,
    showSVGShadow,
  } = props;
  if (showSVGShadow && width) {
    return (
      <Shadow
        useSVGShadow
        widthIOS={width}
        heightIOS={32}
        shadowColorOS="#d8d8d8"
        shadowRadius={16}
        shadowOpacity={0.3}
        shadowOffsetY={3}
        shadowOffsetX={0}
        shadowBorder={8}
      >
        {children}
      </Shadow>
    );
  }
  return children;
};

const TabsComponent = (props: TabsComponentProps) => {
  const {
    title,
    bgColor,
    wrapperStyle,
    isFloating,
    renderTabList,
  } = props;

  let additionalWrapperStyle = {};
  if (isFloating) {
    additionalWrapperStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 2,
      width: '100%',
    };
  }

  return (
    <TabOuterWrapper backgroundColor={bgColor} style={[wrapperStyle, additionalWrapperStyle]}>
      {!!title &&
      <ActivityFeedHeader>
        <Title subtitle noMargin title={title} />
      </ActivityFeedHeader>
      }
      <TabsWrapper>
        {renderTabList()}
      </TabsWrapper>
    </TabOuterWrapper>
  );
};

const UnreadBadge = styled.View`
  height: 24px;
  width: 24px;
  border-radius: 12px;
  background-color: ${baseColors.electricBlue};
  position: absolute;
  top: 4px;
  right: 2px;
  align-items: center;
  justify-content: center;
`;

const UnreadText = styled(MediumText)`
  font-size: ${fontSizes.regular}px;
  color: ${baseColors.white};
`;

const TabImage = styled(CachedImage)`
  width: 16px;
  height: 16px;
  margin-right: 4px;
`;

export default class Tabs extends React.Component<Props, State> {
  state = {
    activeTab: this.props.initialActiveTab || this.props.tabs[0].id,
    tabLengths: {},
  };

  renderIcon = (tab: Object) => {
    const {
      icon,
      tabImageNormal,
      tabImageActive,
      id,
    } = tab;
    const { activeTab } = this.state;
    const isActive = activeTab === id;
    const tabImage = isActive ? tabImageActive : tabImageNormal;

    if (icon) {
      return (
        <TabItemIcon active={isActive} name={icon} />
      );
    }

    if (tabImageActive || tabImageNormal) {
      return (
        <TabImage source={tabImage} resizeMethod="resize" resizeMode={Platform.OS === 'ios' ? 'contain' : 'cover'} />
      );
    }

    return null;
  };

  renderTabItems = (tabs: Tab[]) => {
    const { activeTab, tabLengths } = this.state;
    const { onTabChange } = this.props;

    const tabItems = tabs.map(tab => {
      const isActive = activeTab === tab.id;
      const {
        id,
        name,
        unread,
        onPress,
      } = tab;

      const tabSizerStyle = {};
      if (Platform.OS === 'android') {
        if (tabs.length === 2) {
          tabSizerStyle.width = '50%';
        } else {
          tabSizerStyle.width = tabLengths[id];
        }
      }

      return (
        <TabSizer
          key={id}
          style={tabSizerStyle}
        >
          <TabWrapper showSVGShadow={isActive && Platform.OS === 'android' && tabLengths[id]} width={tabLengths[id]}>
            <TabItem
              activeOpacity={1}
              active={isActive}
              onPress={() => {
                if (onTabChange) onTabChange(true);
                this.setState({ activeTab: id });
                requestAnimationFrame(() => {
                  onPress();
                  if (onTabChange) onTabChange();
                });
              }}
              onLayout={(e) => {
                if (tabLengths[id]) return;
                const thisTabLength = e.nativeEvent.layout.width;
                const newLengths = { ...tabLengths };
                newLengths[id] = thisTabLength;
                this.setState({ tabLengths: newLengths });
              }}
            >
              <TextWrapper extraPadding={!!unread}>
                {this.renderIcon(tab)}
                <TabItemText active={isActive}>{name}</TabItemText>
                {!!unread && <UnreadBadge><UnreadText>{unread < 10 ? unread : '9+'}</UnreadText></UnreadBadge>}
              </TextWrapper>
            </TabItem>
          </TabWrapper>
        </TabSizer>
      );
    });
    return tabItems;
  };

  render() {
    const { isFloating, tabs, coverColor } = this.props;

    if (isFloating) {
      return (
        <FloatingHeader>
          <Cover coverColor={coverColor} />
          <TabsComponent {...this.props} renderTabList={() => this.renderTabItems(tabs)} />
        </FloatingHeader>
      );
    }

    return (
      <TabsComponent {...this.props} renderTabList={() => this.renderTabItems(tabs)} />
    );
  }
}
