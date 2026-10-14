import {
    AudioClip,
    AudioSource,
    Camera,
    Canvas,
    game,
    Game,
    Layers,
    Node,
    ResolutionPolicy,
    resources,
    sys,
    view,
} from 'cc';
import type { GardenRuntime } from './GardenRuntime';
import { color } from '../presentation/gameVisuals';

/** Owns engine startup, subscriptions and teardown. */
export class Lifecycle {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'preview'
            | 'audio'
            | 'profile'
            | 'home'
            | 'settings'
            | 'ui'
            | 'host'
            | 'layout'
            | 'cloud'
            | 'homeAssets'
            | 'boardAssets'
            | 'assets'
            | 'boosts'
            | 'containers'
        >,
    ) {}
    root!: Node;

    screenWidth = 750;

    screenHeight = 1500;

    touchSize = 88;

    minimumTextSize = 24;

    gameRoot!: Node;

    paused = false;

    hideHandler = () => {
        this.game.preview.clearPreview();
        this.paused = true;
        this.game.audio.music.pause();
        this.game.audio.music.volume = 0;
        this.game.profile.persist();
    };

    showHandler = () => {
        this.paused = false;
        this.game.audio.syncMusic();
        if (this.game.home.home) this.game.home.showHome(true);
    };

    onLoad() {
        this.game.profile.readSave();
        // Expand the logical canvas to the device aspect ratio instead of letterboxing.
        // Keep the existing 750 × 1500 content centred and fully visible.
        const frame = view.getFrameSize(),
            aspect = frame.width / frame.height;
        this.screenWidth = Math.max(750, 1500 * aspect);
        this.screenHeight = Math.max(1500, 750 / aspect);
        this.touchSize = Math.max(88, (44 * this.screenWidth) / frame.width);
        this.minimumTextSize = (12 * this.screenWidth) / frame.width;
        try {
            this.game.settings.controlsSeen = sys.localStorage.getItem('ant-controls-seen') === '1';
        } catch {
            // Local storage may be disabled; controls remain available for this session.
        }
        view.setDesignResolutionSize(
            this.screenWidth,
            this.screenHeight,
            ResolutionPolicy.SHOW_ALL,
        );
        this.root = this.game.ui.node2d(
            'Garden',
            this.game.host.node,
            0,
            0,
            this.screenWidth,
            this.screenHeight,
        );
        const canvas = this.root.addComponent(Canvas);
        const camera = this.game.ui.node2d('Camera', this.root);
        camera.setPosition(0, 0, 1000);
        const cam = camera.addComponent(Camera);
        cam.projection = Camera.ProjectionType.ORTHO;
        cam.orthoHeight = this.screenHeight / 2;
        cam.near = 1;
        cam.far = 2000;
        cam.clearColor = color('#F2F1E6');
        cam.visibility = Layers.Enum.UI_2D;
        canvas.cameraComponent = cam;
        this.game.audio.audio = this.game.host.node.addComponent(AudioSource);
        this.game.audio.music = this.game.ui
            .node2d('Background music', this.root)
            .addComponent(AudioSource);
        this.game.audio.music.loop = true;
        this.game.audio.music.playOnAwake = false;
        this.game.audio.music.volume = 0;
        this.root.on(Node.EventType.TOUCH_END, () => this.game.audio.unlockAudio());
        resources.load('audio/garden-bgm', AudioClip, (error, clip) => {
            if (!error && this.game.host.isValid) {
                this.game.audio.music.clip = clip;
                this.game.audio.syncMusic();
            }
        });
        for (const name of ['tap', 'win'])
            resources.load('audio/' + name, AudioClip, (error, clip) => {
                if (!error && this.game.host.isValid) this.game.audio.clips.set(name, clip);
            });
        game.on(Game.EVENT_HIDE, this.hideHandler);
        game.on(Game.EVENT_SHOW, this.showHandler);
        this.gameRoot = this.game.ui.node2d('Game screen', this.root);
        this.game.layout.layout();
        this.game.home.showHome();
        if (this.game.cloud.cloudMode) this.game.cloud.connectCloud();
        this.game.homeAssets.loadHomeAssets();
        this.game.boardAssets.loadBoardAssets();
    }

    onDestroy() {
        for (const frame of this.game.assets.residentFrames) frame.destroy();
        this.game.assets.residentTexture?.decRef();
        this.game.assets.residentDoorFrame?.destroy();
        this.game.assets.residentDoorTexture?.decRef();
        this.game.boosts.rewardAdDemo = null;
        this.game.audio.music.stop();
        this.game.audio.audio.stop();
        game.off(Game.EVENT_HIDE, this.hideHandler);
        game.off(Game.EVENT_SHOW, this.showHandler);
        for (const frame of this.game.assets.antFrames) frame.destroy();
        this.game.assets.antTexture?.decRef();
        for (const frame of this.game.assets.nestFrames) frame.destroy();
        this.game.assets.nestTexture?.decRef();
        for (const frame of this.game.assets.containerFrames) frame?.destroy();
        for (const texture of this.game.assets.containerTextures) texture.decRef();
        this.game.containers.containerDetails.clear();
        for (const frame of this.game.assets.trayFrames) frame.destroy();
        for (const texture of this.game.assets.trayTextures) texture.decRef();
        for (const frame of this.game.assets.furnishingFrames.values()) frame.destroy();
        this.game.assets.furnishingTexture?.decRef();
        this.game.assets.homeFrame?.destroy();
        this.game.assets.homeTexture?.decRef();
        this.game.assets.homeTitleFrame?.destroy();
        this.game.assets.homeTitleTexture?.decRef();
        for (const frame of this.game.assets.homeActionFrames.values()) frame.destroy();
        for (const texture of this.game.assets.homeActionTextures) texture.decRef();
    }
}
