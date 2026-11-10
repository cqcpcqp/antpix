import { CloudGameError } from './cloudGame';
import { requirePrivacyAuthorization } from './privacy';

const SCORE_KEY = 'ant-progress-v4';
const FRIEND_SCOPE = 'scope.WxFriendInteraction';
type PlatformError = { errMsg: string; errno?: number };
type Settings = { authSetting: { 'scope.WxFriendInteraction'?: boolean } };
type SettingsOptions = { success(result: Settings): void; fail(error: PlatformError): void };
type FriendAPI = {
    authorize(options: { scope: string; success(): void; fail(error: PlatformError): void }): void;
    getSetting(options: SettingsOptions): void;
    openSetting(options: SettingsOptions): void;
    setUserCloudStorage(options: {
        KVDataList: { key: string; value: string }[];
        success(): void;
        fail(error: unknown): void;
    }): void;
    getOpenDataContext(): {
        postMessage(message: { type: string; page?: number; delta?: number }): void;
    };
};
const api = () => (globalThis as unknown as { wx: FriendAPI }).wx;
let writes: Promise<void> = Promise.resolve();
export function syncFriendScore(highest: number, reachedAt: number): Promise<void> {
    const write = () =>
        new Promise<void>((resolve, reject) =>
            api().setUserCloudStorage({
                KVDataList: [{ key: SCORE_KEY, value: JSON.stringify({ highest, reachedAt }) }],
                success: resolve,
                fail: reject,
            }),
        );
    writes = writes.catch(() => {}).then(write);
    return writes;
}
/** Keep platform diagnostics; a failed API call is not proof of a denied scope. */
function permissionError(operation: string, error: PlatformError): CloudGameError {
    console.error('WeChat friend permission failed', { operation, ...error });
    if (error.errno === 112 || error.errno === 1025 || error.errno === 1026)
        return new CloudGameError('FRIENDS_CONFIG', '好友榜暂未开放，请联系开发者配置隐私指引');
    if (error.errno === 104)
        return new CloudGameError('FRIENDS_PRIVACY', '需要同意游戏隐私指引才能查看好友榜');
    return new CloudGameError('FRIENDS_API', `微信授权调用失败：${error.errMsg}`);
}
function friendPermission(): Promise<boolean | undefined> {
    return new Promise((resolve, reject) =>
        api().getSetting({
            success: (result) => resolve(result.authSetting[FRIEND_SCOPE]),
            fail: (error) => reject(permissionError('getSetting', error)),
        }),
    );
}
export async function authorizeFriends(): Promise<boolean> {
    await requirePrivacyAuthorization();
    const state = await friendPermission();
    if (state !== undefined) return state;
    return new Promise((resolve, reject) =>
        api().authorize({
            scope: FRIEND_SCOPE,
            success: () => resolve(true),
            fail: (error) => {
                // Only an explicit false setting means the player refused permission.
                const failure = permissionError('authorize', error);
                friendPermission().then(
                    (current) => (current === false ? resolve(false) : reject(failure)),
                    reject,
                );
            },
        }),
    );
}
/** Invoke directly from the settings button's click, before any asynchronous work. */
export function openFriendSettings(): Promise<boolean> {
    return new Promise((resolve, reject) =>
        api().openSetting({
            success: (result) => resolve(result.authSetting[FRIEND_SCOPE] === true),
            fail: (error) => reject(permissionError('openSetting', error)),
        }),
    );
}
export function showFriendPage(page: number) {
    api().getOpenDataContext().postMessage({ type: 'ant-friends', page });
}
export function changeFriendPage(delta: number) {
    api().getOpenDataContext().postMessage({ type: 'ant-friends-page', delta });
}
