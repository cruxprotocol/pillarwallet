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
import { UIColors, baseColors, fontSizes, appFont, spacing } from 'utils/variables';
import { Animated, Dimensions, Keyboard } from 'react-native';
import { BaseText } from 'components/Typography';
import IconButton from 'components/IconButton';

const { width } = Dimensions.get('window');
const componentWidth = width - (spacing.large * 2);
const closeButtonWidth = 58;
const inputShrinkSize = ((componentWidth - closeButtonWidth) * 100) / componentWidth;

const SearchHolder = styled.View`
  margin-bottom: ${props => props.marginBottom || 20}px;
  margin-top: ${props => props.marginTop || 0}px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const CancelButton = styled.TouchableOpacity`
  width: ${closeButtonWidth + spacing.large}px;
  align-items: flex-end;
  padding: ${spacing.small}px ${spacing.large}px;
  margin-right: -${spacing.large}px;
`;

const animatedInputFieldStyles = {
  height: 40,
  borderWidth: 1,
  borderRadius: 20,
};

const InputField = styled.TextInput`
  flex: 1;
  height: 42px;
  padding-left: 14px;
  color: ${baseColors.slateBlack};
  font-size: ${fontSizes.regular}px;
  font-family: ${appFont.regular};
`;

const InputIcon = styled(IconButton)`
  flex: 0 0 20px;
  position: absolute;
  right: 12px;
  top: 7px;
`;

type inputPropsType = {
  placeholder?: string,
  backgroundColor?: string,
  onChange: Function,
  onBlur?: Function,
  onFocus?: Function,
  value: ?string,
};

type Props = {
  errorMessage?: string,
  inputProps: inputPropsType,
  placeholder?: string,
  backgroundColor?: string,
  marginTop?: number,
  marginBottom?: number | string, // if '0'
  inputRef?: Object,
  customCloseAction?: Function,
  forceShowCloseButton?: boolean,
};

type State = {
  animShrink: Object,
  isFocused: boolean,
};

type EventLike = {
  nativeEvent: Object,
};

class SearchBar extends React.Component<Props, State> {
  value: string;

  constructor(props: Props) {
    super(props);
    const { forceShowCloseButton } = props;
    this.value = '';
    this.state = {
      animShrink: new Animated.Value(forceShowCloseButton ? inputShrinkSize : 100),
      isFocused: !!forceShowCloseButton,
    };
  }

  static defaultProps = {
    inputType: 'default',
    trim: true,
    placeholder: 'Search or add new contact',
  };

  handleChange = (e: EventLike) => {
    const { inputProps: { onChange } } = this.props;
    this.value = e.nativeEvent.text;
    onChange(this.value);
  };

  handleBlur = () => {
    const { inputProps: { onBlur }, forceShowCloseButton } = this.props;
    if (forceShowCloseButton) return;
    if (!this.value) {
      this.hideKeyboard();
    }
    if (onBlur) {
      onBlur(this.value);
    }
    Keyboard.dismiss();
    this.setState({ isFocused: false });
  };

  handleCancel = () => {
    const { inputProps: { onChange, onBlur } } = this.props;
    this.value = '';
    if (onChange) {
      onChange(this.value);
    }
    this.hideKeyboard();
    if (onBlur) {
      onBlur(this.value);
    }
    this.setState({ isFocused: false });
  };

  hideKeyboard = () => {
    Animated.timing(this.state.animShrink, {
      toValue: 100,
      duration: 250,
    }).start();
    Keyboard.dismiss();
  };

  handleFocus = () => {
    const { inputProps: { onFocus } } = this.props;
    if (onFocus) {
      onFocus();
    }
    this.setState({ isFocused: true });
    Animated.timing(this.state.animShrink, {
      toValue: inputShrinkSize,
      duration: 250,
    }).start();
  };

  handleSubmit = () => {
    const { inputProps: { onChange, value } } = this.props;
    onChange(value);
  };

  render() {
    const {
      inputProps,
      placeholder,
      backgroundColor,
      marginTop,
      marginBottom,
      inputRef,
      customCloseAction,
      forceShowCloseButton,
    } = this.props;
    const {
      animShrink,
      isFocused,
    } = this.state;
    const { value = '' } = inputProps;

    return (
      <SearchHolder marginTop={marginTop} marginBottom={marginBottom}>
        <Animated.View
          style={{
            ...animatedInputFieldStyles,
            borderColor: isFocused ? UIColors.focusedBorderColor : baseColors.solitude,
            width: animShrink.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '1%'],
            }),
            backgroundColor: backgroundColor || baseColors.white,
          }}
        >
          <InputField
            {...inputProps}
            onFocus={this.handleFocus}
            onChange={this.handleChange}
            onBlur={this.handleBlur}
            value={value}
            placeholder={placeholder}
            placeholderTextColor={UIColors.placeholderTextColor}
            underlineColorAndroid="transparent"
            autoCorrect={false}
            innerRef={inputRef}
          />
          <InputIcon
            icon="search"
            onPress={isFocused ? this.handleSubmit : this.handleFocus}
            iconStyle={{
              width: 24,
              height: 24,
              color: baseColors.electricBlue,
              fontSize: 24,
            }}
          />
        </Animated.View>
        {(isFocused || !!value || forceShowCloseButton) &&
        <CancelButton onPress={customCloseAction || this.handleCancel}>
          <BaseText style={{ color: baseColors.electricBlue }}>Close</BaseText>
        </CancelButton>
        }
      </SearchHolder>
    );
  }
}

export default SearchBar;
