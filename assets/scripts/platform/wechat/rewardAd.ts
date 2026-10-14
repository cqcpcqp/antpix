// Rewarded-video adapter. Empty ID intentionally keeps the local test flow enabled.
export const REWARDED_VIDEO_AD_UNIT_ID = '';
export const rewardedVideoConfigured = () => REWARDED_VIDEO_AD_UNIT_ID.length > 0;
type CloseResult = { isEnded: boolean };
type RewardedVideo = {
    load(): Promise<void>;
    show(): Promise<void>;
    onClose(callback: (result: CloseResult) => void): void;
    offClose(callback: (result: CloseResult) => void): void;
    onError(callback: () => void): void;
    offError(callback: () => void): void;
};
let watching = false;
export async function showRewardedVideo(): Promise<boolean> {
    if (!rewardedVideoConfigured() || watching) return false;
    const wxApi = (
        globalThis as unknown as {
            wx?: { createRewardedVideoAd(options: { adUnitId: string }): RewardedVideo };
        }
    ).wx;
    if (!wxApi) return false;
    watching = true;
    try {
        const ad = wxApi.createRewardedVideoAd({ adUnitId: REWARDED_VIDEO_AD_UNIT_ID });
        return await new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (completed: boolean) => {
                if (settled) return;
                settled = true;
                ad.offClose(close);
                ad.offError(fail);
                resolve(completed);
            };
            const close = (result: CloseResult) => finish(result.isEnded === true);
            const fail = () => finish(false);
            ad.onClose(close);
            ad.onError(fail);
            ad.load()
                .then(() => {
                    if (!settled) return ad.show();
                })
                .catch(fail);
        });
    } catch {
        return false;
    } finally {
        watching = false;
    }
}
