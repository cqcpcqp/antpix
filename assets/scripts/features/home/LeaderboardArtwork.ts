import { Graphics, Node, Sprite } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import type { LeaderboardArt } from '../../presentation/leaderboardArt';
import { worldBoardFooter } from '../../presentation/leaderboardLayout';
import { INK, MUTED } from '../../presentation/gameVisuals';

type View = Pick<GardenRuntime, 'ui' | 'assets'>;

/** Artwork stays separate from live text/portraits; shared frames belong to LeaderboardAssets. */
export function leaderboardArtwork(
    game: View,
    parent: Node,
    key: LeaderboardArt,
    x: number,
    y: number,
    width: number,
    height: number,
    name: string = key,
    sliced = false,
) {
    const node = game.ui.node2d(name, parent, x, y, width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
    sprite.spriteFrame = game.assets.leaderboardFrames.get(key)!;
    return node;
}

/** Use the same artwork geometry while loading and after scope reconciliation. */
export function leaderboardChrome(
    game: View,
    parent: Node,
    touchSize: number,
    consent: boolean,
    back: () => void,
) {
    const layout = worldBoardFooter(touchSize, consent);
    const content = game.ui.node2d('Leaderboard content', parent);
    leaderboardArtwork(
        game,
        content,
        'panel',
        0,
        layout.panelY,
        700,
        layout.height,
        'Leaderboard panel',
        true,
    );
    game.ui.text(content, '世界排行榜', 0, 558, 40, INK, 450);
    game.ui.text(content, '通关数优先 · 同关先到者在前', 0, 505, 23, MUTED, 550);
    artworkButton(
        game,
        content,
        '返回',
        layout.returnX,
        layout.returnY,
        layout.returnWidth,
        back,
        true,
    );
    return { content, layout };
}

export function artworkButton(
    game: View,
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
    primary = false,
) {
    const label = game.ui.button(
        parent,
        text,
        x,
        y,
        width,
        primary ? 86 : 56,
        '#FFF9E9',
        action,
        INK,
    );
    const button = label.node.parent!;
    // Retain UiFactory's hit area and press/release behaviour, replacing only its visual face.
    if (primary) {
        button.getComponent(Graphics)!.clear();
        const art = leaderboardArtwork(
            game,
            button,
            'button',
            0,
            0,
            width + 18,
            100,
            'Button artwork',
            true,
        );
        art.setSiblingIndex(0);
    }
    label.fontSize = Math.max(label.fontSize, primary ? 32 : 24);
    return button;
}
