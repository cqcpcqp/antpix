import { Mask, Node, ScrollView, UITransform } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import type { WorldBoard } from '../../platform/wechat/cloudGame';
import { WORLD_BOARD, worldBoardContentHeight } from '../../presentation/leaderboardLayout';
import { worldPlayerView } from './WorldPlayerView';

type View = Pick<GardenRuntime, 'ui' | 'assets'>;

/** A clipped native Cocos scroller owns every row, including the podium and its remote portraits. */
export function leaderboardList(game: View, parent: Node, rows: WorldBoard['rows']) {
    const height = WORLD_BOARD.scrollTop - WORLD_BOARD.scrollBottom;
    const viewport = game.ui.node2d(
        'Leaderboard viewport',
        parent,
        0,
        (WORLD_BOARD.scrollTop + WORLD_BOARD.scrollBottom) / 2,
        WORLD_BOARD.scrollWidth,
        height,
    );
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const content = game.ui.node2d(
        'Leaderboard scroll content',
        viewport,
        0,
        height / 2,
        WORLD_BOARD.scrollWidth,
        worldBoardContentHeight(rows.length),
    );
    content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    // Player artwork uses board coordinates. Translate them from the content's top anchor.
    const players = game.ui.node2d('Leaderboard rows', content, 0, -WORLD_BOARD.scrollTop);
    rows.forEach((row) => worldPlayerView(game, players, row));
    const scroll = viewport.addComponent(ScrollView);
    scroll.content = content;
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.inertia = true;
    scroll.brake = 0.7;
    scroll.elastic = true;
    scroll.bounceDuration = 0.2;
    scroll.cancelInnerEvents = true;
    return scroll;
}
