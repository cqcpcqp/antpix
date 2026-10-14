import { Node, sys } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import { EXPANSION_COLUMNS } from '../../presentation/boardLayout';

/** Presents device preferences, controls and restart actions. */
export class SettingsScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'overlays' | 'ui' | 'lifecycle' | 'home' | 'profile' | 'audio' | 'session' | 'boosts'
        >,
    ) {}
    controlsSeen = false;

    controlsGuide(step = 0) {
        const titles = ['选择容器', '观察搬运', '长按找同色'];
        const lines = [
            ['点击上面一排容器，放入收集槽', '下面一排是预览，选走上方后会补位'],
            ['蚂蚁搬走能接触到的同色像素', '容器数字表示还没有派出的蚂蚁数量'],
            ['按住容器，查看画中剩余同色像素', '松手结束查看；滑动可以取消'],
        ];
        const n = this.game.overlays.openModal(titles[step], `操作说明 ${step + 1} / 3`, 500);
        this.game.ui.text(n, lines[step][0], 0, 35, 27, INK, 570);
        this.game.ui.text(n, lines[step][1], 0, -25, 25, MUTED, 570);
        this.game.ui.button(n, step < 2 ? '下一步' : '开始收集', 0, -155, 440, 72, GREEN, () => {
            if (step < 2) this.controlsGuide(step + 1);
            else {
                this.controlsSeen = true;
                try {
                    sys.localStorage.setItem('ant-controls-seen', '1');
                } catch {
                    // Local storage may be disabled; controls remain available for this session.
                }
                this.game.overlays.closeModal();
            }
        });
    }

    settings() {
        const gap = Math.max(110, this.game.lifecycle.touchSize + 12);
        const count = this.game.home.home ? 3 : 6;
        const height = 252 + gap * count + 86;
        const n = this.game.overlays.openDrawer('小窝设置', '', height);
        const top = height / 2 - 252;
        const music = this.game.ui.button(
            n,
            this.game.profile.save.music ? '音乐：开启' : '音乐：关闭',
            0,
            top,
            440,
            68,
            '#E8FAF5',
            () => {
                this.game.profile.save.music = !this.game.profile.save.music;
                this.game.profile.persist();
                this.game.audio.syncMusic();
                music.string = this.game.profile.save.music ? '音乐：开启' : '音乐：关闭';
            },
        );
        const sound = this.game.ui.button(
            n,
            this.game.profile.save.sound ? '音效：开启' : '音效：关闭',
            0,
            top - gap,
            440,
            68,
            '#E8FAF5',
            () => {
                this.game.profile.save.sound = !this.game.profile.save.sound;
                this.game.profile.persist();
                sound.string = this.game.profile.save.sound ? '音效：开启' : '音效：关闭';
            },
        );
        if (!this.game.home.home) {
            this.game.ui.button(n, '操作说明', 0, top - gap * 2, 440, 68, PAPER, () =>
                this.controlsGuide(),
            );
            this.game.ui.button(n, '重新开始', 0, top - gap * 3, 440, 68, PAPER, () =>
                this.restart(),
            );
            this.game.ui.button(n, '返回主页', 0, top - gap * 4, 440, 68, PAPER, () =>
                this.game.home.showHome(),
            );
        }
        this.game.ui.button(
            n,
            this.game.home.home ? '完成' : '继续游戏',
            0,
            top - gap * (this.game.home.home ? 2 : 5),
            440,
            72,
            PAPER,
            () => this.game.overlays.dismissOverlay(),
        );
        const credit = top - gap * (this.game.home.home ? 2 : 5) - gap;
        const credits = this.game.ui.node2d(
            'Music credits',
            n,
            0,
            credit,
            240,
            this.game.lifecycle.touchSize,
        );
        this.game.ui.text(credits, '音乐鸣谢 ›', 0, 0, 23, MUTED, 220);
        credits.on(Node.EventType.TOUCH_END, () => {
            this.game.audio.play('tap');
            this.musicCredits();
        });
    }

    musicCredits() {
        const n = this.game.overlays.openModal('音乐鸣谢', '背景音乐', 620);
        this.game.ui.text(n, 'Easy Lemon', 0, 112, 32, INK, 560);
        this.game.ui.text(n, 'Kevin MacLeod · incompetech.com', 0, 62, 23, MUTED, 560);
        this.game.ui.text(n, 'CC BY 4.0', 0, 0, 24, INK, 560);
        this.game.ui.text(n, 'creativecommons.org/licenses/by/4.0/', 0, -38, 20, MUTED, 560);
        this.game.ui.text(n, '节选、循环交叉淡化及柔化处理', 0, -100, 22, MUTED, 560);
        this.game.ui.button(n, '返回设置', 0, -211, 440, 72, PAPER, () => this.settings());
    }

    restart() {
        const n = this.game.overlays.openModal(
            '重新收集这一幅？',
            '本关将重新开始，已解锁关卡会保留',
            350,
        );
        this.game.ui.button(n, '继续游戏', -142, -73, 240, 66, '#E8FAF5', () =>
            this.game.overlays.closeModal(),
        );
        this.game.ui.button(
            n,
            '重新开始',
            142,
            -73,
            240,
            66,
            GREEN,
            () => this.game.session.startLevel(this.game.profile.save.selected),
            '#FFFFFF',
        );
    }

    showBlocked() {
        const n = this.game.overlays.openModal(
            '暂时无法继续收集',
            '槽位已满，容器颜色与当前可达的像素不匹配',
            560,
        );
        this.game.ui.text(
            n,
            this.game.session.model.slots.length < 5 + EXPANSION_COLUMNS.length
                ? '观看视频可增加一个槽位，本关生效'
                : '可以重新开始，或返回主页休息一下',
            0,
            -5,
            24,
        );
        this.game.ui.button(n, '重新开始', -142, -80, 240, 70, PAPER, () =>
            this.game.session.startLevel(this.game.profile.save.selected),
        );
        if (this.game.session.model.slots.length < 5 + EXPANSION_COLUMNS.length)
            this.game.ui.button(
                n,
                '解锁槽位',
                142,
                -80,
                240,
                70,
                GREEN,
                () => this.game.boosts.requestSlotExpansion(),
                '#FFFFFF',
            );
        this.game.ui.button(
            n,
            '返回主页',
            0,
            -80 - Math.max(110, this.game.lifecycle.touchSize + 4),
            480,
            70,
            PAPER,
            () => this.game.home.showHome(),
        );
    }
}
