import { Rect, Size, SpriteFrame, Texture2D } from 'cc';
import type { GardenRuntime } from './GardenRuntime';
import { LEADERBOARD_ART } from '../presentation/leaderboardArt';

/** One shared atlas is loaded through the startup retry gate, and retained for the app lifetime. */
export class LeaderboardAssets {
    constructor(private readonly game: Pick<GardenRuntime, 'startup' | 'host' | 'assets'>) {}

    load() {
        this.game.startup.load('leaderboard/laurel/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('排行榜美术加载失败', error);
                return;
            }
            texture.addRef();
            this.game.assets.leaderboardTexture = texture;
            for (const [name, region] of Object.entries(LEADERBOARD_ART)) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(
                    region.rect[0],
                    region.rect[1],
                    region.rect[2],
                    region.rect[3],
                );
                frame.originalSize = new Size(region.rect[2], region.rect[3]);
                frame.packable = false;
                [frame.insetLeft, frame.insetTop, frame.insetRight, frame.insetBottom] =
                    region.insets;
                this.game.assets.leaderboardFrames.set(name, frame);
            }
        });
    }

    destroy() {
        for (const frame of this.game.assets.leaderboardFrames.values()) frame.destroy();
        this.game.assets.leaderboardFrames.clear();
        this.game.assets.leaderboardTexture?.decRef();
        this.game.assets.leaderboardTexture = null;
    }
}
