import { sys } from 'cc';
import { LEVEL_COUNT } from '../domain/levels/levels';
import type { Profile } from '../domain/profile/profile';
import { freshProfile, readProfile } from '../domain/profile/profile';
import { PET_HOUR } from '../domain/profile/pets';
import type { GardenRuntime } from './GardenRuntime';

/** Keeps local progress isolated from cloud assets; audio preferences belong to the device. */
export class ProfileStore {
    constructor(private readonly game: Pick<GardenRuntime, 'cloud'>) {}
    save: Profile = freshProfile();
    recommendationClicked = false;

    private get saveKey() {
        return this.game.cloud.petTrial ? 'antpix-pet-trial-v1' : 'pixel-garden-v1';
    }

    /** This local entry preference must survive cloud profile replacement. */
    markRecommendationClicked() {
        this.recommendationClicked = true;
        try {
            sys.localStorage.setItem('ant-recommendation-clicked', '1');
        } catch {
            console.warn('本机存储不可用');
        }
    }

    persist() {
        try {
            sys.localStorage.setItem(
                'ant-device-settings',
                JSON.stringify({ sound: this.save.sound, music: this.save.music }),
            );
            if (!this.game.cloud.cloudMode)
                sys.localStorage.setItem(this.saveKey, JSON.stringify(this.save));
        } catch {
            console.warn('本机存储不可用，进度暂时无法保存');
        }
    }

    readSave() {
        try {
            this.recommendationClicked =
                sys.localStorage.getItem('ant-recommendation-clicked') === '1';
        } catch {
            // Keep the session preference when device storage is unavailable.
        }
        try {
            const localSave = sys.localStorage.getItem(this.saveKey);
            this.save = this.game.cloud.cloudMode
                ? freshProfile()
                : readProfile(localSave, LEVEL_COUNT);
            if (this.game.cloud.petTrial && !localSave) {
                const now = Date.now();
                this.save.completed = [0, 1, 2, 3, 4, 5, 6, 7];
                this.save.claimed = [...this.save.completed];
                this.save.unlocked = 8;
                this.save.coins = 150;
                this.save.pets.melons = 2;
                this.save.pets.residents[0].fedUntil = now + 18 * PET_HOUR;
            }
            const settings = sys.localStorage.getItem('ant-device-settings');
            if (settings) {
                const local = JSON.parse(settings);
                this.save.sound = local.sound;
                this.save.music = local.music;
            }
        } catch {
            this.save = freshProfile();
        }
        if (!this.game.cloud.cloudMode) this.persist();
    }
}
