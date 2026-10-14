import type { GardenRuntime } from '../../app/GardenRuntime';
import { GardenModel } from '../../domain/game/model';
import { LEVEL_COUNT, makeLevel } from '../../domain/levels/levels';

/** Owns level state and transition from home to active play. */
export class LevelSession {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'cloud'
            | 'profile'
            | 'notices'
            | 'preview'
            | 'overlays'
            | 'home'
            | 'layout'
            | 'flights'
            | 'ants'
            | 'dispatch'
            | 'boosts'
            | 'containers'
            | 'queue'
            | 'settings'
        >,
    ) {}
    model!: GardenModel;

    startLevel(index: number) {
        if (this.game.cloud.cloudMode) {
            if (!this.game.cloud.cloudReady) return;
            this.game.cloud.cloudTask(
                () => this.game.cloud.cloud!.mutate('start', { level: index }),
                (state) => {
                    this.game.cloud.applyCloudState(state);
                    this.game.cloud.cloudRunId = state.output.runId!;
                    this.enterLevel(index);
                },
                '正在准备关卡…',
            );
            return;
        }
        this.enterLevel(index);
    }

    enterLevel(index: number) {
        this.pendingVictory = false;
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= LEVEL_COUNT ||
            index > this.game.profile.save.unlocked
        ) {
            this.game.notices.notify('关卡未解锁', '前一关完成后才能挑战', 'info');
            return;
        }
        this.game.preview.clearPreview();
        this.game.overlays.closeModal();
        this.game.home.hideHome();
        this.game.profile.save.selected = index;
        this.game.layout.levelLabel.string = `第 ${index + 1} 关`;
        this.game.profile.persist();
        this.model = new GardenModel(makeLevel(index));
        this.game.flights.routeBoard.width = this.model.level.width;
        this.game.flights.routeBoard.height = this.model.level.height;
        this.game.flights.routeBoard.pixels = this.model.pixels;
        for (const trip of this.game.flights.flights) this.game.ants.releaseAnt(trip.visual);
        this.game.flights.flights = [];
        this.game.dispatch.dispatchClocks.fill(0);
        this.game.dispatch.dispatchJarIds.fill(-1);
        this.elapsed = 0;
        this.won = false;
        this.speed = 1;
        this.speedUnlocked = false;
        this.finishing = false;
        this.game.layout.speedLabel.string = '1×';
        this.game.layout.speedLabel.node.setPosition(-13, 1);
        this.game.layout.speedVideo.active = true;
        this.game.boosts.updateExpansionBoard();
        this.game.layout.effects.clear();
        this.game.layout.drawBoard();
        this.game.containers.slotViews.forEach((v) => {
            v.id = -2;
            v.launchElapsed = -1;
            v.entryElapsed = -1;
            v.exitElapsed = -1;
            v.exit.active = false;
            v.opacity.opacity = 255;
            v.container.angle = 0;
            v.container.setPosition(0, 0);
            v.container.setScale(1, 1, 1);
        });
        this.game.queue.cardViews.forEach((v) => {
            v.id = -1;
            v.node.active = false;
        });
        this.game.containers.drawSlots();
        this.game.queue.drawQueue();
        if (!this.game.settings.controlsSeen) this.game.settings.controlsGuide();
    }

    speed = 1;

    speedUnlocked = false;

    finishing = false;

    get effectiveSpeed() {
        return this.finishing ? 4 : this.speed;
    }

    elapsed = 0;

    won = false;

    pendingVictory = false;

    updateFinishing() {
        const finishing = this.model.finishing;
        if (finishing === this.finishing) return;
        this.finishing = finishing;
        this.game.layout.speedLabel.string = `${this.effectiveSpeed}×`;
        this.game.layout.speedLabel.node.setPosition(finishing ? 0 : -13, 1);
        this.game.layout.speedVideo.active = !finishing;
    }
}
