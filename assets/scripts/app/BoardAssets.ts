import { BitmapFont, Label, Node, Rect, resources, Size, SpriteFrame, Texture2D } from 'cc';
import { SKINS } from '../domain/profile/profile';
import type { GardenRuntime } from './GardenRuntime';

/** Loads gameplay atlases and fonts, including existing live sprites. */
export class BoardAssets {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'host'
            | 'assets'
            | 'ants'
            | 'layout'
            | 'shop'
            | 'containers'
            | 'queue'
            | 'session'
            | 'ui'
            | 'lifecycle'
        >,
    ) {}
    loadBoardAssets() {
        // Shared tinted silhouettes plus neutral highlights/legs keep texture size
        // constant as the level catalog grows. Both layers share one material.
        resources.load('ants/workers/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('蚂蚁图集加载失败', error);
                return;
            }
            this.game.assets.antTexture = texture;
            texture.addRef();
            for (let tile = 0; tile < 8; tile++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(tile * 64, 0, 64, 64);
                frame.originalSize = new Size(64, 64);
                frame.packable = false;
                this.game.assets.antFrames.push(frame);
            }
            for (const visual of this.game.ants.antPool) this.game.ants.useAntAtlas(visual);
        });
        resources.load('trays/wood-hole/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('木质洞口素材加载失败', error);
                return;
            }
            this.game.assets.nestTexture = texture;
            texture.addRef();
            for (let index = 0; index < SKINS.length; index++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(index * 104, 0, 104, 60);
                frame.originalSize = new Size(104, 60);
                frame.packable = false;
                this.game.assets.nestFrames.push(frame);
            }
            this.game.layout.drawNest();
            if (this.game.shop.nestShopContent) this.game.shop.nestShop();
        });
        for (const name of ['wood', 'acorn', 'garden-background'])
            resources.load(`trays/${name}/texture`, Texture2D, (error, texture) => {
                if (!this.game.host.isValid) return;
                if (error) {
                    console.error('木托盘素材加载失败', error);
                    return;
                }
                texture.addRef();
                this.game.assets.trayTextures.push(texture);
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(0, 0, texture.width, texture.height);
                frame.originalSize = new Size(texture.width, texture.height);
                frame.packable = false;
                if (name === 'wood') {
                    frame.insetLeft = frame.insetRight = 76;
                    frame.insetTop = 48;
                    frame.insetBottom = 48;
                }
                this.game.assets.trayFrames.push(frame);
                for (const sprite of this.game.layout.traySprites)
                    if (sprite.node.name === name) sprite.spriteFrame = frame;
            });
        resources.load('containers/boxes/texture', Texture2D, (error, texture) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('容器图集加载失败', error);
                return;
            }
            this.game.assets.containerTextures.push(texture);
            texture.addRef();
            for (let tile = 0; tile < 2; tile++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(tile * 88, 0, 88, 88);
                frame.originalSize = new Size(88, 88);
                frame.packable = false;
                this.game.assets.containerFrames[tile] = frame;
            }
            for (const slot of this.game.containers.slotViews) {
                if (slot.id >= 0 && this.game.assets.containerFrames[0]) {
                    slot.body.clear();
                    this.game.containers.applyContainerMaterial(slot.sprite, slot.color);
                }
            }
            for (const card of this.game.queue.cardViews) {
                const jar = this.game.session.model?.columns[card.column]?.[card.row];
                if (
                    card.node.active &&
                    jar?.id === card.id &&
                    this.game.assets.containerFrames[0]
                ) {
                    card.art.clear();
                    this.game.containers.containerShadow(card.art);
                    this.game.containers.applyContainerMaterial(card.sprite, jar.color);
                }
            }
        });
        resources.load('fonts/container-digits', BitmapFont, (error, font) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('容器数字字体加载失败', error);
                return;
            }
            this.game.ui.containerFont = font;
            for (const label of this.game.ui.containerLabels) label.font = font;
        });
        resources.load('fonts/ant-nest-bitmap', BitmapFont, (error, font) => {
            if (!this.game.host.isValid) return;
            if (error) {
                console.error('游戏字体加载失败', error);
                return;
            }
            this.game.ui.gameFont = font;
            const apply = (node: Node) => {
                const label = node.getComponent(Label);
                if (label) {
                    label.font =
                        this.game.ui.containerLabels.has(label) && this.game.ui.containerFont
                            ? this.game.ui.containerFont
                            : font;
                    label.isBold = false;
                }
                for (const child of node.children) apply(child);
            };
            apply(this.game.lifecycle.root);
        });
    }
}
