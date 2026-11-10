/** Obtains only the current player's explicitly authorized WeChat display identity. */
export type PlayerIdentity = { nickname: string; avatarUrl: string };
type UserInfoResult = {
    errMsg: string;
    userInfo?: { nickName: string; avatarUrl: string };
};
type UserInfoButton = {
    onTap(callback: (result: UserInfoResult) => void): void;
    destroy(): void;
};
type IdentityAPI = {
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
            lineHeight: number;
            backgroundColor: string;
            color: string;
            textAlign: 'center';
            fontSize: number;
            borderRadius: number;
        };
    }): UserInfoButton;
};
export function createIdentityButton(
    rect: { left: number; top: number; width: number; height: number },
    complete: (identity: PlayerIdentity) => void,
    refused: () => void,
): () => void {
    const wx = (globalThis as unknown as { wx: IdentityAPI }).wx;
    const button = wx.createUserInfoButton({
        type: 'text',
        text: '授权微信头像昵称',
        withCredentials: false,
        lang: 'zh_CN',
        style: {
            ...rect,
            lineHeight: rect.height,
            backgroundColor: '#80d4bb',
            color: '#245844',
            textAlign: 'center',
            fontSize: 16,
            borderRadius: 16,
        },
    });
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        button.destroy();
    };
    button.onTap((result) => {
        if (disposed) return;
        if (result.errMsg.endsWith(':ok') && result.userInfo) {
            dispose();
            complete({ nickname: result.userInfo.nickName, avatarUrl: result.userInfo.avatarUrl });
        } else {
            console.warn('WeChat identity authorization not completed', result.errMsg);
            refused();
        }
    });
    return dispose;
}
