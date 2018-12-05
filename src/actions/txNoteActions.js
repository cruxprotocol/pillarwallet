// @flow
import ChatService from 'services/chat';
import Toast from 'components/Toast';
import { saveDbAction } from 'actions/dbActions';
import { extractTxNotesFromMessages } from 'utils/txNotes';
import {
  UPDATE_TX_NOTES,
  ADD_TX_NOTE,
} from 'constants/txNoteConstants';

const chat = new ChatService();

export const getExistingTxNotesAction = () => {
  return async (dispatch: Function) => {
    const txNotesRaw = await chat.client.getExistingMessages('tx-note').then(JSON.parse).catch(() => []);
    const txNotes = extractTxNotesFromMessages(txNotesRaw);
    dispatch(saveDbAction('txNotes', { txNotes }, true));
    dispatch({
      type: UPDATE_TX_NOTES,
      payload: txNotes,
    });
  };
};

export const sendTxNoteByContactAction = (payload: Object) => {
  return async (dispatch: Function, getState: Function) => {
    const { contact: { id: userId, username }, message } = payload;
    const {
      accessTokens: { data: accessTokens },
    } = getState();
    const connectionAccessTokens = accessTokens.find(({ userId: connectionUserId }) => connectionUserId === userId);
    if (!Object.keys(connectionAccessTokens).length) {
      return;
    }
    const { userAccessToken: userConnectionAccessToken } = connectionAccessTokens;
    await chat.client.addContact(username, userId, userConnectionAccessToken).catch(e => {
      if (e.code === 'ERR_ADD_CONTACT_FAILED') {
        Toast.show({
          message: e.message,
          type: 'warning',
          title: 'Cannot retrieve remote user',
          autoClose: false,
        });
      }
    });
    try {
      const content = JSON.stringify({ text: message.text, txHash: message.txHash });
      await chat.client.sendSilentMessageByContact('tx-note', {
        username,
        userId,
        userConnectionAccessToken,
        message: content,
      });
    } catch (e) {
      Toast.show({
        message: 'Unable to contact the server',
        type: 'warning',
        title: 'Cannot send the transaction note',
        autoClose: false,
      });
      return;
    }

    const msg = {
      text: message.text,
      txHash: message.txHash,
    };

    dispatch({
      type: ADD_TX_NOTE,
      payload: { txNote: msg },
    });
  };
};

export const getTxNoteByContactAction = (username: string, userId: string) => {
  return async (dispatch: Function, getState: Function) => {
    const {
      accessTokens: { data: accessTokens },
    } = getState();
    const connectionAccessTokens = accessTokens.find(({ userId: connectionUserId }) => connectionUserId === userId);
    if (!Object.keys(connectionAccessTokens).length) {
      return;
    }
    const { userAccessToken: userConnectionAccessToken } = connectionAccessTokens;
    await chat.client.addContact(username, userId, userConnectionAccessToken).catch(e => {
      if (e.code === 'ERR_ADD_CONTACT_FAILED') {
        Toast.show({
          message: e.message,
          type: 'warning',
          title: 'Cannot retrieve remote user',
          autoClose: false,
        });
      }
    });
    await chat.client.receiveNewMessagesByContact(username, 'tx-note').catch(() => null);

    await chat.client.getMessagesByContact(username, 'tx-note').catch(() => []);

    await dispatch(getExistingTxNotesAction());
  };
};
