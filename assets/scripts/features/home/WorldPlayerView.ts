import {
    assetManager,
    ImageAsset,
    Label,
    Mask,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import type { WorldBoard } from '../../platform/wechat/cloudGame';
import { color, INK } from '../../presentation/gameVisuals';
import {
    PODIUM,
    rankingLaurel,
    rankingMedal,
    rankingPlaque,
} from '../../presentation/leaderboardDecor';
import { WORLD_BOARD } from '../../presentation/leaderboardLayout';
import { ellipsizeNickname } from '../../presentation/playerNickname';

type View = Pick<GardenRuntime, 'ui'>;
type Player = WorldBoard['rows'][number];

/** Live leaderboard cards. Every avatar owns its remote resources until its node is destroyed. */
export function worldPlayerView(
    game: View,
    parent: Node,
    row: Player,
    index: number,
    page: number,
) {
    if (page === 0 && row.rank <= 3) {
        honorCard(game, parent, row);
        return;
    }
    const y =
        page === 0
            ? WORLD_BOARD.firstRowY - (row.rank - 4) * WORLD_BOARD.rowStep
            : WORLD_BOARD.laterPageY - index * WORLD_BOARD.laterPageStep;
    const surface = game.ui.graphics(parent, `Rank ${row.rank} surface`);
    if (row.self) {
        game.ui.box(surface, 0, y, 574, 66, 20, '#E6F2DE');
        surface.strokeColor = color('#B4CCAA');
        surface.lineWidth = 1.5;
        surface.roundRect(-287, y - 33, 574, 66, 20);
        surface.stroke();
    } else {
        surface.strokeColor = color('#E2D5B9');
        surface.lineWidth = 1;
        surface.moveTo(-280, y - 36);
        surface.lineTo(280, y - 36);
        surface.stroke();
    }
    game.ui.text(parent, String(row.rank), -265, y, 25, INK, 46);
    playerAvatar(game, parent, row, -202, y, 62);
    playerName(game, parent, row, row.self ? -32 : -20, y, row.self ? 228 : 252, 25, true);
    game.ui.text(parent, `第 ${row.highest} 关`, 219, y, 25, INK, 132);
    if (row.self) selfTag(game, parent, 116, y);
}

function honorCard(game: View, parent: Node, row: Player) {
    const champion = row.rank === 1;
    const x = champion ? 0 : row.rank === 2 ? -146 : 146;
    const y = champion ? WORLD_BOARD.championY : WORLD_BOARD.runnersY;
    const card = game.ui.graphics(parent, `Rank ${row.rank} plaque`);
    card.node.setPosition(x, y);
    rankingPlaque(card, champion ? 574 : 278, champion ? 190 : 138, row.rank, row.self);
    const avatarX = x + (champion ? -170 : -83);
    const avatar = playerAvatar(game, parent, row, avatarX, y, champion ? 128 : 86);
    if (champion) {
        const wreath = game.ui.node2d('Champion laurel', parent, avatarX, y, 190, 190);
        rankingLaurel(84, (name) => game.ui.node2d(name, wreath, 0, 0, 32, 44));
        // Keep the wreath behind the live portrait and its frame.
        wreath.setSiblingIndex(avatar.getSiblingIndex());
        game.ui.text(parent, '榜首', 78, y + 59, 21, '#9D7130', 100);
    }
    playerName(
        game,
        parent,
        row,
        x + (champion ? 78 : 44),
        y + (champion ? 12 : 23),
        champion ? 262 : 132,
        champion ? 32 : 23,
    );
    game.ui.text(
        parent,
        `第 ${row.highest} 关`,
        x + (champion ? 78 : 44),
        y - (champion ? 46 : 23),
        champion ? 47 : 28,
        INK,
        champion ? 280 : 136,
    );
    const medalX = avatarX - (champion ? 0 : 28);
    const medalY = y - (champion ? 55 : 30);
    const medal = game.ui.graphics(parent, `Rank ${row.rank} medal`);
    medal.node.setPosition(medalX, medalY);
    rankingMedal(medal, row.rank, champion ? 24 : 18);
    game.ui.text(parent, String(row.rank), medalX, medalY + 1, champion ? 28 : 22, '#765133', 36);
    if (row.self) selfTag(game, parent, x + (champion ? 250 : 111), y + (champion ? 62 : 49));
}

function selfTag(game: View, parent: Node, x: number, y: number) {
    const badge = game.ui.graphics(parent, 'My ranking');
    game.ui.box(badge, x, y, 36, 30, 14, '#70B799');
    game.ui.text(parent, '我', x, y, 20, '#FFFFFF', 32);
}

function playerName(
    game: View,
    parent: Node,
    row: Player,
    x: number,
    y: number,
    width: number,
    size: number,
    leftAligned = false,
) {
    const label = game.ui.text(parent, '', x, y, size, row.self ? '#366650' : INK, width, true);
    label.node.name = 'Player nickname';
    label.isBold = true;
    label.horizontalAlign = leftAligned ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
    label.font = null;
    label.useSystemFont = true;
    const bounds = label.node.getComponent(UITransform)!;
    const measure = (text: string) => {
        label.string = text;
        label.overflow = Label.Overflow.NONE;
        label.updateRenderData(true);
        return bounds.width;
    };
    label.string = ellipsizeNickname(
        row.identity === null ? row.player : row.identity.nickname,
        width,
        measure,
    );
    label.overflow = Label.Overflow.CLAMP;
    label.enableWrapText = false;
    bounds.setContentSize(width, label.fontSize * 1.6);
    label.updateRenderData(true);
}

function playerAvatar(game: View, parent: Node, row: Player, x: number, y: number, size: number) {
    const avatar = game.ui.node2d('Player avatar', parent, x, y, size + 12, size + 12);
    const rim = game.ui.graphics(avatar, 'Avatar frame');
    const tone = row.rank <= 3 ? PODIUM[row.rank - 1] : null;
    rim.fillColor = color('#C9BBA1');
    rim.circle(0, -2, size / 2 + 5);
    rim.fill();
    rim.fillColor = color(tone ? tone.light : '#FFF9E6');
    rim.circle(0, 0, size / 2 + 4);
    rim.fill();
    rim.strokeColor = color(tone ? tone.edge : '#C7B793');
    rim.lineWidth = 1.5;
    rim.circle(0, 0, size / 2 + 3);
    rim.stroke();
    const clip = game.ui.node2d('Avatar clip', avatar, 0, 0, size, size);
    clip.addComponent(Mask).type = Mask.Type.GRAPHICS_ELLIPSE;
    const placeholder = game.ui.graphics(clip, 'Default avatar');
    placeholder.fillColor = color('#DCE6D5');
    placeholder.circle(0, 0, size / 2);
    placeholder.fill();
    placeholder.fillColor = color('#82967A');
    placeholder.circle(0, size * 0.13, size * 0.17);
    placeholder.fill();
    placeholder.roundRect(-size * 0.29, -size * 0.32, size * 0.58, size * 0.35, size * 0.16);
    placeholder.fill();
    const portrait = game.ui.node2d('Avatar image', clip, 0, 0, size, size);
    if (row.identity !== null) {
        assetManager.loadRemote<ImageAsset>(
            row.identity.avatarUrl,
            { ext: '.png' },
            (error, image) => {
                if (error || !avatar.isValid || !parent.isValid) return;
                image.addRef();
                const texture = new Texture2D();
                texture.image = image;
                const frame = new SpriteFrame();
                frame.texture = texture;
                const sprite = portrait.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = frame;
                placeholder.node.active = false;
                avatar.on(Node.EventType.NODE_DESTROYED, () => {
                    frame.destroy();
                    texture.destroy();
                    image.decRef();
                });
            },
        );
    }
    return avatar;
}
