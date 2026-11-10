import { assetManager, ImageAsset, Node, Sprite, SpriteFrame, Texture2D, view } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import type { WorldBoard } from '../../platform/wechat/cloudGame';
import { requirePrivacyAuthorization } from '../../platform/wechat/privacy';
import { createIdentityButton } from '../../platform/wechat/playerIdentity';
import { GREEN, INK, MUTED } from '../../presentation/gameVisuals';

type IdentityGame = Pick<GardenRuntime, 'ui' | 'cloud' | 'overlays' | 'lifecycle' | 'social'>;

/** World identities are authorized public profile data, never open-data-domain friend data. */
export function drawWorldPlayer(
    game: IdentityGame,
    parent: Node,
    row: WorldBoard['rows'][number],
    y: number,
) {
    game.ui.text(parent, String(row.rank), -255, y, 24, INK, 45);
    const name = row.identity === null ? (row.self ? '我' : row.player) : row.identity.nickname;
    const label = game.ui.text(parent, name, -15, y, 24, row.self ? '#366650' : INK, 270);
    // Player nicknames can contain glyphs absent from the game's static bitmap font.
    label.font = null;
    label.useSystemFont = true;
    game.ui.text(parent, `第 ${row.highest} 关`, 207, y, 24, INK, 135);
    if (row.identity === null) return;
    const node = game.ui.node2d('Player avatar', parent, -190, y, 42, 42);
    assetManager.loadRemote<ImageAsset>(row.identity.avatarUrl, { ext: '.png' }, (error, image) => {
        if (error) {
            console.warn('World avatar failed to load', error);
            return;
        }
        image.addRef();
        if (!parent.isValid || game.overlays.modal !== parent) {
            image.decRef();
            return;
        }
        const texture = new Texture2D();
        texture.image = image;
        const frame = new SpriteFrame();
        frame.texture = texture;
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        node.on(Node.EventType.NODE_DESTROYED, () => {
            frame.destroy();
            texture.destroy();
            image.decRef();
        });
    });
}

export function showWorldIdentity(game: IdentityGame, page: number) {
    const gap = Math.max(100, game.lifecycle.touchSize + 4);
    const panel = game.overlays.openModal(
        '微信头像昵称',
        '授权后将公开展示在世界排行榜',
        750 + 2 * (gap - 100),
    );
    game.overlays.modalStatusY = 0;
    game.ui.text(panel, '只用于排行榜展示，不影响游戏成绩', 0, 90, 24, MUTED);
    const status = game.ui.text(panel, '', 0, 35, 22, MUTED);
    game.ui.button(panel, '返回', 0, -60 - 2 * gap, 440, 64, GREEN, () =>
        game.social.worldLeaderboard(page),
    );
    game.ui.button(panel, '恢复匿名', 0, -60 - gap, 280, 48, GREEN, () => save(null));
    const save = (identity: { nickname: string; avatarUrl: string } | null) => {
        if (game.overlays.modal !== panel || game.cloud.cloudBusy) return;
        dispose();
        status.string = '';
        game.cloud.cloudTask(
            () =>
                game.cloud.cloud!.mutate('identity', {
                    nickname: identity === null ? null : identity.nickname,
                    avatarUrl: identity === null ? null : identity.avatarUrl,
                }),
            (state) => {
                game.cloud.applyCloudState(state);
                if (game.overlays.modal === panel) game.social.worldLeaderboard(page);
            },
            '正在保存头像昵称…',
        );
    };
    let dispose = () => {};
    panel.on(Node.EventType.NODE_DESTROYED, () => dispose());
    game.cloud.cloudTask(
        requirePrivacyAuthorization,
        () => {
            const frame = view.getFrameSize();
            const scale = frame.width / game.lifecycle.screenWidth;
            dispose = createIdentityButton(
                {
                    left: frame.width / 2 - 180 * scale,
                    top: frame.height / 2 + (60 - game.lifecycle.touchSize / 2) * scale,
                    width: 360 * scale,
                    height: game.lifecycle.touchSize * scale,
                },
                save,
                () => {
                    if (panel.isValid && game.overlays.modal === panel)
                        status.string = '尚未授权，可再次点击授权或返回';
                },
            );
        },
        '正在请求隐私授权…',
        true,
    );
}
