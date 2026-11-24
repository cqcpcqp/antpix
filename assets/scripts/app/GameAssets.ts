import { SpriteFrame, Texture2D } from 'cc';
import type { sp } from 'cc';
import type { ResidentArtwork } from '../features/courtyard/residentArtwork';

/** Retains textures and sprite frames for the component lifetime. */
export class GameAssets {
    leaderboardFrames = new Map<string, SpriteFrame>();

    leaderboardTexture: Texture2D | null = null;

    homeFrame: SpriteFrame | null = null;

    homeTexture: Texture2D | null = null;

    homeTitleFrame: SpriteFrame | null = null;

    homeTitleTexture: Texture2D | null = null;

    homeActionFrames = new Map<string, SpriteFrame>();

    homeActionTextures: Texture2D[] = [];

    residentArtwork: ResidentArtwork | null = null;

    residentSkeleton: sp.SkeletonData | undefined;

    furnishingFrames = new Map<string, SpriteFrame>();

    furnishingTexture: Texture2D | null = null;

    nestFrames: SpriteFrame[] = [];

    nestTexture: Texture2D | null = null;

    antFrames: SpriteFrame[] = [];

    antTexture: Texture2D | null = null;

    containerFrames: SpriteFrame[] = [];

    containerTextures: Texture2D[] = [];

    trayFrames: SpriteFrame[] = [];

    trayTextures: Texture2D[] = [];
}
