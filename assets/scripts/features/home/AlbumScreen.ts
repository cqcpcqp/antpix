import type { GardenRuntime } from '../../app/GardenRuntime';
import { GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import { LEVEL_COUNT } from '../../domain/levels/levels';

/** Selects unlocked artwork without changing game rules. */
export class AlbumScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'profile' | 'lifecycle' | 'overlays' | 'ui' | 'notices' | 'session'
        >,
    ) {}
    levelPicker(page = Math.floor(this.game.profile.save.selected / 10)) {
        const pageCount = Math.ceil(LEVEL_COUNT / 10);
        page = Math.max(0, Math.min(page, pageCount - 1));
        const gap = Math.max(100, this.game.lifecycle.touchSize + 4),
            height = 840 + 7 * (gap - 100);
        const top = height / 2 - 180;
        const n = this.game.overlays.openModal(
            '选择关卡',
            `第 ${page + 1} / ${pageCount} 页 · 已通关关卡可再次挑战`,
            height,
        );
        const start = page * 10;
        for (let i = start; i < Math.min(start + 10, LEVEL_COUNT); i++) {
            const local = i - start;
            const column = local % 2,
                row = Math.floor(local / 2),
                x = column ? 155 : -155,
                y = top - row * gap;
            const unlocked = i <= this.game.profile.save.unlocked,
                completed = this.game.profile.save.completed.includes(i);
            const label = completed
                ? `第 ${i + 1} 关 · 已通关`
                : unlocked
                  ? `第 ${i + 1} 关 · 可挑战`
                  : `第 ${i + 1} 关 · 未解锁`;
            this.game.ui.button(
                n,
                label,
                x,
                y,
                286,
                78,
                unlocked ? (completed ? '#E8FAF5' : '#FFF8E8') : '#EEEDE6',
                unlocked
                    ? () => this.confirmLevel(i, page)
                    : () => this.game.notices.notify('关卡未解锁', '前一关完成后才能挑战', 'info'),
                unlocked ? INK : MUTED,
            );
        }
        if (page > 0)
            this.game.ui.button(n, '上一页', -155, top - 5 * gap, 260, 62, PAPER, () =>
                this.levelPicker(page - 1),
            );
        if (page + 1 < pageCount)
            this.game.ui.button(n, '下一页', 155, top - 5 * gap, 260, 62, PAPER, () =>
                this.levelPicker(page + 1),
            );
        this.game.ui.button(
            n,
            '返回',
            0,
            top - 6 * gap,
            500,
            68,
            GREEN,
            () => this.game.overlays.closeModal(),
            '#FFFFFF',
        );
    }

    confirmLevel(index: number, page = Math.floor(index / 10)) {
        if (
            this.game.session.model &&
            !this.game.session.won &&
            this.game.session.model.moves > 0
        ) {
            const n = this.game.overlays.openModal(
                '开始新的挑战？',
                '当前关卡将重新开始，已获得的收藏保留',
                350,
            );
            this.game.ui.button(n, '选择关卡', -142, -74, 240, 65, PAPER, () =>
                this.levelPicker(page),
            );
            this.game.ui.button(
                n,
                '开始挑战',
                142,
                -74,
                240,
                65,
                GREEN,
                () => this.game.session.startLevel(index),
                '#FFFFFF',
            );
        } else this.game.session.startLevel(index);
    }
}
