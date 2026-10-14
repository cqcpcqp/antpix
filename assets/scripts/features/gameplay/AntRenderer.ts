import { Graphics, Sprite, UITransform } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { ANT_LAUNCH_DURATION, color } from '../../presentation/gameVisuals';
import { PALETTE } from '../../domain/levels/levels';
import { samplePreparedRoute } from '../../domain/routing/routing';
import { CELL_SIZE } from '../../presentation/boardLayout';
import type { AntTrip, AntVisual } from '../../presentation/gameVisuals';

/** Owns pooled ant sprites and their per-frame visual pose. */
export class AntRenderer {
    constructor(private readonly game: Pick<GardenRuntime, 'ui' | 'layout' | 'assets'>) {}
    antPool: AntVisual[] = [];

    acquireAnt(c: number): AntVisual {
        let visual =
            this.antPool.find((v) => !v.node.active && v.color === c) ||
            this.antPool.find((v) => !v.node.active);
        if (!visual) {
            const node = this.game.ui.node2d('Ant worker', this.game.layout.effects.node);
            visual = {
                node,
                frames: [],
                cargo: this.game.ui.node2d('Carried pixel', node),
                color: -1,
                frame: 0,
                body: null,
                cargoSprite: null,
                bodyDetail: null,
                cargoDetail: null,
            };
            if (!this.game.assets.antFrames.length)
                for (let i = 0; i < 3; i++)
                    visual.frames.push(this.game.ui.node2d('Walk frame ' + i, node));
            visual.cargo.setSiblingIndex(3);
            this.antPool.push(visual);
        }
        if (visual.color !== c) {
            visual.color = c;
            if (this.game.assets.antFrames.length) this.useAntAtlas(visual);
            else {
                visual.frames.forEach((n, i) => {
                    const g = n.getComponent(Graphics) || n.addComponent(Graphics);
                    g.clear();
                    this.game.layout.drawAnt(g, 0, 0, 0, i * 0.084, 1, PALETTE[c]);
                });
                const cargo =
                    visual.cargo.getComponent(Graphics) || visual.cargo.addComponent(Graphics);
                cargo.clear();
                this.game.layout.boardPixel(cargo, -CELL_SIZE / 2, CELL_SIZE / 2, PALETTE[c]);
            }
        }
        visual.node.active = true;
        visual.cargo.active = false;
        visual.cargo.setPosition(CELL_SIZE, 0);
        visual.cargo.angle = 0;
        visual.frames.forEach((n, i) => (n.active = i === 0));
        visual.frame = 0;
        if (visual.body) {
            visual.body.spriteFrame = this.game.assets.antFrames[0];
            visual.bodyDetail!.spriteFrame = this.game.assets.antFrames[4];
        }
        return visual;
    }

