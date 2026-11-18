type PageManager = {
    show(options: { openlink: string }): Promise<unknown>;
    destroy(): void;
};
type WechatPages = { createPageManager?: () => PageManager };

// Official recommendation component: game-evaluate in the WeChat open documentation.
export const RECOMMENDATION_OPENLINK =
    'TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw';

// Game circle homepage openlink supplied from this game's MP management console.
export const GAME_CLUB_OPENLINK =
    '-SSEykJvFV3pORt5kTNpSxp0AahrVL-1SnYymUHVVkb5ykiKu01v4XRhQlQxUOCC2b4xSiGGmJ2UDgoMEIfJvyWTTGPIAAthOYB6jC2mtZev47qsj9MMPV5Yp9IZoQpC3jPZ0KUvPev9oND_2622PqJ9-p75VKXQnadTD3MVumHRSwYhnyT-_WBvufCP7fklrjsKWPBTV_XHGBlO6SsQ-UBBqtqQUqYBvRdY06g9f4X9O5RrzbFgdOcKzVhVG0QtUOs2mV7mCMDadaL_GtGgdSLX5dKrE7dQR7xHfoi-RrmHBkPuA3YlRoOlfuXUcr2Q0OuZPDPR05zm_jt6_vyWIQ';

/** Owns one native openlink page; recommendation and game circle keep separate instances. */
export class WechatPage {
    constructor(private readonly openlink: string) {}
    private manager: PageManager | null = null;
    private opening = false;
    private disposed = false;

    async show(): Promise<'shown' | 'unsupported' | 'busy'> {
        if (this.disposed || this.opening) return 'busy';
        const wxApi = (globalThis as unknown as { wx?: WechatPages }).wx;
        if (!wxApi?.createPageManager) return 'unsupported';
        this.opening = true;
        try {
            if (!this.manager) this.manager = wxApi.createPageManager();
            await this.manager.show({ openlink: this.openlink });
            return 'shown';
        } finally {
            this.opening = false;
        }
    }

    destroy() {
        this.disposed = true;
        this.manager?.destroy();
        this.manager = null;
    }
}
