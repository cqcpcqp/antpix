import { Node, Sprite } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { CourtyardColony } from '../../domain/courtyard/courtyardColony';
import type { Furnishing } from '../../domain/profile/profile';
import { CourtyardAtmosphere } from './courtyardAtmosphere';
import { CourtyardResident } from './courtyardResident';
import { courtyardPreviewOffset, courtyardShopLayout, renderCourtyard } from './courtyardView';

/** Owns courtyard residents, previews and rendering. */
export class CourtyardController {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'home' | 'profile' | 'assets' | 'lifecycle' | 'ui' | 'overlays'
        >,
    ) {}
    refreshCourtyard() {
        if (!this.game.home.home) return;
        if (this.courtyardNode) {
            this.courtyardNode.active = false;
            this.courtyardNode.destroy();
        }
        this.courtyardNode = renderCourtyard(
            this.game.home.home,
            this.game.profile.save.courtyard,
            this.game.assets.furnishingFrames,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
            this.courtyardPreview,
        );
        this.courtyardNode.setSiblingIndex(2);
        this.courtyardDrawOrder = '';
        const scale = Math.max(
            this.game.lifecycle.screenWidth / 1024,
            this.game.lifecycle.screenHeight / 1536,
        );
        this.courtyardResidents = this.courtyardColony.residents.map((resident, i) => {
            const view = new CourtyardResident(
                this.courtyardNode!,
                this.game.assets.residentFrames,
                scale,
                i,
            );
            view.render(resident, !!this.courtyardPreview);
            return view;
        });
        const rim = this.game.ui
            .node2d(
                'Resident doorway lip',
                this.courtyardNode,
                3 * scale,
                (768 - 651.5) * scale,
                180 * scale,
                143 * scale,
            )
            .addComponent(Sprite);
        rim.sizeMode = Sprite.SizeMode.CUSTOM;
        rim.spriteFrame = this.game.assets.residentDoorFrame;
        // Doorway decorations must remain in front of the background lip.
        for (const child of this.courtyardNode.children) {
            if (
                child.name === 'Furnishing ' + this.game.profile.save.courtyard.equipped.entrance ||
                child.name ===
                    'Furnishing ' +
                        (this.courtyardPreview?.slot === 'entrance' ? this.courtyardPreview.id : '')
            ) {
                child.setSiblingIndex(this.courtyardNode.children.length - 1);
                break;
            }
        }
        this.courtyardAtmosphere = new CourtyardAtmosphere(
            this.courtyardNode,
            scale,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
        );
        this.courtyardColony.night = this.courtyardHour() >= 18 || this.courtyardHour() < 6;
        this.courtyardAtmosphere.render(this.courtyardColony, !!this.courtyardPreview);
        let previewOffset = this.courtyardPreview
            ? courtyardPreviewOffset(
                  this.courtyardPreview.slot,
                  this.game.lifecycle.screenWidth,
                  this.game.lifecycle.screenHeight,
                  courtyardShopLayout(this.game.lifecycle.touchSize).height,
              )
            : 0;
        const closing = this.game.overlays.drawerMotion;
        if (closing?.closing && closing.previewFrom !== undefined) {
            const remaining = Math.pow(1 - Math.min(1, closing.elapsed / 0.36), 3);
            previewOffset = closing.previewFrom * remaining;
        }
        this.courtyardNode.setPosition(0, previewOffset);
        this.game.home.homeScene!.node.setPosition(0, previewOffset);
        if (this.game.home.homeTitle) this.game.home.homeTitle.node.active = !this.courtyardPreview;
        const painting = this.game.home.home.children.find((node) => node.name === 'Home painting');
        if (painting) painting.active = !this.courtyardPreview;
    }

    courtyardNode: Node | null = null;

    courtyardColony = new CourtyardColony();

    courtyardLife = this.courtyardColony.residents[0];

    courtyardResidents: CourtyardResident[] = [];

    courtyardAtmosphere: CourtyardAtmosphere | null = null;

    courtyardHour = () => new Date().getHours();

    courtyardDrawOrder = '';

    courtyardPreview: Furnishing | undefined;

    updateCourtyard(dt: number) {
        if (
            this.game.home.home &&
            !this.game.lifecycle.paused &&
            !this.game.overlays.modal &&
            this.game.assets.residentFrames.length === 12
        ) {
            this.courtyardColony.update(
                dt,
                this.game.profile.save.courtyard.equipped.living,
                this.game.profile.save.courtyard.equipped.garden,
                this.courtyardHour(),
            );
            this.courtyardResidents.forEach((view, i) =>
                view.render(this.courtyardColony.residents[i], false),
            );
            const order = [0, 1, 2].sort(
                (a, b) => this.courtyardColony.residents[a].y - this.courtyardColony.residents[b].y,
            );
            const key = order.join(',');
            if (key !== this.courtyardDrawOrder) {
                this.courtyardDrawOrder = key;
                const roots = this.courtyardResidents.map((view) => view.root);
                const start = Math.min(
                    ...roots.map((root) => this.courtyardNode!.children.indexOf(root)),
                );
                order.forEach((id, index) => roots[id].setSiblingIndex(start + index));
            }
            this.courtyardAtmosphere?.render(this.courtyardColony, false);
        }
    }
}
