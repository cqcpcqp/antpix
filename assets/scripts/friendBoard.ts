import { CloudGameError } from './cloudGame';

const SCORE_KEY = 'ant-progress-v4';
type FriendAPI = {
    authorize(options: { scope: string; success(): void; fail(error: unknown): void }): void;
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
export function authorizeFriends(): Promise<void> {
    return new Promise((resolve, reject) =>
        api().authorize({
            scope: 'scope.WxFriendInteraction',
            success: resolve,
            fail: () =>
                reject(new CloudGameError('FRIENDS', '请在微信设置中允许好友互动权限后重试')),
        }),
    );
}
export function showFriendPage(page: number) {
    api().getOpenDataContext().postMessage({ type: 'ant-friends', page });
}
export function changeFriendPage(delta: number) {
    api().getOpenDataContext().postMessage({ type: 'ant-friends-page', delta });
}
