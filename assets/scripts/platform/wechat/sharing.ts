type ShareContent = { title: string };
type ShareHandler = () => ShareContent;
type WechatSharing = {
    showShareMenu(options: { menus: string[] }): void;
    onShareAppMessage(handler: ShareHandler): void;
    offShareAppMessage(handler: ShareHandler): void;
    onShareTimeline?(handler: ShareHandler): void;
    offShareTimeline?(handler: ShareHandler): void;
};

/** Owns native menu sharing; scene teardown must release both SDK subscriptions. */
export function initializeWechatSharing(): () => void {
    const wxApi = (globalThis as unknown as { wx?: WechatSharing }).wx;
    if (!wxApi) return () => {};

    // Let WeChat supply its default artwork; sharing always opens the normal game entry.
    const content: ShareHandler = () => ({ title: '生态蚂蚁窝' });
    wxApi.onShareAppMessage(content);
    const menus = ['shareAppMessage'];
    // Timeline sharing is platform-dependent; friend forwarding must still initialize.
    if (wxApi.onShareTimeline && wxApi.offShareTimeline) {
        wxApi.onShareTimeline(content);
        menus.push('shareTimeline');
    }
    wxApi.showShareMenu({ menus });

    return () => {
        wxApi.offShareAppMessage(content);
        wxApi.offShareTimeline?.(content);
    };
}
