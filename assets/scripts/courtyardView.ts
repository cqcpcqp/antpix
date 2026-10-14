import { Node, Sprite, SpriteFrame, UITransform, Label, Layers } from 'cc';
import { COURTYARD_SLOTS, FURNISHINGS } from './profile';
import type { Courtyard, CourtyardSlot, Furnishing, Profile } from './profile';

export const SLOT_NAMES: Record<CourtyardSlot, string> = {
    entrance: '门廊',
    path: '小路',
    garden: '花园',
    living: '生活角',
};
// Positions share the 1024 × 1536 background coordinate system.
const PLACEMENTS: Record<CourtyardSlot, readonly [number, number, number, number]> = {
    entrance: [512, 604, 330, 265],
    path: [505, 844, 245, 150],
    garden: [290, 736, 220, 200],
    living: [735, 747, 230, 190],
};

export function courtyardPreviewOffset(
    slot: CourtyardSlot,
    width: number,
    height: number,
    drawerHeight: number,
) {
    const [, y, , itemHeight] = PLACEMENTS[slot];
    const scale = Math.max(width / 1024, height / 1536);
    const bottom = (768 - y - itemHeight / 2) * scale;
    const drawerTop = -height / 2 + drawerHeight + 90;
    return Math.max(290, drawerTop + 28 - bottom);
}

export function renderCourtyard(
    parent: Node,
    state: Courtyard,
    frames: ReadonlyMap<string, SpriteFrame>,
    width: number,
    height: number,
    preview?: Furnishing,
): Node {
    const root = new Node('Courtyard furnishings');
    root.layer = Layers.Enum.UI_2D;
    root.parent = parent;
    root.addComponent(UITransform);
    const scale = Math.max(width / 1024, height / 1536);
    for (const slot of ['path', 'entrance', 'garden', 'living'] as CourtyardSlot[]) {
        const id = preview?.slot === slot ? preview.id : state.equipped[slot];
        if (!id) continue;
        const [x, y, w, h] = PLACEMENTS[slot];
        const node = new Node('Furnishing ' + id);
        node.layer = Layers.Enum.UI_2D;
        node.parent = root;
        node.setPosition((x - 512) * scale, (768 - y) * scale);
        node.addComponent(UITransform).setContentSize(w * scale, h * scale);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frames.get(id) ?? null;
    }
    return root;
}

export interface CourtyardControls {
    text(
        parent: Node,
        value: string,
        x: number,
        y: number,
        size: number,
        ink: string,
        width: number,
    ): Label;
    button(
        parent: Node,
        value: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fill: string,
        action: () => void,
        ink?: string,
    ): Label;
}
export interface CourtyardActions {
    select(slot: CourtyardSlot, item?: string): void;
    purchase(item: Furnishing): void;
    clear(slot: CourtyardSlot): void;
    nests(): void;
}

export function courtyardShopLayout(touchSize: number) {
    const actionGap = Math.max(100, touchSize + 12);
    const rowGap = Math.max(108, touchSize + 12);
    const detailsGap = Math.max(72, touchSize) / 2 + 62 + Math.max(98, touchSize) / 2;
    const height = 252 + actionGap + rowGap * 2 + detailsGap + actionGap + 86;
    const tabs = height / 2 - 252;
    const firstRow = tabs - actionGap;
    const purchase = firstRow - rowGap * 2 - detailsGap;
    return {
        height,
        tabs,
        firstRow,
        rowGap,
        purchase,
        description: purchase + Math.max(72, touchSize) / 2 + 30,
        footer: purchase - actionGap,
    };
}

export function renderCourtyardShop(
    parent: Node,
    profile: Profile,
    slot: CourtyardSlot,
    selected: Furnishing,
    frames: ReadonlyMap<string, SpriteFrame>,
    ui: CourtyardControls,
    actions: CourtyardActions,
    touchSize = 88,
) {
    const ink = '#55432C',
        muted = '#7C6C55',
        green = '#78CFB3';
    const layout = courtyardShopLayout(touchSize);
    COURTYARD_SLOTS.forEach((category, index) => {
        ui.button(
            parent,
            SLOT_NAMES[category],
            -240 + index * 160,
            layout.tabs,
            148,
            66,
            category === slot ? green : '#FFF9E9',
            () => actions.select(category),
        );
    });
    FURNISHINGS.filter((item) => item.slot === slot).forEach((item, index) => {
        const y = layout.firstRow - index * layout.rowGap;
        const owned = profile.courtyard.owned.includes(item.id);
        const equipped = profile.courtyard.equipped[slot] === item.id;
        const active = item.id === selected.id;
        const label = ui.button(parent, '', 0, y, 620, 98, active ? '#DEF2DF' : '#FFF9E9', () =>
            actions.select(slot, item.id),
        );
        const row = label.node.parent!;
        const sample = new Node('Furnishing thumbnail ' + item.id);
        sample.layer = Layers.Enum.UI_2D;
        sample.parent = row;
        sample.setPosition(-239, 0);
        sample.addComponent(UITransform).setContentSize(88, 80);
        const sprite = sample.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frames.get(item.id) ?? null;
        ui.text(row, item.name, -40, 19, 26, ink, 270);
        ui.text(
            row,
            equipped ? '已布置' : owned ? '已拥有' : `${item.price} 金币`,
            -40,
            -18,
            22,
            muted,
            270,
        );
        ui.text(row, active ? '预览中' : '看效果', 224, 0, 23, active ? '#287657' : muted, 125);
    });
    const owned = profile.courtyard.owned.includes(selected.id);
    const equipped = profile.courtyard.equipped[slot] === selected.id;
    const missing = Math.max(0, selected.price - profile.coins);
    ui.text(parent, selected.description, 0, layout.description, 26, muted, 600);
    ui.button(
        parent,
        equipped
            ? '已布置在庭院'
            : owned
              ? '布置到庭院'
              : missing
                ? `还差 ${missing} 金币`
                : `购买并布置 · ${selected.price} 金币`,
        0,
        layout.purchase,
        620,
        72,
        equipped || (!owned && missing) ? '#E8E3D3' : green,
        () => {
            if (!equipped) actions.purchase(selected);
        },
        ink,
    );
    ui.button(parent, `收起${SLOT_NAMES[slot]}`, -165, layout.footer, 290, 62, '#FFF9E9', () =>
        actions.clear(slot),
    );
    ui.button(parent, '局内洞口装扮', 165, layout.footer, 290, 62, '#FFF9E9', actions.nests);
}
