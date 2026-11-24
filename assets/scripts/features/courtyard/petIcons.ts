import type { Graphics } from 'cc';
import { color } from '../../presentation/gameVisuals';

export type PetIcon = 'hand' | 'bowl' | 'melon' | 'info' | 'pencil';

export function petIcon(art: Graphics, icon: PetIcon) {
    const shape = (fill: string, points: [number, number][]) => {
        art.fillColor = color(fill);
        points.forEach(([x, y], index) => {
            if (index === 0) art.moveTo(x, y);
            else art.lineTo(x, y);
        });
        art.close();
        art.fill();
    };
    if (icon === 'hand') {
        shape('#B87845', [
            [-15, 0],
            [-11, 4],
            [-6, 0],
            [-8, 14],
            [-4, 17],
            [0, 7],
            [1, 19],
            [6, 16],
            [6, 6],
            [11, 13],
            [15, 10],
            [11, 1],
            [16, 4],
            [18, 0],
            [8, -13],
            [-5, -14],
        ]);
        shape('#F6CA91', [
            [-12, 0],
            [-10, 2],
            [-4, -3],
            [-6, 14],
            [-4, 15],
            [1, 4],
            [3, 16],
            [5, 15],
            [4, 3],
            [11, 11],
            [12, 9],
            [8, -2],
            [15, 1],
            [15, -1],
            [7, -11],
            [-4, -12],
        ]);
    } else if (icon === 'bowl') {
        art.fillColor = color('#CD9A59');
        for (const [x, y] of [
            [-9, 5],
            [0, 9],
            [9, 5],
        ])
            art.circle(x, y, 5);
        art.fill();
        shape('#42866E', [
            [-18, 3],
            [18, 3],
            [12, -12],
            [-12, -12],
        ]);
        shape('#8FC9B2', [
            [-15, 0],
            [15, 0],
            [10, -9],
            [-10, -9],
        ]);
    } else if (icon === 'info') {
        art.fillColor = color('#4E6239');
        art.circle(0, 10, 3);
        art.roundRect(-2.5, -13, 5, 17, 2.5);
        art.fill();
    } else if (icon === 'pencil') {
        shape('#80603F', [
            [-11, -12],
            [-9, -4],
            [7, 12],
            [13, 6],
            [-3, -10],
        ]);
        shape('#F6CA91', [
            [-6, -4],
            [7, 9],
            [10, 6],
            [-3, -7],
        ]);
    } else if (icon === 'melon') {
        shape('#4F8F56', [
            [-20, 7],
            [20, 7],
            [13, -7],
            [0, -13],
            [-13, -7],
        ]);
        shape('#EF8674', [
            [-17, 7],
            [17, 7],
            [11, -4],
            [0, -9],
            [-11, -4],
        ]);
        art.fillColor = color('#624729');
        for (const x of [-7, 0, 7]) art.circle(x, x ? 3 : -1, 1.5);
        art.fill();
    }
}
