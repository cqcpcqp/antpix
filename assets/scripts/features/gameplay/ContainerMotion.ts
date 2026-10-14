import { Node, UIOpacity } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { ENTRY_POSES, EXIT_POSES, LAUNCH_DURATION } from '../../presentation/gameVisuals';
import type { Jar } from '../../domain/game/model';
import type { ContainerPose, SlotView } from '../../presentation/gameVisuals';

/** Applies entry, selection, exit and launch animation poses. */
export class ContainerMotion {
    constructor(private readonly game: Pick<GardenRuntime, 'containers' | 'session'>) {}
    applyContainerPose(
        node: Node,
        opacity: UIOpacity | null,
        progress: number,
        poses: readonly ContainerPose[],
    ) {
        const at = Math.min(1, Math.max(0, progress)) * (poses.length - 1);
        const index = Math.min(poses.length - 2, Math.floor(at));
        const t = 1 - Math.pow(1 - (at - index), 2);
        const a = poses[index],
            b = poses[index + 1];
        const value = (i: number) => a[i] + (b[i] - a[i]) * t;
        node.setPosition(value(0), value(1));
        node.angle = value(2);
        node.setScale(value(3), value(4), 1);
        if (opacity) opacity.opacity = Math.round(value(5));
    }

    startContainerExit(view: SlotView, jar: Jar) {
        // A separate, numberless visual never owns the slot or intercepts touches.
        // It can finish while a new container is already entering the same slot.
        view.exitBody.clear();
        view.exitSprite.spriteFrame = view.sprite.spriteFrame;
        view.exitSprite.node.active = view.sprite.node.active;
        if (view.exitSprite.node.active)
            this.game.containers.applyContainerMaterial(view.exitSprite, jar.color);
        if (!view.exitSprite.node.active)
            this.game.containers.jar(view.exitBody, jar, 0, 0, 92, 70);
        view.exitElapsed = 0;
        view.exit.active = true;
        this.applyContainerPose(view.exit, view.exitOpacity, 0, EXIT_POSES);
    }

    updateContainerTransitions(dt: number) {
        for (const view of this.game.containers.slotViews) {
            if (view.entryElapsed >= 0) {
                view.entryElapsed += dt;
                this.applyContainerPose(
                    view.container,
                    view.opacity,
                    view.entryElapsed / 0.4,
                    ENTRY_POSES,
                );
                if (view.entryElapsed >= 0.4) view.entryElapsed = -1;
            }
            if (view.exitElapsed >= 0) {
                view.exitElapsed += dt;
                this.applyContainerPose(
                    view.exit,
                    view.exitOpacity,
                    view.exitElapsed / 0.22,
                    EXIT_POSES,
                );
                if (view.exitElapsed >= 0.22) {
                    view.exitElapsed = -1;
                    view.exit.active = false;
                }
            }
        }
    }

    updateContainerLaunches(dt: number) {
        for (const view of this.game.containers.slotViews) {
            if (view.launchElapsed < 0) continue;
            view.launchElapsed += dt * this.game.session.effectiveSpeed;
            const t = view.launchElapsed;
            let stretch = 0;
            if (t < 0.055) stretch = -0.13 * Math.sin(((t / 0.055) * Math.PI) / 2);
            else if (t < 0.13)
                stretch = -0.13 + 0.28 * Math.sin((((t - 0.055) / 0.075) * Math.PI) / 2);
            else if (t < LAUNCH_DURATION)
                stretch = 0.15 * Math.cos((((t - 0.13) / (LAUNCH_DURATION - 0.13)) * Math.PI) / 2);
            view.container.setScale(1 - stretch * 0.65, 1 + stretch, 1);
            // Anchor the base while the rim squashes then springs upward.
            view.container.setPosition(0, stretch * 35);
            if (t >= LAUNCH_DURATION) {
                view.launchElapsed = -1;
                view.container.setPosition(0, 0);
                view.container.setScale(1, 1, 1);
                this.game.containers.drawSlots();
            }
        }
    }
}
