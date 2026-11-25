import type { Node } from 'cc';
import type { Label } from 'cc';
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
    private speech?: { node: Node; label: Label };

    reset() {
        this.entries = [];
        this.reaction = undefined;
        this.speech = undefined;
    }

    active(time: number) {
        return !!this.reaction && this.reaction.start + this.reaction.duration > time;
    }

    play(pose: ResidentPose, time: number, food?: PetFood) {
        if (this.active(time)) return 0;
        const duration = food ? MEAL_DURATION : pose === 'petHappy' ? 1.65 : 1.35;
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

    speak(ui: UiFactory, layer: Node, view: CourtyardResident, line: string, screenWidth: number) {
        if (!line || !view.canInteract) {
            if (this.speech) this.speech.node.active = false;
            return;
        }
        const width = Math.min(324, screenWidth - 30);
        if (!this.speech) {
            const node = ui.node2d('Resident speech', layer, 0, 0, width, 45);
            islandPanel(ui.graphics(node), 0, 0, width, 45, '#FFF6D8');
            const label = ui.text(node, line, 0, 0, 23, INK, width - 20);
            this.speech = { node, label };
        }
        const { node, label } = this.speech;
        const { x, y } = view.root.position;
        const limit = (screenWidth - width) / 2 - 8;
        node.setPosition(Math.max(-limit, Math.min(limit, x)), y + petLabelOffset(view));
        if (label.string !== line) label.string = line;
        node.active = true;
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
