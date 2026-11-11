import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_ENV, wechatTransport } from '../assets/scripts/platform/wechat/cloudGame.ts';

// Model the callback API independently of any SDK Promise return value.
test('cloud transport waits for SDK callbacks and preserves results and failures', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'wx');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'wx', previous);
    else delete globalThis.wx;
  });
  let callbacks;
  globalThis.wx = {
    cloud: {
      init: ({ env }) => assert.equal(env, CLOUD_ENV),
      callFunction(options) {
        callbacks = options;
        // Callback-based SDK calls do not need to return a Promise.
      },
    },
  };
  const transport = wechatTransport();
  const request = { action: 'login', catalogVersion: 4 };
  let settled = false;
  const pending = transport(request);
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await new Promise(setImmediate);
  assert.equal(settled, false, 'must wait for success/fail instead of reading undefined.result');
  assert.equal(callbacks.name, 'game');
  assert.equal(callbacks.data, request);
  const result = { ok: true, output: { userId: 'transport-user' } };
  callbacks.success({ result });
  assert.equal(await pending, result);

  const failed = transport(request);
  const platformError = { errCode: -1, errMsg: 'callFunction:fail network error' };
  callbacks.fail(platformError);
  await assert.rejects(failed, (error) => error === platformError);

  const retried = transport(request);
  const rejection = { ok: false, code: 'VERSION', message: 'Update required' };
  callbacks.success({ result: rejection });
  assert.equal(await retried, rejection, 'business responses pass through unchanged');

  const syncError = new Error('SDK invocation failed');
  globalThis.wx.cloud.callFunction = () => {
    throw syncError;
  };
  await assert.rejects(transport(request), (error) => error === syncError);
});
