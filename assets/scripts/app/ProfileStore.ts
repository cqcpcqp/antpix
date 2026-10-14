import { sys } from 'cc';
import { LEVEL_COUNT } from '../domain/levels/levels';
import type { Profile } from '../domain/profile/profile';
import { freshProfile, readProfile } from '../domain/profile/profile';
import type { GardenRuntime } from './GardenRuntime';

/** Persists local play or device settings; cloud profiles remain authoritative. */
export class ProfileStore {
    constructor(private readonly game: Pick<GardenRuntime, 'cloud'>) {}
    save: Profile = freshProfile();

    persist() {
        try {
            if (this.game.cloud.cloudMode)
                sys.localStorage.setItem(
                    'ant-device-settings',
                    JSON.stringify({ sound: this.save.sound, music: this.save.music }),
                );
            else sys.localStorage.setItem('pixel-garden-v1', JSON.stringify(this.save));
        } catch {
            console.warn('本机存储不可用，进度暂时无法保存');
        }
    }

    readSave() {
        try {
            if (this.game.cloud.cloudMode) {
                this.save = freshProfile();
                const settings = sys.localStorage.getItem('ant-device-settings');
                if (settings) {
                    const local = JSON.parse(settings);
                    this.save.sound = local.sound;
                    this.save.music = local.music;
                }
            } else {
                this.save = readProfile(sys.localStorage.getItem('pixel-garden-v1'), LEVEL_COUNT);
            }
        } catch {
            this.save = freshProfile();
        }
    }
}
