import { Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D } from 'cc';
import { FURNISHINGS } from '../domain/profile/profile';
import type { GardenRuntime } from './GardenRuntime';

/** Loads home artwork and refreshes already mounted views. */
export class HomeAssets {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'host' | 'assets' | 'lifecycle' | 'home' | 'courtyard' | 'overlays'
        >,
    ) {}
    loadHomeAssets() {
        resources.load('home/garden/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('首页场景加载失败', error);
                return;
            }
            this.game.assets.homeTexture = texture;
            texture.addRef();
            const frame = new SpriteFrame();
            frame.texture = texture;
            const scale = Math.max(
                this.game.lifecycle.screenWidth / texture.width,
                this.game.lifecycle.screenHeight / texture.height,
            );
            const w = this.game.lifecycle.screenWidth / scale,
                h = this.game.lifecycle.screenHeight / scale;
            frame.rect = new Rect((texture.width - w) / 2, (texture.height - h) / 2, w, h);
            frame.originalSize = new Size(w, h);
            frame.packable = false;
            this.game.assets.homeFrame = frame;
            if (this.game.home.homeScene) this.game.home.homeScene.spriteFrame = frame;
        });
        resources.load('home/resident-door/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('Resident doorway artwork load failed', error);
                return;
            }
            this.game.assets.residentDoorTexture = texture;
            texture.addRef();
            const frame = new SpriteFrame();
            frame.texture = texture;
            frame.rect = new Rect(0, 0, 180, 143);
            frame.originalSize = new Size(180, 143);
            frame.packable = false;
            this.game.assets.residentDoorFrame = frame;
            this.game.courtyard.refreshCourtyard();
        });
        resources.load('home/resident/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('庭院小蚂蚁加载失败', error);
                return;
            }
            this.game.assets.residentTexture = texture;
            texture.addRef();
            for (let i = 0; i < 12; i++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect((i % 4) * 128, Math.floor(i / 4) * 128, 128, 128);
                frame.originalSize = new Size(128, 128);
                frame.packable = false;
                this.game.assets.residentFrames.push(frame);
            }
            this.game.courtyard.refreshCourtyard();
        });
        resources.load('home/furnishings/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('庭院装饰加载失败', error);
                return;
            }
            this.game.assets.furnishingTexture = texture;
            texture.addRef();
            FURNISHINGS.forEach((item, index) => {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(Math.floor(index / 3) * 256, (index % 3) * 256, 256, 256);
                frame.originalSize = new Size(256, 256);
                frame.packable = false;
                this.game.assets.furnishingFrames.set(item.id, frame);
            });
            this.game.courtyard.refreshCourtyard();
            const updateSamples = (node: Node) => {
                for (const item of FURNISHINGS)
                    if (node.name === 'Furnishing thumbnail ' + item.id)
                        node.getComponent(Sprite)!.spriteFrame =
                            this.game.assets.furnishingFrames.get(item.id)!;
                node.children.forEach(updateSamples);
            };
            if (this.game.overlays.modal) updateSamples(this.game.overlays.modal);
        });
        resources.load('home/title/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('首页标题加载失败', error);
                return;
            }
            this.game.assets.homeTitleTexture = texture;
            texture.addRef();
            const frame = new SpriteFrame();
            frame.texture = texture;
            frame.rect = new Rect(0, 0, texture.width, texture.height);
            frame.originalSize = new Size(texture.width, texture.height);
            frame.packable = false;
            this.game.assets.homeTitleFrame = frame;
            if (this.game.home.homeTitle) this.game.home.homeTitle.spriteFrame = frame;
        });
        for (const name of ['play', 'album', 'shop', 'rank'])
            resources.load(`home/${name}/texture`, Texture2D, (error, texture) => {
                if (!this.game.host.isValid) return;
                if (error) {
                    console.error('首页按钮素材加载失败', name, error);
                    return;
                }
                texture.addRef();
                this.game.assets.homeActionTextures.push(texture);
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(0, 0, texture.width, texture.height);
                frame.originalSize = new Size(texture.width, texture.height);
                frame.packable = false;
                this.game.assets.homeActionFrames.set(name, frame);
                const apply = (node: Node) => {
                    if (node.name === `Home asset ${name}`)
                        node.getComponent(Sprite)!.spriteFrame = frame;
                    node.children.forEach(apply);
                };
                if (this.game.home.home) apply(this.game.home.home);
            });
    }
}
