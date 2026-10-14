import type { GardenRuntime } from './GardenRuntime';

/** Orders frame updates and pauses simulation behind overlays. */
export class GameLoop {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'courtyard'
            | 'lifecycle'
            | 'overlays'
            | 'audio'
            | 'victory'
            | 'session'
            | 'home'
            | 'cloud'
            | 'flights'
            | 'preview'
            | 'queue'
            | 'motion'
            | 'layout'
            | 'dispatch'
            | 'settings'
        >,
    ) {}
    update(dt: number) {
        this.game.courtyard.updateCourtyard(dt);
        if (!this.game.lifecycle.paused) {
            this.game.overlays.updateOverlays(Math.min(dt, 0.05));
            if (this.game.audio.music.playing)
                this.game.audio.music.volume = Math.min(
                    0.22,
                    this.game.audio.music.volume + Math.min(dt, 0.05) * 0.18,
                );
        }
        if (this.game.victory.celebration) {
            if (!this.game.lifecycle.paused)
                this.game.victory.updateCelebration(Math.min(dt, 0.05));
            return;
        }
        if (
            !this.game.session.model ||
            this.game.lifecycle.paused ||
            this.game.overlays.modal ||
            this.game.home.home ||
            this.game.session.won ||
            this.game.cloud.cloudBusy
        )
            return;
        // Tests and level setup can replace the model without going through
        // enterLevel; keep the reusable clearance view aligned with it.
        if (this.game.flights.routeBoard.pixels !== this.game.session.model.pixels) {
            this.game.flights.routeBoard.width = this.game.session.model.level.width;
            this.game.flights.routeBoard.height = this.game.session.model.level.height;
            this.game.flights.routeBoard.pixels = this.game.session.model.pixels;
        }
        this.game.preview.updatePreview(dt);
        this.game.session.elapsed += dt;
        this.game.session.updateFinishing();
        dt = Math.min(dt, 0.05);
        this.game.queue.updateQueueMotion(dt);
        this.game.motion.updateContainerTransitions(dt);
        this.game.layout.dirtyRows.clear();
        this.game.dispatch.dispatchAnts(dt);
        this.game.motion.updateContainerLaunches(dt);
        this.game.flights.updateFlights(dt);
        if (!this.game.preview.hold?.shown && this.game.queue.fullFeedback <= 0) {
            const caption = this.game.queue.queueCaption();
            if (this.game.layout.queueCount.string !== caption)
                this.game.layout.queueCount.string = caption;
        }
        if (this.game.layout.dirtyRows.size) {
            this.game.layout.drawBoard(this.game.layout.dirtyRows);
            this.game.preview.drawPreview(this.game.layout.dirtyRows);
        }
        if (this.game.session.model.complete) this.game.victory.victory();
        else if (this.game.session.model.blocked) this.game.settings.showBlocked();
    }
}
