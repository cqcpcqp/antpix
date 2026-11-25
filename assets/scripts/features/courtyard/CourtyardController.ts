import type { Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { CourtyardColony, FEEDING_SPOT } from '../../domain/courtyard/courtyardColony';
import type { Furnishing } from '../../domain/profile/profile';
import { CourtyardAtmosphere } from './courtyardAtmosphere';
import { CourtyardResident } from './courtyardResident';
import {
    courtyardPreviewOffset,
    courtyardShopLayout,
    renderCourtyard,
    residentLayers,
} from './courtyardView';

/** Owns courtyard residents, previews and rendering. */
export class CourtyardController {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'home' | 'profile' | 'assets' | 'lifecycle' | 'ui' | 'overlays' | 'pets'
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
        const scale = Math.max(
            this.game.lifecycle.screenWidth / 1024,
            this.game.lifecycle.screenHeight / 1536,
        );
        const layers = residentLayers(this.courtyardNode, scale);
        const bowl = this.game.assets.residentArtwork?.prop(layers.outside, 'bowl', 48 * scale);
        if (bowl) {
            bowl.name = 'Resident feeding spot';
            bowl.setPosition((FEEDING_SPOT.x - 512) * scale, (768 - FEEDING_SPOT.y) * scale);
            bowl.active = false;
        }
        this.feedingSpot = bowl;
        const resident = new CourtyardResident(
            layers,
            scale,
            this.game.assets.residentArtwork,
            this.game.assets.residentSkeleton,
        );
        resident.render(this.courtyardLife, !!this.courtyardPreview);
        this.courtyardResident = resident;
        this.courtyardAtmosphere = new CourtyardAtmosphere(this.courtyardNode, scale);
        this.game.pets.attach(this.courtyardNode, resident);
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
    }

    courtyardNode: Node | null = null;

    courtyardColony = new CourtyardColony();

    courtyardLife = this.courtyardColony.resident;

    courtyardResident: CourtyardResident | null = null;

    private feedingSpot: Node | undefined;

    courtyardAtmosphere: CourtyardAtmosphere | null = null;

    courtyardPreview: Furnishing | undefined;

    updateCourtyard(dt: number) {
        if (
            this.game.home.home &&
            !this.game.lifecycle.paused &&
            !this.game.overlays.modal &&
            !this.courtyardPreview
        ) {
            const reacting = this.game.pets.isReacting();
            const held = reacting || this.game.pets.isInteracting();
            const { health, satiety, mood } = this.game.pets.vitals();
            this.courtyardColony.update(
                dt,
                this.game.profile.save.courtyard.equipped.living,
                this.game.profile.save.courtyard.equipped.garden,
                held,
                { hungry: satiety < 25, tired: health < 80, happy: mood >= 80 },
            );
            this.courtyardResident?.render(this.courtyardLife, false, dt, held);
            if (this.feedingSpot)
                this.feedingSpot.active = this.courtyardLife.activity === 'hungry';
            this.courtyardAtmosphere?.render(this.courtyardColony, false);
            const { action, elapsed, plan } = this.courtyardLife;
            const speech =
                action === 'rest' && elapsed >= 0.42 && elapsed < 4.6 ? plan?.speech : '';
            this.game.pets.update(dt, speech);
            this.courtyardResident?.advanceRig(held && !reacting ? 0 : dt);
        }
    }
}
