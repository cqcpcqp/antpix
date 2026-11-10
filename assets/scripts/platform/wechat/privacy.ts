import { CloudGameError } from './cloudGame';

/** Use the official WeChat privacy popup before requesting personal information. */
export function requirePrivacyAuthorization(): Promise<void> {
    const wx = (
        globalThis as unknown as {
            wx: {
                requirePrivacyAuthorize(options: {
                    success(): void;
                    fail(error: { errMsg: string; errno?: number }): void;
                }): void;
            };
        }
    ).wx;
    return new Promise((resolve, reject) =>
        wx.requirePrivacyAuthorize({
            success: resolve,
            fail: (error) => {
                console.error('WeChat privacy authorization failed', error);
                const configuration =
                    error.errno === 112 || error.errno === 1025 || error.errno === 1026;
                reject(
                    new CloudGameError(
                        configuration ? 'PRIVACY_CONFIG' : 'PRIVACY',
                        configuration
                            ? '请联系开发者配置游戏隐私指引'
                            : error.errno === 104
                              ? '需要同意游戏隐私指引后再试'
                              : `微信隐私授权失败：${error.errMsg}`,
                    ),
                );
            },
        }),
    );
}
