import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeFriends,
  openFriendSettings,
} from '../assets/scripts/platform/wechat/friendBoard.ts';

// Exercise the actual adapter against WeChat's three documented permission states.
test('friend permission distinguishes unrequested, granted, refused and API failures', async () => {
  let state;
  let calls = 0;
  let failure;
  const previous = globalThis.wx;
  globalThis.wx = {
    requirePrivacyAuthorize: ({ success }) => success(),
    getSetting: ({ success }) => success({ authSetting: { 'scope.WxFriendInteraction': state } }),
    authorize: ({ scope, success, fail }) => {
      assert.equal(scope, 'scope.WxFriendInteraction');
      calls++;
      if (failure) fail(failure);
      else success();
    },
  };
  try {
    assert.equal(await authorizeFriends(), true);
    assert.equal(calls, 1, 'first request invokes WeChat authorization');
    state = true;
    assert.equal(await authorizeFriends(), true);
    state = false;
    assert.equal(await authorizeFriends(), false);
    assert.equal(calls, 1, 'known states do not repeat authorization');
    state = undefined;
    failure = { errno: 112, errMsg: 'api scope is not declared in the privacy agreement' };
    await assert.rejects(authorizeFriends(), { code: 'FRIENDS_CONFIG' });
    failure = { errno: 104, errMsg: 'privacy permission is not authorized' };
    await assert.rejects(authorizeFriends(), { code: 'FRIENDS_PRIVACY' });
    failure = { errMsg: 'authorize:fail network unavailable' };
    await assert.rejects(authorizeFriends(), {
      code: 'FRIENDS_API',
      message: '微信授权调用失败：authorize:fail network unavailable',
    });
    globalThis.wx.authorize = ({ fail }) => {
      state = false;
      fail({ errMsg: 'authorize:fail auth deny' });
    };
    assert.equal(await authorizeFriends(), false, 'a newly refused request gets a settings action');
    globalThis.wx.getSetting = ({ fail }) => fail({ errMsg: 'getSetting:fail' });
    await assert.rejects(authorizeFriends(), { code: 'FRIENDS_API' });
    globalThis.wx.requirePrivacyAuthorize = ({ fail }) =>
      fail({ errno: 104, errMsg: 'privacy permission is not authorized' });
    await assert.rejects(authorizeFriends(), { code: 'PRIVACY' });
    globalThis.wx.requirePrivacyAuthorize = ({ fail }) =>
      fail({ errno: 112, errMsg: 'api scope is not declared in the privacy agreement' });
    await assert.rejects(authorizeFriends(), { code: 'PRIVACY_CONFIG' });
  } finally {
    globalThis.wx = previous;
  }
});

test('opening friend settings runs immediately in the click and checks the returned scope', async () => {
  const previous = globalThis.wx;
  let calls = 0;
  let respond;
  globalThis.wx = {
    openSetting: (options) => {
      calls++;
      respond = options;
    },
  };
  try {
    const granted = openFriendSettings();
    assert.equal(calls, 1);
    respond.success({ authSetting: { 'scope.WxFriendInteraction': true } });
    assert.equal(await granted, true);
    const refused = openFriendSettings();
    respond.success({ authSetting: { 'scope.WxFriendInteraction': false } });
    assert.equal(await refused, false);
    const failed = openFriendSettings();
    respond.fail({ errMsg: 'openSetting:fail' });
    await assert.rejects(failed, { code: 'FRIENDS_API' });
  } finally {
    globalThis.wx = previous;
  }
});
