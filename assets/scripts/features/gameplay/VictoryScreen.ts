import { Graphics, Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, GREEN, PAPER } from '../../presentation/gameVisuals';
import { LEVEL_COUNT, PALETTE } from '../../domain/levels/levels';
import { recordWin } from '../../domain/profile/profile';
import type { Celebration } from '../../presentation/gameVisuals';

/** Records completion and owns the artwork celebration. */
export class VictoryScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'cloud'
            | 'session'
            | 'home'
            | 'overlays'
            | 'profile'
            | 'layout'
            | 'audio'
            | 'ui'
            | 'lifecycle'
            | 'album'
        >,
    ) {}
    celebration: Celebration | null = null;

    victory() {
        if (this.game.cloud.cloudBusy) return;
        this.game.session.won = true;
        if (this.game.cloud.cloudMode) {
            const values = {
                runId: this.game.cloud.cloudRunId,
                seconds: Math.max(0.01, this.game.session.elapsed),
                moves: this.game.session.model.moves,
            };
            this.game.cloud.cloudTask(
                () => this.game.cloud.cloud!.mutate('complete', values),
                (state) => {
                    this.game.cloud.applyCloudState(state);
                    if (this.game.home.home) this.game.home.showHome(true);
                    else if (!this.game.overlays.modal) this.showVictory();
                    else this.game.session.pendingVictory = true;
                },
                '正在保存通关…',
            );
            return;
        }
        recordWin(
            this.game.profile.save,
            {
                level: this.game.profile.save.selected,
                seconds: Math.max(0.01, this.game.session.elapsed),
                moves: this.game.session.model.moves,
            },
            LEVEL_COUNT,
        );
        this.game.profile.persist();
        this.showVictory();
    }

    showVictory() {
        this.game.session.won = true;
        this.game.layout.effects.clear();
        this.game.audio.play('win');
        const index = this.game.profile.save.selected;
        const n = this.game.overlays.openModal(
            '这一关完成了',
            this.game.session.model.level.name,
            1100,
        );
        const album = this.game.ui.node2d('Album pocket', n, 0, 100, 330, 440);
        const pocket = album.addComponent(Graphics);
        this.game.ui.box(pocket, 0, -5, 330, 440, 24, '#C6D3B8');
        this.game.ui.box(pocket, 0, 0, 330, 440, 24, '#E6EDDB');
        this.game.ui.box(pocket, 0, 20, 306, 382, 12, PAPER);
        this.game.ui.text(album, '通关完成', 0, -196, 24, '#366650', 180);
        album.active = false;
        const art = this.game.ui.node2d('Restored artwork', n, 0, 140, 400, 500),
            rows: Node[] = [];
        const level = this.game.session.model.level,
            step = 400 / level.width;
        // Draw each strip once; the reveal animates only row node transforms.
        for (let row = 0; row < level.height; row++) {
            const strip = this.game.ui.node2d('Restored row ' + row, art),
                g = strip.addComponent(Graphics);
            for (let col = 0; col < level.width; col++) {
                g.fillColor = color(PALETTE[level.pixels[row * level.width + col]]);
                g.rect(-200 + col * step, -step, step + 0.1, step + 0.1);
                g.fill();
            }
            strip.active = false;
            rows.push(strip);
        }
        const status = this.game.ui.text(
            n,
            '小蚂蚁带回的颜色，正在拼回这幅画',
            0,
            -275,
            25,
            '#366650',
            560,
        );
        const actions = this.game.ui.node2d('Collection actions', n);
        if (!this.game.profile.save.claimed.includes(index))
            this.game.ui.text(
                actions,
                '首通奖励 +100 金币 · 主页领取',
                0,
                -277,
                24,
                '#86602E',
                550,
            );
        this.game.ui.button(
            actions,
            index < LEVEL_COUNT - 1 ? '下一关' : '完成全部关卡',
            0,
            -345,
            480,
            72,
            GREEN,
            () => {
                if (index < LEVEL_COUNT - 1) this.game.session.startLevel(index + 1);
                else this.game.home.showHome();
            },
            '#FFFFFF',
        );
        this.game.ui.button(
            actions,
            '换一关',
            0,
            -345 - Math.max(110, this.game.lifecycle.touchSize + 4),
            480,
            62,
            '#E8FAF5',
            () => {
                this.game.home.showHome();
                this.game.album.levelPicker();
            },
        );
        actions.active = false;
        const skip = this.game.ui.button(n, '跳过动画', 0, -442, 260, 56, '#E8FAF5', () =>
            this.finishCelebration(),
        ).node.parent!;
        this.celebration = { elapsed: 0, art, rows, album, actions, status, skip };
        this.updateCelebration(0);
    }

    updateCelebration(dt: number) {
        const c = this.celebration;
        if (!c) return;
        c.elapsed += dt;
        const step = 400 / this.game.session.model.level.width;
        if (c.elapsed < 2.25) {
            c.rows.forEach((row, i) => {
                const t = Math.min(
                    1,
                    Math.max(0, (c.elapsed - (c.rows.length - 1 - i) * 0.018) / 0.7),
                );
                row.active = t > 0;
                const ease = 1 - Math.pow(1 - t, 3);
                row.setPosition(
                    Math.sin(i * 2.4) * 110 * (1 - ease),
                    (250 - i * step) * ease - 320 * (1 - ease),
                );
                row.setScale(0.55 + 0.45 * ease, 0.55 + 0.45 * ease, 1);
            });
            if (c.elapsed >= 1.65) c.status.string = '每一颗颜色，都回到了画里';
        } else {
            const t = Math.min(1, (c.elapsed - 2.25) / 0.7),
                ease = t * t * (3 - 2 * t);
            c.album.active = true;
            c.art.setPosition(0, 140 - 20 * ease);
            c.art.setScale(1 - 0.28 * ease, 1 - 0.28 * ease, 1);
            c.status.string = '正在整理通关完成…';
            if (t >= 1) this.finishCelebration();
        }
    }

    finishCelebration() {
        const c = this.celebration;
        if (!c) return;
        const step = 400 / this.game.session.model.level.width;
        c.rows.forEach((row, i) => {
            row.active = true;
            row.setPosition(0, 250 - i * step);
            row.setScale(1, 1, 1);
        });
        c.art.setPosition(0, 120);
        c.art.setScale(0.72, 0.72, 1);
        c.status.node.setPosition(0, -180);
        c.actions.setPosition(0, 35);
        c.album.active = true;
        c.actions.active = true;
        c.skip.active = false;
        c.status.string = `第 ${this.game.profile.save.selected + 1} 关已完成`;
        // The win was persisted before animation: skipping/backgrounding cannot lose it.
        this.celebration = null;
    }
}
