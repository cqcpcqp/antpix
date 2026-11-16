/** WeChat owns privacy and profile authorization; only explicit consent yields public data. */
export type PlayerIdentity = { nickname: string; avatarUrl: string };
export type IdentityPermission = boolean | undefined;
type PlatformError = { errMsg: string; errno?: number };
type UserInfo = { nickName: string; avatarUrl: string };
type TapResult = PlatformError & { userInfo?: UserInfo };
export type IdentityButton = { show(): void; hide(): void; destroy(): void };
type Settings = { authSetting: { 'scope.userInfo'?: boolean } };
type WechatIdentity = {
    getSetting(options: {
        success(result: Settings): void;
        fail(error: PlatformError): void;
    }): void;
    getPrivacySetting(options: {
        success(result: { needAuthorization: boolean }): void;
        fail(error: PlatformError): void;
    }): void;
    requirePrivacyAuthorize(options: { success(): void; fail(error: PlatformError): void }): void;
    openSetting(options: {
        success(result: Settings): void;
        fail(error: PlatformError): void;
    }): void;
    getUserInfo(options: {
        withCredentials: false;
        lang: 'zh_CN';
        success(result: { userInfo: UserInfo }): void;
        fail(error: PlatformError): void;
    }): void;
    createUserInfoButton(options: {
        type: 'text';
        text: string;
        withCredentials: false;
        lang: 'zh_CN';
        style: {
            left: number;
            top: number;
            width: number;
            height: number;
            backgroundColor: string;
        };
    }): IdentityButton & { onTap(callback: (result: TapResult) => void): void };
};
const api = () => (globalThis as unknown as { wx: WechatIdentity }).wx;
function failure(operation: string, error: PlatformError): Error {
    console.warn('WeChat profile request failed', {
        operation,
        errMsg: error.errMsg,
        errno: error.errno,
    });
    return new Error(`${error.errMsg}${error.errno === undefined ? '' : ` (${error.errno})`}`);
}
const identity = (user: UserInfo): PlayerIdentity => ({
    nickname: user.nickName,
    avatarUrl: user.avatarUrl,
});
export function identityPermission(): Promise<IdentityPermission> {
    return new Promise((resolve, reject) =>
        api().getSetting({
            success: (result) => resolve(result.authSetting['scope.userInfo']),
            fail: (error) => reject(failure('getSetting', error)),
        }),
    );
}
export function privacyRequired(): Promise<boolean> {
    return new Promise((resolve, reject) =>
        api().getPrivacySetting({
            success: (result) => resolve(result.needAuthorization),
            fail: (error) => reject(failure('getPrivacySetting', error)),
        }),
    );
}
export function authorizePrivacy(): Promise<void> {
    return new Promise((resolve, reject) =>
        api().requirePrivacyAuthorize({
            success: resolve,
            fail: (error) => reject(failure('requirePrivacyAuthorize', error)),
        }),
    );
}
export function readIdentity(): Promise<PlayerIdentity> {
    return new Promise((resolve, reject) =>
        api().getUserInfo({
            withCredentials: false,
            lang: 'zh_CN',
            success: (result) => resolve(identity(result.userInfo)),
            fail: (error) => reject(failure('getUserInfo', error)),
        }),
    );
}
/** Invoke inside the player's click, before any promise continuation. */
export function openIdentitySettings(): Promise<IdentityPermission> {
    return new Promise((resolve, reject) =>
        api().openSetting({
            success: (result) => resolve(result.authSetting['scope.userInfo']),
            fail: (error) => reject(failure('openSetting', error)),
        }),
    );
}
/** A transparent native trigger sits exactly over the visible ranking entry, never the screen. */
export function createIdentityButton(
    rect: { left: number; top: number; width: number; height: number },
    tapped: (identity: PlayerIdentity | null, error: Error | null) => void,
): IdentityButton {
    const button = api().createUserInfoButton({
        type: 'text',
        text: '',
        withCredentials: false,
        lang: 'zh_CN',
        style: { ...rect, backgroundColor: 'rgba(0,0,0,0)' },
    });
    // CSS bounds only: never include userInfo in device diagnostics.
    console.info('WeChat native identity entry', rect);
    let disposed = false;
    button.onTap((result) => {
        if (disposed) return;
        if (result.errMsg.endsWith(':ok') && result.userInfo)
            tapped(identity(result.userInfo), null);
        else tapped(null, failure('createUserInfoButton.onTap', result));
    });
    return {
        show: () => {
            if (!disposed) button.show();
        },
        hide: () => {
            if (!disposed) button.hide();
        },
        destroy: () => {
            if (!disposed) {
                disposed = true;
                button.destroy();
            }
        },
    };
}
