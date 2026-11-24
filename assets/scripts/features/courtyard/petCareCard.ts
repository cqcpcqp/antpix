import { Node } from 'cc';
import type { petVitals } from '../../domain/profile/pets';
import { INK, PAPER, color } from '../../presentation/gameVisuals';
import { islandPanel } from '../../presentation/islandTheme';
import type { UiFactory } from '../ui/UiFactory';
import { petIcon } from './petIcons';

type Vitals = ReturnType<typeof petVitals>;

/** Anchored summary of the three care values and the existing rename action. */
export function petCareCard(
    ui: UiFactory,
    parent: Node,
    name: string,
    width: number,
    touchSize: number,
    rename: () => void,
    close: () => void,
) {
    const height = touchSize + 156;
    const root = ui.node2d('Resident care card', parent, 0, 0, width, height);
    islandPanel(ui.graphics(root, 'Card art'), 0, 0, width, height, '#FFF6D8');
    const headerY = height / 2 - touchSize / 2 - 6;
    ui.text(root, name, -touchSize * 0.4, headerY, 32, INK, width - touchSize * 2 - 24, true);
    const pencil = ui.node2d(
        'Resident rename',
        root,
        width / 2 - touchSize * 1.5,
        headerY,
        touchSize,
        touchSize,
    );
    const pencilArt = ui.graphics(pencil);
    islandPanel(pencilArt, 0, 0, 54, 54, PAPER);
    petIcon(pencilArt, 'pencil');
    pencil.on(Node.EventType.TOUCH_END, rename);
    const dismiss = ui.node2d(
        'Close resident care',
        root,
        width / 2 - touchSize / 2,
        headerY,
        touchSize,
        touchSize,
    );
    const cross = ui.graphics(dismiss);
    cross.strokeColor = color('#80603F');
    cross.lineWidth = 4;
    cross.moveTo(-8, -8);
    cross.lineTo(8, 8);
    cross.moveTo(-8, 8);
    cross.lineTo(8, -8);
    cross.stroke();
    dismiss.on(Node.EventType.TOUCH_END, close);

    const rows = [
        { key: 'health', text: '健康', tint: '#78A154' },
        { key: 'satiety', text: '饱食', tint: '#DA9B49' },
        { key: 'mood', text: '心情', tint: '#CF8581' },
    ] as const;
    const bars = rows.map(({ key, text, tint }, index) => {
        const y = headerY - touchSize / 2 - 17 - 45 * index;
        ui.text(root, text, -width / 2 + 53, y, 25, INK, 70, true);
        const label = ui.text(root, '', width / 2 - 42, y, 25, INK, 64, true);
        label.node.name = 'Resident ' + key;
        const bar = ui.graphics(root, 'Meter ' + key);
        const left = -width / 2 + 98;
        const track = width - 176;
        let previous = -1;
        return (values: Vitals) => {
            const value = Math.floor(values[key]);
            if (previous === value) return;
            previous = value;
            label.string = String(value);
            bar.clear();
            bar.fillColor = color('#EBDDBB');
            bar.roundRect(left, y - 6, track, 12, 6);
            bar.fill();
            if (value > 0) {
                bar.fillColor = color(tint);
                const filled = (value / 100) * track;
                bar.roundRect(left, y - 6, filled, 12, Math.min(6, filled / 2));
                bar.fill();
            }
        };
    });
    return {
        root,
        width,
        height,
        update(values: Vitals) {
            bars.forEach((draw) => draw(values));
        },
    };
}
