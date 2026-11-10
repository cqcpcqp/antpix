import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityButton } from '../assets/scripts/platform/wechat/playerIdentity.ts';

test('native identity button requires a successful tap and is disposed exactly once', () => {
  const previous = globalThis.wx;
  let tap;
  let destroyed = 0;
  let refused = 0;
  const identities = [];
  globalThis.wx = {
    createUserInfoButton(options) {
      assert.equal(options.withCredentials, false);
      assert.equal(options.style.width, 180);
      return {
        onTap: (callback) => {
          tap = callback;
        },
        destroy: () => destroyed++,
      };
    },
  };
  try {
    const dispose = createIdentityButton(
      { left: 0, top: 0, width: 180, height: 44 },
      (value) => identities.push(value),
      () => refused++,
    );
    assert.equal(identities.length, 0);
    tap({ errMsg: 'getUserInfo:fail auth deny' });
    assert.equal(refused, 1);
    assert.equal(destroyed, 0);
    const result = {
      errMsg: 'getUserInfo:ok',
      userInfo: {
        nickName: '微信玩家',
        avatarUrl: 'https://thirdwx.qlogo.cn/avatar/132',
      },
    };
    tap(result);
    assert.deepEqual(identities, [{ nickname: '微信玩家', avatarUrl: result.userInfo.avatarUrl }]);
    dispose();
    tap(result);
    assert.equal(destroyed, 1);
    assert.equal(identities.length, 1, 'late taps must not save an identity twice');
  } finally {
    globalThis.wx = previous;
  }
});
