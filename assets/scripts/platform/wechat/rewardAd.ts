/** WeChat uses real placement IDs; non-WeChat previews retain the local demo flow. */
export const REWARDED_VIDEO_AD_UNIT_IDS = {
    speed: 'adunit-f322986754089230',
    slot: 'adunit-f249e4574cf20141',
} as const;
export type RewardAdPlacement = keyof typeof REWARDED_VIDEO_AD_UNIT_IDS;
export const rewardedVideoConfigured = () =>
    typeof (globalThis as unknown as { wx?: WechatAds }).wx !== 'undefined';
type CloseResult = { isEnded: boolean };
type RewardedVideo = {
    load(): Promise<void>;
    show(): Promise<void>;
    onClose(callback: (result: CloseResult) => void): void;
    offClose(callback: (result: CloseResult) => void): void;
    onError(callback: () => void): void;
    offError(callback: () => void): void;
};
type WechatAds = { createRewardedVideoAd(options: { adUnitId: string }): RewardedVideo };
const instances = new Map<RewardAdPlacement, RewardedVideo>();
let watching = false;

/** Reuse one instance per placement and serialize playback across both rewards. */
export async function showRewardedVideo(placement: RewardAdPlacement): Promise<boolean> {
    if (!rewardedVideoConfigured() || watching) return false;
    const wxApi = (globalThis as unknown as { wx?: WechatAds }).wx;
    if (!wxApi) return false;
    watching = true;
    try {
        let ad = instances.get(placement);
        if (!ad) {
            ad = wxApi.createRewardedVideoAd({ adUnitId: REWARDED_VIDEO_AD_UNIT_IDS[placement] });
            instances.set(placement, ad);
        }
        const video = ad;
        return await new Promise<boolean>((resolve) => {
            let settled = false;
            let presenting = false;
            const finish = (completed: boolean) => {
                if (settled) return;
                settled = true;
                video.offClose(close);
                video.offError(error);
                resolve(completed);
            };
            const close = (result: CloseResult) => finish(result.isEnded === true);
            // Initial show/load failures are handled by their promises so onError
            // cannot end the attempt before the single load-and-show retry.
            const error = () => {
                if (presenting) finish(false);
            };
            video.onClose(close);
            video.onError(error);
            const present = async () => {
                try {
                    await video.show();
                } catch {
                    if (settled) return;
                    await video.load();
                    if (settled) return;
                    await video.show();
                }
                presenting = true;
            };
            present().catch(() => finish(false));
        });
    } catch {
        return false;
    } finally {
        watching = false;
    }
}
