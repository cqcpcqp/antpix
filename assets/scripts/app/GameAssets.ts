import { SpriteFrame, Texture2D } from 'cc';

/** Retains textures and sprite frames for the component lifetime. */
export class GameAssets {
    homeFrame: SpriteFrame | null = null;

    homeTexture: Texture2D | null = null;

    homeTitleFrame: SpriteFrame | null = null;

    homeTitleTexture: Texture2D | null = null;

    homeActionFrames = new Map<string, SpriteFrame>();

    homeActionTextures: Texture2D[] = [];

    residentFrames: SpriteFrame[] = [];

    residentTexture: Texture2D | null = null;

    residentDoorFrame: SpriteFrame | null = null;

    residentDoorTexture: Texture2D | null = null;

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
