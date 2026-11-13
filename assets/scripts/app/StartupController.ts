import { resources } from 'cc';
import type { Asset, Constructor } from 'cc';
import type { GardenRuntime } from './GardenRuntime';
import { STARTUP } from '../presentation/startupLayout';

type StartupTask = { done: boolean; failed: boolean; run: () => void };

/** Waits for applied resources and either cloud login or an isolated local session. */
export class StartupController {
    constructor(
        private readonly game: Pick<GardenRuntime, 'host' | 'startupView' | 'home' | 'cloud'>,
    ) {}
    active = false;
    progress = STARTUP.engineProgress;
    private sealed = false;
    private tasks: StartupTask[] = [];
    private readyTime = 0;

    begin() {
        this.active = true;
        this.game.startupView.show(() => this.retry());
        this.refresh();
    }

    load<T extends Asset>(
        path: string,
        type: Constructor<T>,
        apply: (error: Error | null, asset: T) => void,
    ) {
        const task: StartupTask = {
            done: false,
            failed: false,
            run: () => {
                task.failed = false;
                resources.load(path, type, (error, asset) => {
                    if (!this.game.host.isValid) return;
                    task.failed = !!error;
                    apply(error, asset);
                    task.done = !error;
                    this.refresh();
                });
            },
        };
        this.tasks.push(task);
        task.run();
    }

    seal() {
        // Register the whole startup workload before considering synchronous cache hits ready.
        this.sealed = true;
        this.refresh();
    }

    refresh() {
        if (!this.active) return;
        const loaded = this.tasks.filter((task) => task.done).length;
        const assetsReady = this.sealed && loaded === this.tasks.length;
        const cloudReady = !this.game.cloud.cloudMode || this.game.cloud.cloudReady;
        const ready = assetsReady && cloudReady;
        const resourceProgress = this.tasks.length ? loaded / this.tasks.length : 0;
        const progress = !this.sealed
            ? STARTUP.engineProgress
            : ready
              ? 100
              : Math.min(
                    99,
                    STARTUP.engineProgress +
                        STARTUP.resourceWeight * resourceProgress +
                        (cloudReady ? 10 : 0),
                );
        this.progress = Math.max(this.progress, progress);
        const message = this.tasks.some((task) => task.failed)
            ? STARTUP.resourceError
            : this.game.cloud.cloudRetry
              ? this.game.cloud.cloudMessage
              : ready
                ? STARTUP.ready
                : assetsReady
                  ? STARTUP.syncing
                  : STARTUP.loading;
        this.game.startupView.refresh(this.progress, message);
    }

    retry() {
        if (!this.active) return;
        for (const task of this.tasks) if (task.failed) task.run();
        this.game.cloud.cloudRetry?.();
        this.refresh();
    }

    update(dt: number) {
        if (!this.active || this.progress < 100) return;
        // Leave a rendered completion frame before revealing the fully populated homepage.
        this.readyTime += Math.min(dt, 0.05);
        if (this.readyTime < 0.15) return;
        this.active = false;
        this.game.startupView.close();
        this.game.home.showHome(true);
    }

    destroy() {
        this.active = false;
        this.tasks = [];
        this.game.startupView.close();
    }
}
