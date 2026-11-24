import type { Node } from 'cc';
import { INK } from '../../presentation/gameVisuals';
import { islandPanel } from '../../presentation/islandTheme';
import type { UiFactory } from '../ui/UiFactory';
import type { CourtyardResident } from './courtyardResident';
import { MEAL_DURATION } from './residentMotion';
import type { PetFood, ResidentPose } from './residentMotion';

function petLabelOffset(view: CourtyardResident) {
    return Math.max(91, 65 * view.artScale + 26);
}

/** Keeps transient captions aligned with the moving resident that produced them. */
export class PetBubbles {
    private entries: { node: Node; view: CourtyardResident; until: number }[] = [];
    private reaction:
        { pose: ResidentPose; start: number; duration: number; food?: PetFood } | undefined;

    reset() {
        this.entries = [];
    }

    eating(time: number) {
        const reaction = this.reaction;
        return !!reaction?.food && reaction.start + reaction.duration > time;
    }

    play(pose: ResidentPose, time: number, food?: PetFood) {
        const previous = this.reaction;
        if (
            this.eating(time) ||
            (pose === 'pet' && previous && previous.start + previous.duration > time)
        )
            return 0;
        const duration = food ? MEAL_DURATION : 1.35;
        this.reaction = { pose, start: time, duration, food };
        return duration;
    }

    render(view: CourtyardResident, time: number) {
        const reaction = this.reaction;
        if (!reaction) return;
        const remaining = reaction.start + reaction.duration - time;
        if (remaining <= 0) this.reaction = undefined;
        else if (view.root.active)
            view.react(reaction.pose, remaining, reaction.duration, reaction.food);
    }

    show(ui: UiFactory, layer: Node, view: CourtyardResident, caption: string, until: number) {
        const width = Math.max(92, caption.length * 28 + 34);
        const { x, y } = view.root.position;
        const node = ui.node2d('Resident reaction', layer, x, y + petLabelOffset(view), width, 46);
        islandPanel(ui.graphics(node), 0, 0, width, 46, '#FFF6D8');
        ui.text(node, caption, 0, 0, 23, INK, width - 14);
        this.entries.push({ node, view, until });
    }

    update(time: number) {
        this.entries = this.entries.filter(({ node, view, until }) => {
            if (until <= time) {
                node.destroy();
                return false;
            }
            const { x, y } = view.root.position;
            node.active = view.canInteract;
            node.setPosition(x, y + petLabelOffset(view));
            return true;
        });
    }
}
