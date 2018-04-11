// @flow
import * as React from 'react';
import {
  Text,
  View,
  Button,
} from 'react-native';
import styles from './styles';

const PASS_CODE_LENGTH = 6;

type PassCode = string[];

type State = {
  passCode: PassCode,
};

export default class PinCode extends React.Component<{}, State> {
  state = {
    passCode: [],
  };

  tempProps = {
    pageHeading: 'Enter Passcode',
    pageInstructions: 'Setup your Passcode',
  };

  handleKeyPress = (key: string) => {
    if (this.state.passCode.length === PASS_CODE_LENGTH) {
      return;
    }

    this.setState({
      passCode: [...this.state.passCode, key],
    }, () => {
      if (this.state.passCode.length === PASS_CODE_LENGTH) {
        // TODO: Handle callback for pin submit
        // this.props.onPinSubmit(this.state.passCode.join(''));
      }
    });
  };

  handleKeyPressDelete = () => {
    const { passCode } = this.state;
    this.setState({ passCode: passCode.slice(0, -1) });
  };

  handleKeyPressForgot = () => {
    console.log('Need to Reset Wallet'); // eslint-disable-line no-console
  };

  verifyPin = () => {
    const array = [];
    this.setState({ passCode: array });
  };

  createPinDot(i: number, passCode: PassCode) {
    return (
      <View key={i} style={[styles.inactivePinDot, passCode[i] && styles.activePinDot]} />
    );
  }

  createPinButton(key: string, title: string, callback: () => void) {
    return (
      <View style={styles.inputKey} key={key}>
        <Button title={title} onPress={callback} />
      </View>
    );
  }

  generatePinInputs() {
    const keyInputs = Array(9).fill('')
      .map((num, i) => {
        const key = `${i + 1}`;
        const title = key;
        const callback = () => this.handleKeyPress(key);
        return this.createPinButton(key, title, callback);
      });

    keyInputs.push(
      this.createPinButton('Forgot', 'Forgot?', () => this.handleKeyPressForgot()),
      this.createPinButton('0', '0', () => this.handleKeyPress('0')),
      this.createPinButton('⌫', '⌫', () => this.handleKeyPressDelete()),
    );

    return keyInputs;
  }

  render() {
    const { passCode } = this.state;
    const { pageHeading, pageInstructions } = this.tempProps;

    const pinCodeDots = Array(PASS_CODE_LENGTH).fill('')
      .map((num, i) => this.createPinDot(i, passCode));

    const keyInputs = this.generatePinInputs();

    return (
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <Text style={styles.header}> {pageHeading} </Text>
          <Text style={styles.paragraph}> {pageInstructions} </Text>
        </View>

        <View style={styles.pinContainer}>
          {pinCodeDots}
        </View>

        <View style={styles.inputKeyContainer}>
          {keyInputs}
        </View>
      </View>
    );
  }
}
