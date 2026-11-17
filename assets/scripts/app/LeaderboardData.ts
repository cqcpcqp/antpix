import type { GardenRuntime } from './GardenRuntime';
import type { WorldBoard } from '../platform/wechat/cloudGame';

type Session = GardenRuntime['cloud']['cloud'];
type Snapshot = {
    cloud: Session;
    revision: number;
    highest: number;
    reachedAt: number;
};

/** Retains successful reads for 30 seconds; identity, score and session changes invalidate them. */
export class LeaderboardData {
    constructor(
        private readonly game: Pick<GardenRuntime, 'cloud' | 'identity' | 'host'>,
        private readonly now: () => number = Date.now,
    ) {}
    private entry: { key: Snapshot; board: WorldBoard; expires: number } | null = null;

    private snapshot(): Snapshot {
        return {
            cloud: this.game.cloud.cloud,
            revision: this.game.identity.revision,
            highest: this.game.cloud.cloudHighest,
            reachedAt: this.game.cloud.cloudReachedAt,
        };
    }
    private current(key: Snapshot) {
        const now = this.snapshot();
        return (
            key.cloud === now.cloud &&
            key.revision === now.revision &&
            key.highest === now.highest &&
            key.reachedAt === now.reachedAt
        );
    }
    cached(): WorldBoard | null {
        const entry = this.entry;
        return entry && entry.expires > this.now() && this.current(entry.key) ? entry.board : null;
    }
    async load(): Promise<WorldBoard> {
        const key = this.snapshot();
        const board = await key.cloud!.leaderboardAll();
        if (this.game.host.isValid && this.current(key))
            this.entry = { key, board, expires: this.now() + 30_000 };
        return board;
    }
}