    useAntAtlas(visual: AntVisual) {
        if (!visual.body) {
            for (const node of visual.frames) {
                node.active = false;
                node.destroy();
            }
            visual.frames.length = 0;
            const graphics = visual.cargo.getComponent(Graphics);
            if (graphics) {
                // Cocos only permits one UI renderer per node; destroy() is
                // deferred. Replace the node instead of attaching a Sprite to
                // a node that still owns its Graphics renderer this frame.
                const old = visual.cargo;
                visual.cargo = this.game.ui.node2d(
                    'Carried pixel',
                    visual.node,
                    old.position.x,
                    old.position.y,
                    32,
                    32,
                );
                visual.cargo.angle = old.angle;
                visual.cargo.active = old.active;
                old.active = false;
                old.destroy();
            }
            visual.body = this.game.ui
                .node2d('Ant sprite', visual.node, 0, 0, 32, 32)
                .addComponent(Sprite);
            visual.body.sizeMode = Sprite.SizeMode.CUSTOM;
            visual.body.node.setSiblingIndex(0);
            visual.cargo.getComponent(UITransform)!.setContentSize(32, 32);
            visual.cargoSprite = visual.cargo.addComponent(Sprite);
            visual.cargoSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            visual.bodyDetail = this.game.ui
                .node2d('Ant details', visual.body.node, 0, 0, 32, 32)
                .addComponent(Sprite);
            visual.bodyDetail.sizeMode = Sprite.SizeMode.CUSTOM;
            visual.cargoDetail = this.game.ui
                .node2d('Pixel details', visual.cargo, 0, 0, 32, 32)
                .addComponent(Sprite);
            visual.cargoDetail.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        visual.body.spriteFrame = this.game.assets.antFrames[visual.frame];
        visual.bodyDetail!.spriteFrame = this.game.assets.antFrames[4 + visual.frame];
        visual.cargoSprite!.spriteFrame = this.game.assets.antFrames[3];
        visual.cargoDetail!.spriteFrame = this.game.assets.antFrames[7];
        visual.body.color = color(PALETTE[visual.color]);
        visual.cargoSprite!.color = color(PALETTE[visual.color]);
    }

    releaseAnt(visual: AntVisual) {
        visual.node.active = false;
    }

    updateAntVisual(trip: AntTrip) {
        const pose = trip.pose;
        let scale = 1;
        if (trip.phase === 'launch') {
            const t = Math.min(
                1,
                Math.max(0, (trip.elapsed - 0.055) / (ANT_LAUNCH_DURATION - 0.055)),
            );
            const end = trip.path[0];
            const eased = 1 - (1 - t) * (1 - t);
            pose.x = trip.launchOrigin.x + (end.x - trip.launchOrigin.x) * eased;
            pose.y =
                trip.launchOrigin.y +
                (end.y - trip.launchOrigin.y) * eased +
                Math.sin(t * Math.PI) * 9;
            pose.angle = Math.PI / 2;
            scale = t;
        } else if (trip.phase === 'grasp') {
            const t = Math.min(1, Math.max(0, (trip.elapsed - 0.1) / 0.25));
            pose.x = trip.path[0].x;
            pose.y = trip.path[0].y;
            pose.angle = trip.gripAngle + trip.gripTurn * t * t * (3 - 2 * t);
        } else if (trip.phase === 'enter') {
            samplePreparedRoute(trip.route, trip.distance, pose);
            scale = 1 - trip.elapsed / 0.35;
        } else {
            samplePreparedRoute(
                trip.route,
                trip.distance *
                    Math.min(
                        1,
                        trip.elapsed /
                            Math.max(0.8, trip.distance / (trip.phase === 'return' ? 160 : 210)),
                    ),
                pose,
            );
        }
        const visual = trip.visual;
        // Cocos invalidates child transforms even when setters receive an
        // unchanged value. Straight walking needs position updates only.
        const position = visual.node.position,
            scaling = visual.node.scale,
            angle = (pose.angle * 180) / Math.PI;
        if (position.x !== pose.x || position.y !== pose.y) visual.node.setPosition(pose.x, pose.y);
        if (visual.node.angle !== angle) visual.node.angle = angle;
        if (scaling.x !== scale || scaling.y !== scale || scaling.z !== 1)
            visual.node.setScale(scale, scale, 1);
        if (visual.cargo.active !== trip.lifted) visual.cargo.active = trip.lifted;
        // Keep the lifted cell upright with the same upper-left light, while
        // its center follows the rotating mandibles through the turn.
        if (trip.lifted && visual.cargo.angle !== -visual.node.angle)
            visual.cargo.angle = -visual.node.angle;
        const frame =
            trip.phase === 'grasp' || trip.phase === 'enter'
                ? 0
                : Math.floor(trip.elapsed * 12) % 3;
        if (visual.frame !== frame) {
            if (visual.body) {
                visual.body.spriteFrame = this.game.assets.antFrames[frame];
                visual.bodyDetail!.spriteFrame = this.game.assets.antFrames[4 + frame];
            } else {
                visual.frames[visual.frame].active = false;
                visual.frames[frame].active = true;
            }
            visual.frame = frame;
        }
    }
}
