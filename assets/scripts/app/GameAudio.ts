import { AudioClip, AudioSource } from 'cc';
import type { GardenRuntime } from './GardenRuntime';

/** Owns audio unlock and playback according to device preferences. */
export class GameAudio {
    constructor(private readonly game: Pick<GardenRuntime, 'profile' | 'lifecycle'>) {}
    audio!: AudioSource;

    music!: AudioSource;

    audioUnlocked = false;

    clips = new Map<string, AudioClip>();

    unlockAudio() {
        this.audioUnlocked = true;
        this.syncMusic();
    }

    syncMusic() {
        if (!this.game.profile.save.music || this.game.lifecycle.paused) {
            this.music.pause();
            this.music.volume = 0;
            return;
        }
        if (this.audioUnlocked && this.music.clip && !this.music.playing) this.music.play();
    }

    play(name: string) {
        this.unlockAudio();
        if (!this.game.profile.save.sound || this.game.lifecycle.paused) return;
        const clip = this.clips.get(name);
        if (!clip) return;
        this.audio.playOneShot(clip, name === 'tap' ? 0.28 : 0.42);
    }
}
