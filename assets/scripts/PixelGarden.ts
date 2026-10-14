import { _decorator, Component, Node, Canvas, Camera, UITransform, UIOpacity, Graphics, Color, Label, Font, BitmapFont, Layers, view, ResolutionPolicy, sys, resources, AudioClip, AudioSource, game, Game, Sprite, SpriteFrame, Texture2D, Rect, Size, SubContextView } from 'cc';

import { GardenModel } from './model';

import { drawBoardPixel, drawAnt } from './gardenDrawing';
import { containerNumberOffset } from './containerTypography';

import { CELL_SIZE, BOARD_LEFT, BOARD_TOP, COLLECTION_SLOT_Y, NEST, queueColumnX, collectionSlotX, collectionSlotY, EXTRA_SLOT_X, EXTRA_SLOT_Y, EXPANSION_COLUMNS, gridToWorld, worldToGrid } from './boardLayout';

import { ISLAND, islandPanel, islandRibbon, islandModal } from './islandTheme';

import { freshProfile, readProfile, SKINS, rewardAmount, claimRewards, buyOrEquip, recordWin, todayKey } from './profile';

import type { Profile, CourtyardSlot, Furnishing } from './profile';
import { FURNISHINGS, buyOrEquipFurnishing } from './profile';
import { renderCourtyard, renderCourtyardShop, courtyardShopLayout, courtyardPreviewOffset, SLOT_NAMES } from './courtyardView';

import { AntRouteSearch, AntTargetSearch, clearSegment, findAntRoute, nearestAntTarget, prepareRoute, samplePreparedRoute } from './routing';

import type { RoutePoint, RoutePose, PreparedRoute } from './routing';

import type { Pickup, Jar } from './model';

import { makeLevel, LEVEL_COUNT, PALETTE, GRID_HEIGHT } from './levels';

import { rewardedVideoConfigured, showRewardedVideo } from './rewardAd';
import { CloudGame, CloudGameError, wechatAvailable, wechatTransport } from './cloudGame';
import type { CloudState } from './cloudGame';
import { syncFriendScore, authorizeFriends, showFriendPage, changeFriendPage } from './friendBoard';

const { ccclass } = _decorator;

const INK = ISLAND.ink, MUTED = ISLAND.muted, PAPER = ISLAND.paper, GREEN = ISLAND.primary;

const DISPATCH_INTERVAL = .5; // Seconds per container at 1× speed.
const LAUNCH_DURATION = .28;
const ANT_LAUNCH_DURATION = .14;


const color = (hex: string) => new Color(hex);

// Cocos uses upward-positive Y and counterclockwise angles.
// [x, y, angle, scaleX, scaleY, opacity]
type ContainerPose = readonly [number, number, number, number, number, number];
const SELECT_POSES: readonly ContainerPose[] = [[0,0,0,1,1,255],[0,5,12,1,1,255],[0,0,-5,1,1,255],[0,0,0,1,1,255]];
const ENTRY_POSES: readonly ContainerPose[] = [[-30,38,25,.5,.5,0],[-8,20,10,.9,.9,255],[0,-4,-6,1.05,.9,255],[0,0,0,1,1,255]];
const EXIT_POSES: readonly ContainerPose[] = [[0,0,0,1,1,255],[10,15,-14,.75,.75,255],[30,40,-35,.1,.1,0]];

interface CardView {
    motion: Node;
    selectElapsed: number;
    node: Node;
    art: Graphics;
    label: Label;
    id: number;
    row: number;
    column: number;
    targetY: number;
    sprite: Sprite;
}

interface SlotView {
    art: Graphics;
    label: Label;
    id: number;
    container: Node;
    body: Graphics;
    sprite: Sprite;
    color: number;
    launchElapsed: number;
    entryElapsed: number;
    opacity: UIOpacity;
    exit: Node;
    exitBody: Graphics;
    exitSprite: Sprite;
    exitOpacity: UIOpacity;
    exitElapsed: number;
}

interface AntVisual {
    node: Node;
    frames: Node[];
    cargo: Node;
    color: number;
    frame: number;
    body: Sprite | null;
    cargoSprite: Sprite | null;
    bodyDetail: Sprite | null;
    cargoDetail: Sprite | null;
}

interface HoldPreview {
    node: Node;
    color: number;
    elapsed: number;
    shown: boolean;
    valid: () => boolean;
}

interface Celebration {
    elapsed: number;
    art: Node;
    rows: Node[];
    album: Node;
    actions: Node;
    status: Label;
    skip: Node;
}

interface AntTrip {
    visual: AntVisual;
    pickup: Pickup;
    elapsed: number;
    phase: 'launch' | 'outbound' | 'grasp' | 'return' | 'enter';
    path: RoutePoint[];
    route: PreparedRoute;
    pose: RoutePose;
    gripAngle: number;
    gripTurn: number;
    distance: number;
    lifted: boolean;
    launchOrigin: RoutePoint;
    fromPose: RoutePose;
    toPose: RoutePose;
    fromGrid: RoutePoint;
    toGrid: RoutePoint;
    clearanceBlocked: boolean;
    clearanceRemaining: number;
}

@ccclass('PixelGarden')
export class PixelGarden extends Component {
    private root!: Node;
    private screenWidth = 750;
    private screenHeight = 1500;
    private touchSize = 88;
    private controlsSeen = false;
    private gameRoot!: Node;
    private home: Node | null = null;
    private homeScene: Sprite | null = null;
    private homeFrame: SpriteFrame | null = null;
    private homeTexture: Texture2D | null = null;
    private homeTitle: Sprite | null = null;
    private homeTitleFrame: SpriteFrame | null = null;
    private homeTitleTexture: Texture2D | null = null;
    private homeActionFrames = new Map<string, SpriteFrame>();
    private homeActionTextures: Texture2D[] = [];
    private courtyardNode: Node | null = null;
    private courtyardPreview: Furnishing | undefined;
    private furnishingFrames = new Map<string, SpriteFrame>();
    private furnishingTexture: Texture2D | null = null;
    private nestArt!: Graphics;
    private nestSprite!: Sprite;
    private nestFrames: SpriteFrame[] = [];
    private nestTexture: Texture2D | null = null;
    private model!: GardenModel;
    private boardRows: Graphics[] = [];
    private hintRows: Graphics[] = [];
    private hintCounts: number[] = Array(GRID_HEIGHT).fill(0);
    private hold: HoldPreview | null = null;
    private celebration: Celebration | null = null;
    private antPool: AntVisual[] = [];
    private antFrames: SpriteFrame[] = [];
    private antTexture: Texture2D | null = null;
    private containerFrames: SpriteFrame[] = [];
    private containerDetails = new Map<Sprite, Sprite>();
    private containerTextures: Texture2D[] = [];
    private traySprites: Sprite[] = [];
    private trayFrames: SpriteFrame[] = [];
    private trayTextures: Texture2D[] = [];
    private effects!: Graphics;
    private playfield!: Node;
    private jars!: Node;
    private queue!: Node;
    private queueCount!: Label;
    private speedLabel!: Label;
    private speedVideo!: Node;
    private expansionBoard!: Node;
    private levelLabel!: Label;
    private slotLabels: Label[] = [];
    private slotViews: SlotView[] = [];
    private cardViews: CardView[] = [];
    private dirtyRows = new Set<number>();
    private notification: {
        node: Node;
        elapsed: number;
    } | null = null;
    private drawerMotion: {
        node: Node;
        from: number;
        to: number;
        elapsed: number;
        closing: boolean;
        previewFrom?: number;
    } | null = null;
    private drawerSheet: Node | null = null;
    private drawerVeil: UIOpacity | null = null;
    private courtyardShopContent: Node | null = null;
    private nestShopContent: Node | null = null;
    private drawerSubtitle: Label | null = null;
    private lastCourtyardSelection: Furnishing | null = null;
    private minimumTextSize = 24;
    private fullFeedback = 0;
    private rewardAdDemo: { remaining: number; label: Label; complete: () => void } | null = null;
    private flights: AntTrip[] = [];
    private targetSearch = new AntTargetSearch();
    private readonly returnRouteSearch = new AntRouteSearch();
    private dispatchClocks = Array(5).fill(0);
    private dispatchJarIds = Array(5).fill(-1);
    private speed = 1;
    private speedUnlocked = false;
    private finishing = false;

    private get effectiveSpeed() {
        return this.finishing ? 4 : this.speed;
    }
    private paused = false;
    private modal: Node | null = null;
    private elapsed = 0;
    private won = false;
    private pendingVictory = false;
    private save: Profile = freshProfile();
    private cloudMode = wechatAvailable();
    private cloud: CloudGame | null = null;
    private cloudBusy = false;
    private cloudReady = false;
    private cloudRequest = 0;
    private cloudMessage = '';
    private cloudRetry: (() => void) | null = null;
    private cloudCancellable = false;
    private cloudStatus: Node | null = null;
    private homePlayLabel: Label | null = null;
    private homeRewardButton: Node | null = null;
    private modalStatusY = 0;
    private cloudRunId = '';
    private cloudHighest = -1;
    private cloudReachedAt = 0;
    private serverOffset = 0;
    /** Reused board view for per-frame route clearance checks. */
    private routeBoard = { width: 0, height: 0, pixels: [] as readonly number[] };

    private gameFont: Font | null = null;
    private containerFont: BitmapFont | null = null;
    private containerLabels = new Set<Label>();
    private audio!: AudioSource;
    private music!: AudioSource;
    private audioUnlocked = false;
    private clips = new Map<string, AudioClip>();
    private hideHandler = () => {
        this.clearPreview();
        this.paused = true;
        this.music.pause();
        this.music.volume = 0;
        this.persist();
    };
    private showHandler = () => {
        this.paused = false;
        this.syncMusic();
        if (this.home) this.showHome(true);
    };

    onLoad() {
        this.readSave();
        // Expand the logical canvas to the device aspect ratio instead of letterboxing.
        // Keep the existing 750 × 1500 content centred and fully visible.
        const frame = view.getFrameSize(), aspect = frame.width / frame.height;
        this.screenWidth = Math.max(750, 1500 * aspect);
        this.screenHeight = Math.max(1500, 750 / aspect);
        this.touchSize = Math.max(88, 44 * this.screenWidth / frame.width);
        this.minimumTextSize = 12 * this.screenWidth / frame.width;
        try { this.controlsSeen = sys.localStorage.getItem('ant-controls-seen') === '1'; } catch {}
        view.setDesignResolutionSize(this.screenWidth, this.screenHeight, ResolutionPolicy.SHOW_ALL);
        this.root = this.node2d('Garden', this.node, 0, 0, this.screenWidth, this.screenHeight);
        const canvas = this.root.addComponent(Canvas);
        const camera = this.node2d('Camera', this.root);
        camera.setPosition(0, 0, 1000);
        const cam = camera.addComponent(Camera);
        cam.projection = Camera.ProjectionType.ORTHO;
        cam.orthoHeight = this.screenHeight / 2;
        cam.near = 1;
        cam.far = 2000;
        cam.clearColor = color('#F2F1E6');
        cam.visibility = Layers.Enum.UI_2D;
        canvas.cameraComponent = cam;
        this.audio = this.node.addComponent(AudioSource);
        this.music = this.node2d('Background music', this.root).addComponent(AudioSource);
        this.music.loop = true;
        this.music.playOnAwake = false;
        this.music.volume = 0;
        this.root.on(Node.EventType.TOUCH_END, () => this.unlockAudio());
        resources.load('audio/garden-bgm', AudioClip, (error, clip) => {
            if (!error && this.isValid) {
                this.music.clip = clip;
                this.syncMusic();
            }
        });
        for (const name of ['tap', 'win'])
            resources.load('audio/' + name, AudioClip, (error, clip) => {
                if (!error && this.isValid)
                    this.clips.set(name, clip);
            });
        game.on(Game.EVENT_HIDE, this.hideHandler);
        game.on(Game.EVENT_SHOW, this.showHandler);
        this.gameRoot = this.node2d('Game screen', this.root);
        this.layout();
        this.showHome();
        if (this.cloudMode)
            this.connectCloud();
        resources.load('home/garden/texture', Texture2D, (error, texture) => {
            if (!this.isValid)
                return;
            if (error) {
                console.error('首页场景加载失败', error);
                return;
            }
            this.homeTexture = texture;
            texture.addRef();
            const frame = new SpriteFrame();
            frame.texture = texture;
            const scale = Math.max(this.screenWidth / texture.width, this.screenHeight / texture.height);
            const w = this.screenWidth / scale, h = this.screenHeight / scale;
            frame.rect = new Rect((texture.width - w) / 2, (texture.height - h) / 2, w, h);
            frame.originalSize = new Size(w, h);
            frame.packable = false;
            this.homeFrame = frame;
            if (this.homeScene)
                this.homeScene.spriteFrame = frame;
        });
        resources.load('home/furnishings/texture', Texture2D, (error, texture) => {
            if (!this.isValid) return;
            if (error) { console.error('庭院装饰加载失败', error); return; }
            this.furnishingTexture = texture;
            texture.addRef();
            FURNISHINGS.forEach((item, index) => {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(Math.floor(index / 3) * 256, index % 3 * 256, 256, 256);
                frame.originalSize = new Size(256, 256);
                frame.packable = false;
                this.furnishingFrames.set(item.id, frame);
            });
            this.refreshCourtyard();
            const updateSamples = (node: Node) => {
                for (const item of FURNISHINGS)
                    if (node.name === 'Furnishing thumbnail ' + item.id)
                        node.getComponent(Sprite)!.spriteFrame = this.furnishingFrames.get(item.id)!;
                node.children.forEach(updateSamples);
            };
            if (this.modal) updateSamples(this.modal);
        });
        resources.load('home/title/texture', Texture2D, (error, texture) => {
            if (!this.isValid)
                return;
            if (error) {
                console.error('首页标题加载失败', error);
                return;
            }
            this.homeTitleTexture = texture;
            texture.addRef();
            const frame = new SpriteFrame();
            frame.texture = texture;
            frame.rect = new Rect(0, 0, texture.width, texture.height);
            frame.originalSize = new Size(texture.width, texture.height);
            frame.packable = false;
            this.homeTitleFrame = frame;
            if (this.homeTitle)
                this.homeTitle.spriteFrame = frame;
        });
        for (const name of ['play', 'album', 'shop', 'rank'])
            resources.load(`home/${name}/texture`, Texture2D, (error, texture) => {
                if (!this.isValid)
                    return;
                if (error) {
                    console.error('首页按钮素材加载失败', name, error);
                    return;
                }
                texture.addRef();
                this.homeActionTextures.push(texture);
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(0, 0, texture.width, texture.height);
                frame.originalSize = new Size(texture.width, texture.height);
                frame.packable = false;
                this.homeActionFrames.set(name, frame);
                const apply = (node: Node) => {
                    if (node.name === `Home asset ${name}`)
                        node.getComponent(Sprite)!.spriteFrame = frame;
                    node.children.forEach(apply);
                };
                if (this.home)
                    apply(this.home);
            });
        // Shared tinted silhouettes plus neutral highlights/legs keep texture size
        // constant as the level catalog grows. Both layers share one material.
        resources.load('ants/workers/texture', Texture2D, (error, texture) => {
            if (!this.isValid)
                return;
            if (error) {
                console.error('蚂蚁图集加载失败', error);
                return;
            }
            this.antTexture = texture;
            texture.addRef();
            for (let tile = 0; tile < 8; tile++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(tile * 64, 0, 64, 64);
                frame.originalSize = new Size(64, 64);
                frame.packable = false;
                this.antFrames.push(frame);
            }
            for (const visual of this.antPool)
                this.useAntAtlas(visual);
        });
        resources.load('trays/wood-hole/texture', Texture2D, (error, texture) => {
            if (!this.isValid) return;
            if (error) { console.error('木质洞口素材加载失败', error); return; }
            this.nestTexture = texture;
            texture.addRef();
            for (let index = 0; index < SKINS.length; index++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(index * 104, 0, 104, 60);
                frame.originalSize = new Size(104, 60);
                frame.packable = false;
                this.nestFrames.push(frame);
            }
            this.drawNest();
            if (this.nestShopContent) this.nestShop();
        });
        for (const name of ['wood', 'acorn', 'garden-background'])
            resources.load(`trays/${name}/texture`, Texture2D, (error, texture) => {
                if (!this.isValid) return;
                if (error) { console.error('木托盘素材加载失败', error); return; }
                texture.addRef();
                this.trayTextures.push(texture);
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(0, 0, texture.width, texture.height);
                frame.originalSize = new Size(texture.width, texture.height);
                frame.packable = false;
                if (name === 'wood') {
                    frame.insetLeft = frame.insetRight = 76;
                    frame.insetTop = 48;
                    frame.insetBottom = 48;
                }
                this.trayFrames.push(frame);
                for (const sprite of this.traySprites)
                    if (sprite.node.name === name) sprite.spriteFrame = frame;
            });
        resources.load('containers/boxes/texture', Texture2D, (error, texture) => {
            if (!this.isValid)
                return;
            if (error) {
                console.error('容器图集加载失败', error);
                return;
            }
            this.containerTextures.push(texture);
            texture.addRef();
            for (let tile = 0; tile < 2; tile++) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(tile * 88, 0, 88, 88);
                frame.originalSize = new Size(88, 88);
                frame.packable = false;
                this.containerFrames[tile] = frame;
            }
            for (const slot of this.slotViews) {
                if (slot.id >= 0 && this.containerFrames[0]) {
                    slot.body.clear();
                    this.applyContainerMaterial(slot.sprite, slot.color);
                }
            }
            for (const card of this.cardViews) {
                const jar = this.model?.columns[card.column]?.[card.row];
                if (card.node.active && jar?.id === card.id && this.containerFrames[0]) {
                    card.art.clear();
                    this.containerShadow(card.art);
                    this.applyContainerMaterial(card.sprite, jar.color);
                }
            }
        });
        resources.load('fonts/container-digits', BitmapFont, (error, font) => {
            if (!this.isValid)
                return;
            if (error) {
                console.error('容器数字字体加载失败', error);
                return;
            }
            this.containerFont = font;
            for (const label of this.containerLabels)
                label.font = font;
        });
        resources.load('fonts/ant-nest-bitmap', BitmapFont, (error, font) => {
            if (!this.isValid)
                return;
            if (error) {
                console.error('游戏字体加载失败', error);
                return;
            }
            this.gameFont = font;
            const apply = (node: Node) => {
                const label = node.getComponent(Label);
                if (label) {
                    label.font = this.containerLabels.has(label) && this.containerFont ? this.containerFont : font;
                    label.isBold = false;
                }
                for (const child of node.children)
                    apply(child);
            };
            apply(this.root);
        });
    }

    onDestroy() {
        this.rewardAdDemo = null;
        this.music.stop();
        this.audio.stop();
        game.off(Game.EVENT_HIDE, this.hideHandler);
        game.off(Game.EVENT_SHOW, this.showHandler);
        for (const frame of this.antFrames)
            frame.destroy();
        this.antTexture?.decRef();
        for (const frame of this.nestFrames) frame.destroy();
        this.nestTexture?.decRef();
        for (const frame of this.containerFrames)
            frame?.destroy();
        for (const texture of this.containerTextures)
            texture.decRef();
        this.containerDetails.clear();
        for (const frame of this.trayFrames) frame.destroy();
        for (const texture of this.trayTextures) texture.decRef();
        for (const frame of this.furnishingFrames.values()) frame.destroy();
        this.furnishingTexture?.decRef();
        this.homeFrame?.destroy();
        this.homeTexture?.decRef();
        this.homeTitleFrame?.destroy();
        this.homeTitleTexture?.decRef();
        for (const frame of this.homeActionFrames.values())
            frame.destroy();
        for (const texture of this.homeActionTextures)
            texture.decRef();
    }
    private node2d(name: string, parent: Node, x = 0, y = 0, w = 750, h = 1500) {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        n.parent = parent;
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private graphics(parent: Node, name = 'Art') {
        return this.node2d(name, parent).addComponent(Graphics);
    }

    private box(g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: string) {
        g.fillColor = color(fill);
        g.roundRect(x - w / 2, y - h / 2, w, h, r);
        g.fill();
    }

    private text(parent: Node, value: string, x: number, y: number, size = 24, fill: string = INK, w = 640) {
        size = Math.max(size, this.minimumTextSize);
        const n = this.node2d('Text', parent, x, y, w, size * 1.6);
        const l = n.addComponent(Label);
        l.string = value;
        l.fontSize = size;
        l.lineHeight = size * 1.35;
        l.color = color(fill);
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.overflow = Label.Overflow.SHRINK;
        l.enableWrapText = false;
        if (this.gameFont)
            l.font = this.gameFont;
        l.isBold = false;
        l.enableOutline = false;
        return l;
    }

    private button(parent: Node, text: string, x: number, y: number, w: number, h: number, fill: string, callback: () => void, fg: string = INK) {
        // Enlarge the hit area without enlarging the visual face.
        const n = this.node2d(text, parent, x, y, Math.max(this.touchSize, w), Math.max(this.touchSize, h)), g = n.addComponent(Graphics);
        const primary = fill === GREEN, radius = Math.min(44, h / 2);
        const face = primary ? ISLAND.teal : fill;
        this.box(g, 0, -7, w, h, radius, primary ? ISLAND.tealBack : ISLAND.shadow);
        this.box(g, 0, 0, w, h, radius, face);
        g.strokeColor = color(primary ? ISLAND.tealBack : ISLAND.border);
        g.lineWidth = 2;
        g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius - 1);
        g.stroke();
        const label = this.text(n, text, 0, 1, 28, primary ? '#245844' : fg, w - 24);
        label.isBold = false;
        // A small downward press mirrors the library's active button movement.
        n.on(Node.EventType.TOUCH_START, () => {
            n.setPosition(x, y - 3);
            n.setScale(.98, .98, 1);
        });
        const release = () => {
            n.setPosition(x, y);
            n.setScale(1, 1, 1);
        };
        n.on(Node.EventType.TOUCH_CANCEL, release);
        n.on(Node.EventType.TOUCH_END, () => {
            release();
            this.play('tap');
            callback();
        });
        return label;
    }

    private gearButton(parent: Node, x: number, y: number) {
        const button = this.node2d('Settings menu', parent, x, y, this.touchSize, this.touchSize);
        const g = button.addComponent(Graphics);
        islandPanel(g, 0, 0, 76, 68, PAPER);
        g.fillColor = color(GREEN);
        for (let i = 0; i < 32; i++) {
            const angle = i * Math.PI / 16, radius = i % 4 === 0 || i % 4 === 3 ? 22 : 17;
            const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius;
            if (i === 0)
                g.moveTo(px, py);
            else
                g.lineTo(px, py);
        }
        g.close();
        g.fill();
        g.fillColor = color(PAPER);
        g.circle(0, 0, 8);
        g.fill();
        button.on(Node.EventType.TOUCH_START, () => button.setScale(.94, .94, 1));
        button.on(Node.EventType.TOUCH_CANCEL, () => button.setScale(1, 1, 1));
        button.on(Node.EventType.TOUCH_END, () => {
            button.setScale(1, 1, 1);
            this.play('tap');
            this.settings();
        });
    }

    private layout() {
        const bg = this.graphics(this.gameRoot, 'Background');
        this.box(bg, 0, 0, this.screenWidth, this.screenHeight, 0, '#EEF0DD');
        const wallpaper = this.node2d('garden-background', bg.node, 0, 0, this.screenWidth, this.screenHeight).addComponent(Sprite);
        wallpaper.sizeMode = Sprite.SizeMode.CUSTOM;
        this.traySprites.push(wallpaper);
        // Keep all interactive header controls below the WeChat capsule row.
        this.gearButton(this.gameRoot, -300, 670);
        this.levelLabel = this.text(this.gameRoot, '', -177, 670, 30, GREEN, 140);
        this.levelLabel.color = color(INK);
        this.speedLabel = this.button(this.gameRoot, '1×', -54, 670, 100, 56, PAPER, () => this.requestSpeed());
        this.speedLabel.node.setPosition(-13, 1);
        this.speedLabel.fontSize = 24;
        this.speedLabel.enableOutline = false;
        this.speedLabel.color = color('#73573D');
        const speedVideo = this.graphics(this.speedLabel.node.parent!, 'Speed video mark');
        this.speedVideo = speedVideo.node;
        speedVideo.fillColor = color('#907653');
        speedVideo.moveTo(25, -7); speedVideo.lineTo(36, 0); speedVideo.lineTo(25, 7); speedVideo.close(); speedVideo.fill();
        // Enlarge the board and trays together around the board's top edge.
        // Local pixel/flight coordinates stay shared, while the removed action
        // row's space is used by the game rather than left empty at the bottom.
        this.playfield = this.node2d('Playfield', this.gameRoot);
        const scale = Math.min(1.09, (this.screenHeight / 2 - 32 + 626) / (626 + 606));
        this.playfield.setScale(scale, scale, 1);
        const bottom = 606 * scale + 626 * (scale - 1);
        const down = Math.min(40, Math.max(0, this.screenHeight / 2 - bottom - 32));
        this.playfield.setPosition(0, 626 * (1 - scale) - down);
        const frame = this.graphics(this.playfield, 'Artwork frame');
        islandPanel(frame, 0, 235, 632, 782, PAPER);
        this.box(frame, 0, 243, 604, 750, 16, '#D4C9B4');
        for (let row = 0; row < GRID_HEIGHT; row++)
            this.boardRows.push(this.graphics(this.playfield, 'Pixel row ' + row));
        for (let row = 0; row < GRID_HEIGHT; row++)
            this.hintRows.push(this.graphics(this.playfield, 'Whole picture highlight ' + row));
        this.nestArt = this.graphics(this.playfield, 'Shared ant nest');
        // Opening centre is (46,22) inside the 104×60 sprite, not its midpoint.
        this.nestSprite = this.node2d('Wooden delivery entrance', this.nestArt.node, NEST.x + 6, NEST.y - 8, 104, 60).addComponent(Sprite);
        this.nestSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.drawNest();
        this.woodTray('Collection tray', COLLECTION_SLOT_Y, 144);
        this.jars = this.node2d('Slots', this.playfield);
        this.woodTray('Container shelf', -482, 224);
        const acorn = this.node2d('acorn', this.playfield, 292, -554, 104, 85).addComponent(Sprite);
        acorn.sizeMode = Sprite.SizeMode.CUSTOM;
        this.traySprites.push(acorn);
        // Transient feedback shares the header; the shelf has no permanent caption row.
        this.queueCount = this.text(this.gameRoot, '', 170, 670, 25, MUTED, 300);
        this.queue = this.node2d('Containers', this.playfield);
        this.expansionBoard = this.node2d('Unlock extra collection slot', this.playfield, EXTRA_SLOT_X, EXTRA_SLOT_Y, 110, this.touchSize / scale);
        const expansion = this.expansionBoard.addComponent(Graphics);
        this.box(expansion, 0, -4, 94, 58, 16, '#C9AF83');
        this.box(expansion, 0, 0, 94, 58, 16, '#F8F4E5');
        expansion.strokeColor = color('#DEC79F');
        expansion.lineWidth = 2;
        expansion.roundRect(-46, -28, 92, 56, 15);
        expansion.stroke();
        expansion.fillColor = color('#9B805B');
        expansion.roundRect(-11, 6, 22, 4, 2);
        expansion.fill();
        expansion.roundRect(-2, -3, 4, 22, 2);
        expansion.fill();
        // Small video mark explains the unlock.
        expansion.strokeColor = color('#9B805B');
        expansion.lineWidth = 1.5;
        expansion.roundRect(-13, -23, 26, 14, 4);
        expansion.stroke();
        expansion.fillColor = color('#9B805B');
        expansion.moveTo(-3, -20); expansion.lineTo(5, -16); expansion.lineTo(-3, -12); expansion.close(); expansion.fill();
        this.expansionBoard.on(Node.EventType.TOUCH_START, () => this.expansionBoard.setScale(.96, .96, 1));
        this.expansionBoard.on(Node.EventType.TOUCH_CANCEL, () => this.expansionBoard.setScale(1, 1, 1));
        this.expansionBoard.on(Node.EventType.TOUCH_END, () => {
            this.expansionBoard.setScale(1, 1, 1);
            if (!this.modal && !this.home && !this.paused) this.requestSlotExpansion();
        });
        this.effects = this.graphics(this.playfield, 'Ant couriers');
    }

    private woodTray(name: string, y: number, height: number) {
        const shadow = this.graphics(this.playfield, name);
        for (let layer = 5; layer >= 1; layer--) {
            shadow.fillColor = new Color(115, 79, 36, 9);
            shadow.roundRect(-337 - layer, y - height / 2 - 4 - layer * 2, 674 + layer * 2, height + layer * 2, 60);
            shadow.fill();
        }
        const sprite = this.node2d('wood', shadow.node, 0, y, 674, height).addComponent(Sprite);
        sprite.type = Sprite.Type.SLICED;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.traySprites.push(sprite);
    }

    private drawNest() {
        const g = this.nestArt;
        g.clear();
        if (this.nestFrames.length) {
            this.nestSprite.spriteFrame = this.nestFrames[SKINS.findIndex(s => s.id === this.save.nest)];
            return;
        }
        const skin = SKINS.find(s => s.id === this.save.nest)!;
        g.fillColor = new Color(48, 38, 25, 45);
        g.ellipse(3, NEST.y - 6, 34, 18);
        g.fill();
        g.fillColor = color(skin.rim);
        g.ellipse(0, NEST.y, 31, 18);
        g.fill();
        g.fillColor = color(skin.light);
        g.ellipse(-1, NEST.y + 3, 28, 15);
        g.fill();
        g.fillColor = color('#73573D');
        g.ellipse(0, NEST.y + 2, 22, 12);
        g.fill();
        g.fillColor = color('#2E241C');
        g.ellipse(0, NEST.y, 18, 9);
        g.fill();
    }

    private hideHome() {
        if (this.home) {
            this.home.active = false;
            this.home.destroy();
            this.home = null;
        }
        this.homeScene = null;
        this.homeTitle = null;
        this.homePlayLabel = null;
        this.homeRewardButton = null;
        this.gameRoot.active = true;
    }

    private artwork(parent: Node, index: number, x: number, y: number, width: number, muted = false) {
        const level = makeLevel(index), step = width / level.width, g = this.graphics(parent, 'Artwork preview');
        for (let i = 0; i < level.pixels.length; i++) {
            const c = color(PALETTE[level.pixels[i]]);
            if (muted) {
                const gray = (c.r + c.g + c.b) / 3;
                c.r = c.g = c.b = Math.round(gray * .55 + 90);
            }
            g.fillColor = c;
            g.rect(x - width / 2 + i % level.width * step, y + width * 1.25 / 2 - Math.floor(i / level.width) * step - step, step + .1, step + .1);
            g.fill();
        }
    }

    private homeAsset(parent: Node, name: string, x: number, y: number, w: number, h: number) {
        const sprite = this.node2d(`Home asset ${name}`, parent, x, y, w, h).addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this.homeActionFrames.get(name) ?? null;
    }

    private homePress(node: Node, x: number, y: number, action: () => void) {
        const release = () => {
            node.setPosition(x, y);
            node.setScale(1, 1, 1);
        };
        node.on(Node.EventType.TOUCH_START, () => {
            node.setPosition(x, y - 3);
            node.setScale(.96, .96, 1);
        });
        node.on(Node.EventType.TOUCH_CANCEL, release);
        node.on(Node.EventType.TOUCH_END, () => {
            release();
            this.play('tap');
            action();
        });
    }

    private homeTile(parent: Node, title: string, x: number, kind: 'album' | 'shop' | 'rank', action: () => void) {
        const node = this.node2d(title, parent, x, -406, 184, 180);
        this.homeAsset(node, kind, 0, 20, 152, 136);
        const caption = this.graphics(node, 'Home caption');
        this.box(caption, 0, -65, 142, 46, 23, '#FFF7DF');
        this.text(node, title, 0, -65, 27, '#4E6239', 136);
        this.homePress(node, x, -406, () => {
            if (this.cloudMode && !this.cloudReady) return;
            action();
        });
    }

    private showHome(keepModal = false) {
        this.clearPreview();
        if (!keepModal) this.closeModal();
        if (this.home) {
            this.home.active = false;
            this.home.destroy();
        }
        this.gameRoot.active = false;
        const resume = this.model && !this.won && !this.model.blocked && (!this.cloudMode || this.cloudRunId.length > 0);
        const target = !resume && this.save.completed.includes(this.save.selected) ? this.save.unlocked : this.save.selected;
        const n = this.node2d('Home', this.root);
        this.home = n;
        const background = this.graphics(n, 'Home background');
        this.box(background, 0, 0, this.screenWidth, this.screenHeight, 0, '#BFE3BF');
        this.homeScene = this.node2d('Garden landscape', n, 0, 0, this.screenWidth, this.screenHeight).addComponent(Sprite);
        this.homeScene.sizeMode = Sprite.SizeMode.CUSTOM;
        this.homeScene.spriteFrame = this.homeFrame;
        this.courtyardNode = null;
        this.refreshCourtyard();
        const g = this.graphics(n, 'Home controls');
        this.box(g, 216, 633, 214, 60, 30, PAPER);
        this.text(n, this.cloudMode && !this.cloudReady ? '金币  …' : `金币  ${this.save.coins}`, 216, 633, 25, INK, 195).isBold = false;
        this.button(n, '收藏', -163, 633, 104, 60, PAPER, () => this.favoriteGuide());
        this.gearButton(n, -286, 633);
        this.homeTitle = this.node2d('Home title', n, 0, 493, 560, 560 / 3).addComponent(Sprite);
        this.homeTitle.sizeMode = Sprite.SizeMode.CUSTOM;
        this.homeTitle.spriteFrame = this.homeTitleFrame;
        // The landscape is the focal point; keep the playable artwork as a small print.
        const painting = this.node2d('Home painting', n, 250, 315, 124, 155);
        painting.angle = -3;
        const frame = this.graphics(painting, 'Painting border');
        islandPanel(frame, 0, 0, 124, 155, PAPER);
        this.artwork(painting, target, 0, 0, 110);
        // Keep all home actions together; conditional rewards never shift controls.
        const playY = -235;
        const playNode = this.node2d(resume ? '继续游戏' : '开始游戏', n, 0, playY, 630, 122);
        this.homeAsset(playNode, 'play', 0, 0, 630, 100);
        const playLabel = this.text(playNode, this.cloudMode && !this.cloudReady ? '正在同步进度…' : resume ? '继续游戏' : '开始游戏', 0, 2, 34, INK, 500);
        this.homePlayLabel = playLabel;
        playLabel.color = color('#245844');
        const tag = this.node2d('Level paper tag', playNode, 0, 48, 154, 42);
        const tagArt = tag.addComponent(Graphics);
        islandPanel(tagArt, 0, 0, 154, 42, '#FFF6D8');
        const tagText = this.text(tag, this.cloudMode && !this.cloudReady ? '加载中' : `第 ${target + 1} 关`, 0, 0, 23, INK, 140);
        tagText.color = color('#795D38');
        tagText.enableOutline = false;
        this.homePress(playNode, 0, playY, () => {
            if (this.cloudMode && (this.cloudBusy || !this.cloudReady)) return;
            if (resume) {
                this.closeModal();
                this.hideHome();
            }
            else
                this.startLevel(target);
        });
        this.homeTile(n, '关卡', -220, 'album', () => this.levelPicker());
        this.homeTile(n, '装修', 0, 'shop', () => this.shop());
        this.homeTile(n, '排行榜', 220, 'rank', () => this.leaderboard());
        const rewards = rewardAmount(this.save, this.rewardDay());
        this.homeRewardButton = null;
        if (rewards > 0 && (!this.cloudMode || this.cloudReady)) {
            this.homeRewardButton = this.button(n, `领取奖励  +${rewards} 金币`, 0, -585, 630, 68, '#FFF8E0', () => {
                if (this.cloudMode) {
                    this.claimCloudRewards();
                    return;
                }
                const day = this.rewardDay(), amount = rewardAmount(this.save, day);
                if (amount > 0) {
                    claimRewards(this.save, day);
                    this.persist();
                }
                this.showHome();
                if (amount > 0)
                    this.notify('奖励已收下', `${amount} 金币已经放进你的小窝`, 'success');
            }).node.parent!;
        }
        if (this.courtyardShopContent && this.courtyardPreview)
            this.shop(this.courtyardPreview.slot, this.courtyardPreview.id);
        else if (this.nestShopContent)
            this.nestShop();
        this.refreshCloudStatus();
        if (this.modal) this.modal.setSiblingIndex(998);
        if (this.notification)
            this.notification.node.setSiblingIndex(999);
    }

    private favoriteGuide() {
        const n = this.openModal('收藏生态蚂蚁窝', '下次从微信「我的小程序」快速回来', 460);
        this.text(n, '1. 点击微信右上角「···」', 0, 52, 26);
        this.text(n, '2. 在菜单里选择「添加到我的小程序」', 0, 2, 24);
        this.text(n, '需要在微信中操作，本页不会自动添加', 0, -58, 21, MUTED);
        this.button(n, '知道了', 0, -151, 470, 68, GREEN, () => this.closeModal(), '#FFFFFF');
    }
    private levelPicker(page = Math.floor(this.save.selected / 10)) {
        const pageCount = Math.ceil(LEVEL_COUNT / 10);
        page = Math.max(0, Math.min(page, pageCount - 1));
        const gap = Math.max(100, this.touchSize + 4), height = 840 + 7 * (gap - 100);
        const top = height / 2 - 180;
        const n = this.openModal('选择关卡', `第 ${page + 1} / ${pageCount} 页 · 已通关关卡可再次挑战`, height);
        const start = page * 10;
        for (let i = start; i < Math.min(start + 10, LEVEL_COUNT); i++) {
            const local = i - start;
            const column = local % 2, row = Math.floor(local / 2), x = column ? 155 : -155, y = top - row * gap;
            const unlocked = i <= this.save.unlocked, completed = this.save.completed.includes(i);
            const label = completed ? `第 ${i + 1} 关 · 已通关` : unlocked ? `第 ${i + 1} 关 · 可挑战` : `第 ${i + 1} 关 · 未解锁`;
            this.button(n, label, x, y, 286, 78, unlocked ? (completed ? '#E8FAF5' : '#FFF8E8') : '#EEEDE6', unlocked ? () => this.confirmLevel(i, page) : () => this.notify('关卡未解锁', '前一关完成后才能挑战', 'info'), unlocked ? INK : MUTED);
        }
        if (page > 0)
            this.button(n, '上一页', -155, top - 5 * gap, 260, 62, PAPER, () => this.levelPicker(page - 1));
        if (page + 1 < pageCount)
            this.button(n, '下一页', 155, top - 5 * gap, 260, 62, PAPER, () => this.levelPicker(page + 1));
        this.button(n, '返回', 0, top - 6 * gap, 500, 68, GREEN, () => this.closeModal(), '#FFFFFF');
    }

    private confirmLevel(index: number, page = Math.floor(index / 10)) {
        if (this.model && !this.won && this.model.moves > 0) {
            const n = this.openModal('开始新的挑战？', '当前关卡将重新开始，已获得的收藏保留', 350);
            this.button(n, '选择关卡', -142, -74, 240, 65, PAPER, () => this.levelPicker(page));
            this.button(n, '开始挑战', 142, -74, 240, 65, GREEN, () => this.startLevel(index), '#FFFFFF');
        }
        else
            this.startLevel(index);
    }

    private leaderboard(page = 0) {
        if (this.cloudMode) {
            this.worldLeaderboard(page);
            return;
        }
        const records = [...this.save.best].sort((a, b) => a.seconds - b.seconds);
        const gap = Math.max(100, this.touchSize + 4);
        const n = this.openModal('排行榜', '本机速通榜 · 按每关最佳用时排序', 760 + 2 * (gap - 100));
        if (!records.length) {
            this.text(n, '还没有通关成绩', 0, 80, 30);
            this.text(n, '完成一幅作品后，成绩会记录在这里', 0, 28, 23, MUTED);
        }
        records.slice(page * 6, page * 6 + 6).forEach((r, i) => this.text(n, `${page * 6 + i + 1}.  ${makeLevel(r.level).name}    ${Math.floor(r.seconds / 60)}分${Math.floor(r.seconds % 60)}秒`, 0, 165 - i * 61, 25, INK, 550));
        if (page > 0)
            this.button(n, '上一页', -190, -205, 150, 48, PAPER, () => this.leaderboard(page - 1));
        if ((page + 1) * 6 < records.length)
            this.button(n, '下一页', 190, -205, 150, 48, PAPER, () => this.leaderboard(page + 1));
        this.text(n, '仅展示本机真实记录，未接入联网排名', 0, -252, 21, MUTED);
        this.button(n, '返回', 0, -205 - gap, 480, 64, GREEN, () => this.closeModal(), '#FFFFFF');
    }

    private rewards() {
        const day = this.rewardDay(), amount = rewardAmount(this.save, day), unclaimed = this.save.completed.filter(i => !this.save.claimed.includes(i)).length;
        const n = this.openModal('收集奖励', '金币可以在商店兑换小窝装扮', 570);
        this.text(n, `今日来访    ${this.save.daily === day ? '已领取' : '+30 金币'}`, 0, 80, 28);
        this.text(n, `画作首通    ${unclaimed} 幅 × 100 金币`, 0, 24, 28);
        this.text(n, amount ? `可领取 ${amount} 金币` : '奖励已领完，完成新画作再来吧', 0, -50, 25, '#366650');
        this.button(n, amount ? '领取全部' : '返回主页', 0, -167, 470, 76, GREEN, () => {
            if (this.cloudMode) {
                this.claimCloudRewards();
                return;
            }
            if (amount) {
                claimRewards(this.save, day);
                this.persist();
            }
            this.showHome();
            if (amount)
                this.notify('奖励已收下', `${amount} 金币已经放进你的小窝`, 'success');
        }, '#FFFFFF');
    }

    private refreshCourtyard() {
        if (!this.home) return;
        if (this.courtyardNode) {
            this.courtyardNode.active = false;
            this.courtyardNode.destroy();
        }
        this.courtyardNode = renderCourtyard(this.home, this.save.courtyard, this.furnishingFrames,
            this.screenWidth, this.screenHeight, this.courtyardPreview);
        this.courtyardNode.setSiblingIndex(2);
        let previewOffset = this.courtyardPreview
            ? courtyardPreviewOffset(this.courtyardPreview.slot, this.screenWidth, this.screenHeight,
                courtyardShopLayout(this.touchSize).height)
            : 0;
        const closing = this.drawerMotion;
        if (closing?.closing && closing.previewFrom !== undefined) {
            const remaining = Math.pow(1 - Math.min(1, closing.elapsed / .36), 3);
            previewOffset = closing.previewFrom * remaining;
        }
        this.courtyardNode.setPosition(0, previewOffset);
        this.homeScene!.node.setPosition(0, previewOffset);
        if (this.homeTitle) this.homeTitle.node.active = !this.courtyardPreview;
        const painting = this.home.children.find(node => node.name === 'Home painting');
        if (painting) painting.active = !this.courtyardPreview;
    }

    private shop(slot: CourtyardSlot = 'entrance', itemId?: string) {
        if (this.courtyardShopContent && this.drawerMotion?.closing) return;
        if (!this.home) this.showHome();
        const items = FURNISHINGS.filter(item => item.slot === slot);
        const selected = items.find(item => item.id === itemId) || items.find(item => !this.save.courtyard.owned.includes(item.id)) || items[0];
        const layout = courtyardShopLayout(this.touchSize);
        // Keep the sheet and its motion alive when only the selection changes.
        const sheet = this.courtyardShopContent
            ? this.drawerSheet!
            : this.openDrawer('装修我的小窝', '', layout.height);
        if (this.courtyardShopContent) {
            this.courtyardShopContent.active = false;
            this.courtyardShopContent.destroy();
        }
        const n = this.node2d('Courtyard shop content', sheet);
        this.courtyardShopContent = n;
        this.drawerSubtitle!.string = `金币 ${this.save.coins} · 点选装饰看效果`;
        this.lastCourtyardSelection = selected;
        this.courtyardPreview = selected;
        this.refreshCourtyard();
        renderCourtyardShop(n, this.save, slot, selected, this.furnishingFrames,
            { text: this.text.bind(this), button: this.button.bind(this) }, {
                select: (category, item) => { if (!this.cloudBusy) this.shop(category, item); },
                purchase: item => this.purchaseFurnishing(item),
                clear: category => this.clearFurnishing(category),
                nests: () => this.nestShop(),
            }, this.touchSize);
        this.refreshCloudStatus();
    }

    private purchaseFurnishing(item: Furnishing) {
        if (this.cloudBusy) return;
        if (!this.save.courtyard.owned.includes(item.id) && this.save.coins < item.price) {
            this.notify('再攒一点就能买到', `还差 ${item.price - this.save.coins} 金币，通关后到主页领取奖励`, 'warning');
            return;
        }
        const finish = () => {
            if (this.home) this.showHome(true);
            this.notify('小窝添了新模样', `已布置「${item.name}」`, 'success');
        };
        if (this.cloudMode) {
            if (!this.cloudReady) return;
            this.cloudTask(() => this.cloud!.mutate('furnish', { item: item.id }), state => {
                this.applyCloudState(state);
                finish();
            }, '正在布置庭院…');
        } else {
            buyOrEquipFurnishing(this.save, item.id);
            this.persist();
            finish();
        }
    }

    private clearFurnishing(slot: CourtyardSlot) {
        if (this.cloudBusy) return;
        const view = this.modal;
        const finish = () => {
            if (this.modal === view) this.showHome();
            else if (this.home) this.showHome(true);
            this.notify('装饰已收好', `${SLOT_NAMES[slot]}的装饰已收好，可免费再次布置`, 'success');
        };
        if (this.cloudMode) {
            if (!this.cloudReady) return;
            this.cloudTask(() => this.cloud!.mutate('unfurnish', { slot }), state => {
                this.applyCloudState(state);
                finish();
            }, '正在收好装饰…');
        } else {
            this.save.courtyard.equipped[slot] = '';
            this.persist();
            finish();
        }
    }

    private nestShop() {
        if (this.nestShopContent && this.drawerMotion?.closing) return;
        const gap = Math.max(130, this.touchSize + 12);
        const height = 832 + 4 * (gap - 130);
        const sheet = this.nestShopContent ? this.drawerSheet! : this.openDrawer('洞口装扮', '', height);
        if (this.nestShopContent) {
            this.nestShopContent.active = false;
            this.nestShopContent.destroy();
        }
        const n = this.node2d('Nest shop content', sheet);
        this.nestShopContent = n;
        this.drawerSubtitle!.string = `金币 ${this.save.coins} · 更换局内洞口装饰`;
        SKINS.forEach((skin, i) => {
            const y = height / 2 - 252 - i * gap, g = this.graphics(n);
            this.box(g, 0, y, 620, 112, 20, PAPER);
            this.box(g, -203, y, 92, 86, 20, skin.light);
            if (this.nestFrames[i]) {
                const thumbnail = this.node2d('Wooden nest sample', n, -200, y, 84, 48).addComponent(Sprite);
                thumbnail.sizeMode = Sprite.SizeMode.CUSTOM;
                thumbnail.spriteFrame = this.nestFrames[i];
            } else {
                g.fillColor = color(skin.rim);
                g.ellipse(-203, y, 32, 20);
                g.fill();
                g.fillColor = color('#2E241C');
                g.ellipse(-203, y, 21, 12);
                g.fill();
            }
            this.text(n, skin.name, -40, y + 19, 26, INK, 210);
            this.text(n, this.save.owned.includes(skin.id) ? '已拥有' : `${skin.price} 金币`, -40, y - 20, 24, MUTED, 210);
            const equipped = this.save.nest === skin.id;
            this.button(n, equipped ? '使用中' : this.save.owned.includes(skin.id) ? '使用' : '兑换', 191, y, 130, 67, equipped ? '#E8FAF5' : GREEN, () => {
                if (equipped || this.cloudBusy || this.drawerMotion?.closing) return;
                const finish = () => {
                    this.drawNest();
                    if (this.home) this.showHome(true);
                    else if (this.nestShopContent) this.nestShop();
                    this.notify('小窝焕然一新', `已换上「${skin.name}」`, 'success');
                };
                if (this.cloudMode) {
                    if (!this.cloudReady) return;
                    this.cloudTask(() => this.cloud!.mutate('shop', { skin: skin.id }), state => {
                        this.applyCloudState(state);
                        finish();
                    }, '正在更新装扮…');
                    return;
                }
                const result = buyOrEquip(this.save, skin.id);
                if (result === 'insufficient') {
                    this.notify('金币还差一点', '先领取奖励，或完成一幅新画作', 'warning');
                    return;
                }
                this.persist();
                finish();
            }, equipped ? INK : '#FFFFFF');
        });
        this.button(n, '返回装修', 0, height / 2 - 252 - gap * 4, 480, 64, PAPER, () => {
            const selected = this.lastCourtyardSelection;
            this.shop(selected?.slot, selected?.id);
        });
        this.refreshCloudStatus();
    }

    private startLevel(index: number) {
        if (this.cloudMode) {
            if (!this.cloudReady) return;
            this.cloudTask(() => this.cloud!.mutate('start', { level: index }), state => {
                this.applyCloudState(state);
                this.cloudRunId = state.output.runId!;
                this.enterLevel(index);
            }, '正在准备关卡…');
            return;
        }
        this.enterLevel(index);
    }

    private enterLevel(index: number) {
        this.pendingVictory = false;
        if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT || index > this.save.unlocked) {
            this.notify('关卡未解锁', '前一关完成后才能挑战', 'info');
            return;
        }
        this.clearPreview();
        this.closeModal();
        this.hideHome();
        this.save.selected = index;
        this.levelLabel.string = `第 ${index + 1} 关`;
        this.persist();
        this.model = new GardenModel(makeLevel(index));
        this.routeBoard.width = this.model.level.width;
        this.routeBoard.height = this.model.level.height;
        this.routeBoard.pixels = this.model.pixels;
        for (const trip of this.flights)
            this.releaseAnt(trip.visual);
        this.flights = [];
        this.dispatchClocks.fill(0);
        this.dispatchJarIds.fill(-1);
        this.elapsed = 0;
        this.won = false;
        this.speed = 1;
        this.speedUnlocked = false;
        this.finishing = false;
        this.speedLabel.string = '1×';
        this.speedLabel.node.setPosition(-13, 1);
        this.speedVideo.active = true;
        this.updateExpansionBoard();
        this.effects.clear();
        this.drawBoard();
        this.slotViews.forEach(v => {
            v.id = -2;
            v.launchElapsed = -1;
            v.entryElapsed = -1;
            v.exitElapsed = -1;
            v.exit.active = false;
            v.opacity.opacity = 255;
            v.container.angle = 0;
            v.container.setPosition(0, 0);
            v.container.setScale(1, 1, 1);
        });
        this.cardViews.forEach(v => {
            v.id = -1;
            v.node.active = false;
        });
        this.drawSlots();
        this.drawQueue();
        if (!this.controlsSeen) this.controlsGuide();
    }

    private drawBoard(rows?: Set<number>) {
        const { width, height } = this.model.level;
        for (let row = 0; row < height; row++) {
            if (rows && !rows.has(row))
                continue;
            const g = this.boardRows[row];
            g.clear();
            for (let column = 0; column < width; column++) {
                const c = this.model.pixels[row * width + column];
                if (c < 0)
                    continue;
                const bottomExposed = row === height - 1 || this.model.pixels[(row + 1) * width + column] < 0;
                const rightExposed = column === width - 1 || this.model.pixels[row * width + column + 1] < 0;
                this.boardPixel(g, BOARD_LEFT + column * CELL_SIZE, BOARD_TOP - row * CELL_SIZE, PALETTE[c], bottomExposed, rightExposed);
            }
        }
    }

    private acquireAnt(c: number): AntVisual {
        let visual = this.antPool.find(v => !v.node.active && v.color === c) || this.antPool.find(v => !v.node.active);
        if (!visual) {
            const node = this.node2d('Ant worker', this.effects.node);
            visual = { node, frames: [], cargo: this.node2d('Carried pixel', node), color: -1, frame: 0, body: null, cargoSprite: null, bodyDetail: null, cargoDetail: null };
            if (!this.antFrames.length)
                for (let i = 0; i < 3; i++)
                    visual.frames.push(this.node2d('Walk frame ' + i, node));
            visual.cargo.setSiblingIndex(3);
            this.antPool.push(visual);
        }
        if (visual.color !== c) {
            visual.color = c;
            if (this.antFrames.length)
                this.useAntAtlas(visual);
            else {
                visual.frames.forEach((n, i) => {
                    const g = n.getComponent(Graphics) || n.addComponent(Graphics);
                    g.clear();
                    this.drawAnt(g, 0, 0, 0, i * .084, 1, PALETTE[c]);
                });
                const cargo = visual.cargo.getComponent(Graphics) || visual.cargo.addComponent(Graphics);
                cargo.clear();
                this.boardPixel(cargo, -CELL_SIZE / 2, CELL_SIZE / 2, PALETTE[c]);
            }
        }
        visual.node.active = true;
        visual.cargo.active = false;
        visual.cargo.setPosition(CELL_SIZE, 0);
        visual.cargo.angle = 0;
        visual.frames.forEach((n, i) => n.active = i === 0);
        visual.frame = 0;
        if (visual.body) {
            visual.body.spriteFrame = this.antFrames[0];
            visual.bodyDetail!.spriteFrame = this.antFrames[4];
        }
        return visual;
    }

    private useAntAtlas(visual: AntVisual) {
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
                visual.cargo = this.node2d('Carried pixel', visual.node, old.position.x, old.position.y, 32, 32);
                visual.cargo.angle = old.angle;
                visual.cargo.active = old.active;
                old.active = false;
                old.destroy();
            }
            visual.body = this.node2d('Ant sprite', visual.node, 0, 0, 32, 32).addComponent(Sprite);
            visual.body.sizeMode = Sprite.SizeMode.CUSTOM;
            visual.body.node.setSiblingIndex(0);
            visual.cargo.getComponent(UITransform)!.setContentSize(32, 32);
            visual.cargoSprite = visual.cargo.addComponent(Sprite);
            visual.cargoSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            visual.bodyDetail = this.node2d('Ant details', visual.body.node, 0, 0, 32, 32).addComponent(Sprite);
            visual.bodyDetail.sizeMode = Sprite.SizeMode.CUSTOM;
            visual.cargoDetail = this.node2d('Pixel details', visual.cargo, 0, 0, 32, 32).addComponent(Sprite);
            visual.cargoDetail.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        visual.body.spriteFrame = this.antFrames[visual.frame];
        visual.bodyDetail!.spriteFrame = this.antFrames[4 + visual.frame];
        visual.cargoSprite!.spriteFrame = this.antFrames[3];
        visual.cargoDetail!.spriteFrame = this.antFrames[7];
        visual.body.color = color(PALETTE[visual.color]);
        visual.cargoSprite!.color = color(PALETTE[visual.color]);
    }

    private releaseAnt(visual: AntVisual) {
        visual.node.active = false;
    }

    private jar(g: Graphics, j: Jar, x: number, y: number, w = 108, h = 84) {
        const base = color(PALETTE[j.color]);
        const shade = new Color(Math.round(base.r * .72), Math.round(base.g * .72), Math.round(base.b * .72), 255);
        g.fillColor = new Color(78, 57, 33, 35);
        g.ellipse(x + 3, y - h / 2 - 4, w * .49, 7);
        g.fill();
        g.fillColor = shade;
        g.roundRect(x - w / 2, y - h / 2 - 2, w, h, 18);
        g.fill();
        this.box(g, x - 1, y + 2, w - 3, h - 3, 18, PALETTE[j.color]);
        g.fillColor = new Color(255, 245, 216, 42);
        g.roundRect(x - w / 2 + 5, y + h / 2 - 20, w - 12, 16, 8);
        g.fill();
        this.box(g, x, y - 7, w * .68, h * .57, 14, '#E2CAA0');
        this.box(g, x - 1, y - 5, w * .68 - 2, h * .57 - 2, 13, '#FFF0CF');
        this.box(g, x, y + h / 2 - 9, w * .57, 15, 7, '#93713F');
        this.box(g, x, y + h / 2 - 11, w * .52, 10, 5, '#392A19');
    }

    private containerSprite(parent: Node, w: number, h: number) {
        const sprite = this.node2d('Rounded box texture', parent, 0, 0, w, h).addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.node.active = false;
        const detail = this.node2d('Container details', sprite.node, 0, 0, w, h).addComponent(Sprite);
        detail.sizeMode = Sprite.SizeMode.CUSTOM;
        this.containerDetails.set(sprite, detail);
        return sprite;
    }

    private applyContainerMaterial(sprite: Sprite, index: number) {
        sprite.spriteFrame = this.containerFrames[0];
        sprite.color = color(PALETTE[index]);
        sprite.node.active = true;
        this.containerDetails.get(sprite)!.spriteFrame = this.containerFrames[1];
    }

    private containerNumber(label: Label) {
        this.containerLabels.add(label);
        if (this.containerFont)
            label.font = this.containerFont;
        label.color = color('#49311E');
        label.enableOutline = false;
        label.isBold = false;
        label.node.setPosition(containerNumberOffset(label.string, label.fontSize), -4);
    }

    private containerShadow(g: Graphics) {
        g.fillColor = new Color(80, 62, 36, 18);
        g.ellipse(2, -34, 43, 6);
        g.fill();
        g.fillColor = new Color(80, 62, 36, 20);
        g.ellipse(1, -33, 34, 3);
        g.fill();
    }

    private drawSlots() {
        for (let i = this.model.slots.length; i < this.slotViews.length; i++)
            this.slotViews[i].art.node.active = false;
        for (let i = 0; i < this.model.slots.length; i++) {
            let view = this.slotViews[i];
            if (!view) {
                const node = this.node2d('Collection slot ' + i, this.jars, collectionSlotX(i, this.model.slots.length), collectionSlotY(i), 110, Math.max(96, this.touchSize / this.playfield.scale.y));
                const art = node.addComponent(Graphics);
                const container = this.node2d('Dispatch container', node, 0, 0, 110, 96);
                const body = container.addComponent(Graphics);
                const sprite = this.containerSprite(container, 102, 90);
                const label = this.text(container, '', 0, -5, 32, INK, 58);
                this.containerNumber(label);
                const opacity = container.addComponent(UIOpacity);
                const exit = this.node2d('Departing container', node, 0, 0, 110, 96);
                const exitBody = exit.addComponent(Graphics);
                const exitSprite = this.containerSprite(exit, 102, 90);
                const exitOpacity = exit.addComponent(UIOpacity);
                exit.active = false;
                view = { art, label, id: -2, container, body, sprite, color: -1, launchElapsed: -1,
                    entryElapsed: -1, opacity, exit, exitBody, exitSprite, exitOpacity, exitElapsed: -1 };
                this.slotViews.push(view);
                this.slotLabels.push(label);
                node.on(Node.EventType.TOUCH_START, () => {
                    const jar = this.model.slots[i];
                    if (jar)
                        this.beginPreview(node, jar.color, () => this.model.slots[i]?.id === jar.id);
                });
                node.on(Node.EventType.TOUCH_END, () => this.endPreview(node));
                node.on(Node.EventType.TOUCH_CANCEL, () => this.endPreview(node));
                node.on(Node.EventType.TOUCH_MOVE, (e: {
                    getUILocation: () => {
                        x: number;
                        y: number;
                    };
                    getUIStartLocation: () => {
                        x: number;
                        y: number;
                    };
                }) => this.movePreview(node, e));
            }
            view.art.node.active = true;
            view.art.node.setPosition(collectionSlotX(i, this.model.slots.length), collectionSlotY(i));
            const jar = this.model.slots[i], id = jar ? jar.id : -1;
            // Slot geometry changes only when a jar enters or leaves, never on count updates.
            if (view.id !== id) {
                view.id = id;
                view.launchElapsed = -1;
                view.entryElapsed = -1;
                view.opacity.opacity = 255;
                view.container.angle = 0;
                view.container.setPosition(0, 0);
                view.container.setScale(1, 1, 1);
                view.container.active = !!jar;
                view.body.clear();
                view.sprite.node.active = false;
                const g = view.art;
                g.clear();
                // Each slot has a recessed, handmade tray with a soft rim and a
                // tiny highlight. This keeps the five positions readable when
                // the contents change without turning them into plain buttons.
                if (i >= 5) {
                    this.box(g, 0, -4, 94, 58, 16, '#C9AF83');
                    this.box(g, 0, 0, 94, 58, 16, '#F8F4E5');
                }
                if (!jar && i < 5) {
                    this.box(g, 0, -4, 84, 48, 15, '#D9D5B6');
                    this.box(g, 0, 0, 84, 48, 15, '#F8FBF1');
                    g.fillColor = new Color(255, 255, 255, 150);
                    g.roundRect(-33, 13, 66, 5, 2.5);
                    g.fill();
                }
                if (jar) {
                    this.containerShadow(g);
                    view.color = jar.color;
                    if (this.containerFrames[0]) {
                        this.applyContainerMaterial(view.sprite, jar.color);
                    }
                    else
                        this.jar(view.body, jar, 0, 0, 92, 70);
                }
            }
            view.label.string = jar ? String(this.model.undispatched(i)) : '';
            if (jar)
                this.containerNumber(view.label);
            else {
                view.label.color = color('#A8B99C');
                view.label.isBold = false;
                view.label.enableOutline = false;
            }
        }
    }

    private drawQueue() {
        const visible = this.model.visibleQueue;
        this.queueCount.string = this.queueCaption();
        const active = new Set(visible.map(v => v.jar.id));
        for (const v of this.cardViews)
            if (!active.has(v.id)) {
                v.node.active = false;
                v.id = -1;
                this.resetCardMotion(v);
            }
        for (const { jar, column, row } of visible) {
            let v = this.cardViews.find(v => v.id === jar.id);
            const retained = !!v;
            if (!v)
                v = this.cardViews.find(v => v.id === -1);
            if (!v) {
                const node = this.node2d('Queue card', this.queue, 0, 0, 112, Math.max(72, this.touchSize / this.playfield.scale.y));
                const motion = this.node2d('Selection motion', node, 0, 0, 112, 72);
                const art = motion.addComponent(Graphics);
                const sprite = this.containerSprite(motion, 102, 90);
                const label = this.text(motion, '', 0, -5, 32, INK, 58);
                this.containerNumber(label);
                v = { node, motion, selectElapsed: -1, art, sprite, label, id: -1, row: 0, column: 0, targetY: 0 };
                const card = v;
                node.on(Node.EventType.TOUCH_START, () => {
                    const jar = this.model.columns[card.column][card.row];
                    if (!jar || jar.id !== card.id)
                        return;
                    this.beginPreview(node, jar.color, () => card.id === jar.id && this.model.columns[card.column][card.row]?.id === jar.id);
                    if (this.hold?.node === node) card.selectElapsed = 0;
                });
                node.on(Node.EventType.TOUCH_MOVE, (e: {
                    getUILocation: () => {
                        x: number;
                        y: number;
                    };
                    getUIStartLocation: () => {
                        x: number;
                        y: number;
                    };
                }) => this.movePreview(node, e));
                node.on(Node.EventType.TOUCH_CANCEL, () => {
                    this.endPreview(node);
                    node.setScale(1, 1, 1);
                });
                node.on(Node.EventType.TOUCH_END, () => {
                    node.setScale(1, 1, 1);
                    if (this.endPreview(node))
                        return;
                    if (card.id < 0 || this.modal || this.home || this.won || this.cloudBusy) return;
                    if (card.row !== 0) {
                        this.notify('下一排预览', '先选走同列上方容器；长按可以找同色', 'info');
                        return;
                    }
                    const slot = this.model.place(card.id);
                    if (slot < 0) {
                        this.notify('收集槽已满', '等小蚂蚁出发完，再选择新的容器', 'warning');
                        return;
                    }
                    this.play('tap');
                    this.drawSlots();
                    const placed = this.slotViews[slot];
                    placed.entryElapsed = 0;
                    this.applyContainerPose(placed.container, placed.opacity, 0, ENTRY_POSES);
                    this.drawQueue();
                });
                this.cardViews.push(v);
            }
            if (v.id !== jar.id) {
                v.art.clear();
                v.sprite.node.active = !!this.containerFrames[0];
                if (this.containerFrames[0]) {
                    this.containerShadow(v.art);
                    this.applyContainerMaterial(v.sprite, jar.color);
                }
                else
                    this.jar(v.art, jar, 0, 0, 92, 68);
                v.label.string = String(jar.remaining);
                this.containerNumber(v.label);
            }
            const movedColumn = v.column !== column;
            v.id = jar.id;
            v.row = row;
            v.column = column;
            const rowGap = Math.max(72, this.touchSize / this.playfield.scale.y + 4);
            v.targetY = -482 + rowGap / 2 - row * rowGap;
            v.node.active = true;
            const previewScale = row === 1 ? .90 : 1;
            v.sprite.node.setScale(previewScale, previewScale, 1);
            v.label.fontSize = row === 1 ? 30 : 32;
            this.containerNumber(v.label);
            // Existing lower cards slide straight up; other columns stay in place.
            v.node.setPosition(queueColumnX(column), retained && !movedColumn ? v.node.position.y : v.targetY - (row === 1 ? 6 : 0));
            v.node.setScale(1, 1, 1);
        }
    }

    private queueCaption() {
        if (!this.model)
            return '';
        const progress = `已收集 ${Math.floor(this.model.collected / this.model.level.pixels.length * 100)}%`;
        return this.finishing ? `收尾加速 · ${progress}` : progress;
    }

    private requestSpeed() {
        if (this.won || this.rewardAdDemo || this.cloudBusy) return;
        if (this.model.finishing) {
            this.updateFinishing();
            return;
        }
        if (this.speedUnlocked) {
            this.speed = this.speed === 1 ? 2 : 1;
            this.speedLabel.string = `${this.speed}×`;
            return;
        }
        const n = this.openModal('开启二倍速', '观看完整广告后，蚂蚁会以二倍速度工作', 420);
        const status = this.text(n, rewardedVideoConfigured() ? '广告准备中…' : '测试广告 3 秒', 0, 45, 28, INK, 520);
        this.text(n, rewardedVideoConfigured() ? '完整观看视频即可获得' : '当前为测试演示，不会播放真实广告', 0, 0, 24, MUTED, 560);
        this.text(n, '仅本关生效 · 取消不会消耗任何物品', 0, -52, 23, MUTED, 560);
        this.button(n, '取消', 0, -145, 300, 64, PAPER, () => this.closeModal());
        const complete = () => {
            this.speedUnlocked = true;
            this.speed = 2;
            this.speedLabel.string = '2×';
            this.notify('二倍速已开启', '蚂蚁会更快完成搬运', 'success');
        };
        if (rewardedVideoConfigured()) {
            if (this.cloudMode) {
                this.watchCloudAd('speed', complete);
                return;
            }
            showRewardedVideo().then(ok => {
                if (!this.isValid || this.modal !== n) return;
                this.closeModal();
                if (ok) complete();
                else this.notify('广告未完成', '看完广告后才能开启二倍速', 'warning');
            });
            return;
        }
        this.rewardAdDemo = { remaining: 3, label: status, complete };
    }

    private updateExpansionBoard() {
        const expanded = this.model.slots.length - 5;
        this.expansionBoard.active = expanded < EXPANSION_COLUMNS.length;
        if (this.expansionBoard.active)
            this.expansionBoard.setPosition(queueColumnX(EXPANSION_COLUMNS[expanded]), EXTRA_SLOT_Y);
    }

    private requestSlotExpansion() {
        if (this.model.slots.length >= 5 + EXPANSION_COLUMNS.length || this.won || this.rewardAdDemo || this.cloudBusy) return;
        const n = this.openModal('扩展收集槽位', '观看完整广告后增加一个容器位置', 420);
        const status = this.text(n, rewardedVideoConfigured() ? '广告准备中…' : '测试广告 3 秒', 0, 45, 28, INK, 520);
        this.text(n, rewardedVideoConfigured() ? '完整观看视频即可获得' : '当前为测试演示，不会播放真实广告', 0, 0, 24, MUTED, 560);
        this.text(n, '仅本关生效 · 新槽位会出现在托盘上方', 0, -52, 23, MUTED, 560);
        this.button(n, '取消', 0, -145, 300, 64, PAPER, () => this.closeModal());
        const complete = () => {
            this.model.slots.push(null);
            this.dispatchClocks[this.model.slots.length - 1] = 0;
            this.dispatchJarIds[this.model.slots.length - 1] = -1;
            this.drawSlots();
            this.updateExpansionBoard();
            this.notify('收集槽已扩展', `现在可以同时容纳 ${this.model.slots.length} 个容器`, 'success');
        };
        if (rewardedVideoConfigured()) {
            if (this.cloudMode) {
                this.watchCloudAd('slot', complete);
                return;
            }
            showRewardedVideo().then(ok => {
                if (!this.isValid || this.modal !== n) return;
                this.closeModal();
                if (ok) complete();
                else this.notify('广告未完成', '看完广告后才能扩展槽位', 'warning');
            });
            return;
        }
        this.rewardAdDemo = { remaining: 3, label: status, complete };
    }

    private beginPreview(node: Node, c: number, valid: () => boolean) {
        if (this.hold || this.modal || this.home || this.won || this.paused || this.cloudBusy)
            return;
        this.hold = { node, color: c, elapsed: 0, shown: false, valid };
    }

    private movePreview(node: Node, e: {
        getUILocation: () => {
            x: number;
            y: number;
        };
        getUIStartLocation: () => {
            x: number;
            y: number;
        };
    }) {
        if (this.hold?.node !== node)
            return;
        const p = e.getUILocation(), start = e.getUIStartLocation();
        if (Math.hypot(p.x - start.x, p.y - start.y) > 18) {
            node.setScale(1, 1, 1);
            this.clearPreview();
        }
    }

    private endPreview(node: Node): boolean {
        if (this.hold?.node !== node)
            return true;
        const suppress = this.hold.shown || !this.hold.valid();
        this.clearPreview();
        return suppress;
    }

    private clearPreview() {
        for (const card of this.cardViews)
            this.resetCardMotion(card);
        if (this.hold)
            this.hold.node.setScale(1, 1, 1);
        this.hold = null;
        this.hintCounts.fill(0);
        this.hintRows.forEach(g => g.clear());
        if (this.queueCount)
            this.queueCount.string = this.queueCaption();
    }

    private updatePreview(dt: number) {
        const hold = this.hold;
        if (!hold)
            return;
        if (!hold.valid()) {
            this.clearPreview();
            return;
        }
        hold.elapsed += dt;
        if (hold.elapsed < .28)
            return;
        if (!hold.shown) {
            hold.shown = true;
            this.drawPreview();
        }
    }

    private drawPreview(rows?: Set<number>) {
        const hold = this.hold;
        if (!hold?.shown)
            return;
        const { width, height } = this.model.level;
        // Reuse row geometry: a full-board preview is built once, then only rows
        // changed by actual pickups are redrawn. No full-board scan each frame.
        for (let row = 0; row < height; row++) {
            if (rows && !rows.has(row))
                continue;
            const g = this.hintRows[row];
            g.clear();
            let count = 0;
            for (let col = 0; col < width; col++) {
                if (this.model.pixels[row * width + col] !== hold.color)
                    continue;
                count++;
                const x = BOARD_LEFT + col * CELL_SIZE, y = BOARD_TOP - row * CELL_SIZE;
                g.fillColor = new Color(255, 249, 204, 65);
                g.rect(x, y - CELL_SIZE, CELL_SIZE, CELL_SIZE);
                g.fill();
                g.strokeColor = color('#294C43');
                g.lineWidth = 3;
                g.roundRect(x - .3, y - CELL_SIZE + .3, CELL_SIZE, CELL_SIZE, 2);
                g.stroke();
                g.strokeColor = color('#FFF3BC');
                g.lineWidth = 1.5;
                g.roundRect(x - .3, y - CELL_SIZE + .3, CELL_SIZE, CELL_SIZE, 2);
                g.stroke();
            }
            this.hintCounts[row] = count;
        }
        const count = this.hintCounts.reduce((sum, n) => sum + n, 0);
        this.fullFeedback = 0;
        this.queueCount.string = count ? `同色 ${count} 块` : '同色已收集完';
    }

    private updateFinishing() {
        const finishing = this.model.finishing;
        if (finishing === this.finishing) return;
        this.finishing = finishing;
        this.speedLabel.string = `${this.effectiveSpeed}×`;
        this.speedLabel.node.setPosition(finishing ? 0 : -13, 1);
        this.speedVideo.active = !finishing;
    }

    update(dt: number) {
        if (!this.paused) {
            this.updateOverlays(Math.min(dt, .05));
            if (this.music.playing)
                this.music.volume = Math.min(.22, this.music.volume + Math.min(dt, .05) * .18);
        }
        if (this.celebration) {
            if (!this.paused)
                this.updateCelebration(Math.min(dt, .05));
            return;
        }
        if (!this.model || this.paused || this.modal || this.home || this.won || this.cloudBusy)
            return;
        // Tests and level setup can replace the model without going through
        // enterLevel; keep the reusable clearance view aligned with it.
        if (this.routeBoard.pixels !== this.model.pixels) {
            this.routeBoard.width = this.model.level.width;
            this.routeBoard.height = this.model.level.height;
            this.routeBoard.pixels = this.model.pixels;
        }
        this.updatePreview(dt);
        this.elapsed += dt;
        this.updateFinishing();
        dt = Math.min(dt, .05);
        this.updateQueueMotion(dt);
        this.updateContainerTransitions(dt);
        this.dirtyRows.clear();
        this.dispatchAnts(dt);
        this.updateContainerLaunches(dt);
        this.updateFlights(dt);
        if (!this.hold?.shown && this.fullFeedback <= 0) {
            const caption = this.queueCaption();
            if (this.queueCount.string !== caption)
                this.queueCount.string = caption;
        }
        if (this.dirtyRows.size) {
            this.drawBoard(this.dirtyRows);
            this.drawPreview(this.dirtyRows);
        }
        if (this.model.complete)
            this.victory();
        else if (this.model.blocked)
            this.showBlocked();
    }

    private updateQueueMotion(dt: number) {
        for (const card of this.cardViews) {
            if (!card.node.active)
                continue;
            if (card.selectElapsed >= 0) {
                card.selectElapsed += dt;
                this.applyContainerPose(card.motion, null, card.selectElapsed / .2, SELECT_POSES);
                if (card.selectElapsed >= .2) this.resetCardMotion(card);
            }
            const y = card.node.position.y, delta = card.targetY - y;
            if (Math.abs(delta) > .1)
                card.node.setPosition(queueColumnX(card.column), y + delta * Math.min(1, dt * 18));
            else if (delta !== 0)
                card.node.setPosition(queueColumnX(card.column), card.targetY);
        }
        if (this.fullFeedback > 0) {
            this.fullFeedback -= dt;
            if (this.fullFeedback <= 0 && !this.hold?.shown)
                this.queueCount.string = this.queueCaption();
        }
    }

    private dispatchAnts(dt: number) {
        // Each slot dispatches independently at its own interval. In-flight trips
        // reserve jar capacity, but never impose an additional worker-count cap.
        for (let slot = 0; slot < this.model.slots.length; slot++) {
            const jar = this.model.slots[slot], id = jar?.id ?? -1;
            if (this.dispatchJarIds[slot] !== id) {
                this.dispatchJarIds[slot] = id;
                this.dispatchClocks[slot] = DISPATCH_INTERVAL;
            }
            if (!jar) {
                this.dispatchClocks[slot] = 0;
                continue;
            }
            // Land before releasing ants so their launch origin stays at the rim.
            if (this.slotViews[slot].entryElapsed >= 0) continue;
            this.dispatchClocks[slot] = Math.min(DISPATCH_INTERVAL, this.dispatchClocks[slot] + dt * this.effectiveSpeed);
            if (this.dispatchClocks[slot] < DISPATCH_INTERVAL)
                continue;
            const origin = worldToGrid({ x: collectionSlotX(slot, this.model.slots.length), y: collectionSlotY(slot) + 42 });
            const targets = this.model.availableTargets(slot);
            const assignment = nearestAntTarget({ width: this.model.level.width, height: this.model.level.height, pixels: this.model.plannedPixels }, origin, targets, .45, this.targetSearch);
            if (!assignment)
                continue;
            const pickup = this.model.pick(slot, assignment);
            if (!pickup)
                continue;
            this.dispatchClocks[slot] = 0;
            this.slotViews[slot].launchElapsed = 0;
            if (this.model.slots[slot]) {
                this.slotLabels[slot].string = String(this.model.undispatched(slot));
                this.containerNumber(this.slotLabels[slot]);
            }
            else {
                this.startContainerExit(this.slotViews[slot], jar);
                this.drawSlots();
            }
            const path = assignment.path.map(gridToWorld);
            const route = prepareRoute(path);
            this.flights.push({
                visual: this.acquireAnt(pickup.color),
                pickup,
                elapsed: 0,
                phase: 'launch',
                path,
                route,
                pose: { x: 0, y: 0, angle: 0 },
                gripAngle: 0,
                gripTurn: 0,
                distance: route.distance,
                lifted: false,
                launchOrigin: { x: collectionSlotX(slot, this.model.slots.length), y: collectionSlotY(slot) + 25 },
                fromPose: { x: 0, y: 0, angle: 0 },
                toPose: { x: 0, y: 0, angle: 0 },
                fromGrid: { x: 0, y: 0 },
                toGrid: { x: 0, y: 0 },
                clearanceBlocked: this.routeHasBlockedSegment(route),
                clearanceRemaining: this.model.remaining,
            });
        }
    }

    private routeHasBlockedSegment(route: PreparedRoute): boolean {
        for (let i = 1; i < route.path.length; i++) {
            const a = route.path[i - 1], b = route.path[i];
            if (!clearSegment(this.routeBoard, {
                x: (a.x - BOARD_LEFT) / CELL_SIZE - .5,
                y: (BOARD_TOP - a.y) / CELL_SIZE - .5,
            }, {
                x: (b.x - BOARD_LEFT) / CELL_SIZE - .5,
                y: (BOARD_TOP - b.y) / CELL_SIZE - .5,
            }, .45))
                return true;
        }
        return false;
    }

    private resetCardMotion(card: CardView) {
        if (card.selectElapsed < 0) return;
        card.selectElapsed = -1;
        card.motion.setPosition(0, 0);
        card.motion.setScale(1, 1, 1);
        card.motion.angle = 0;
    }

    private applyContainerPose(node: Node, opacity: UIOpacity | null, progress: number, poses: readonly ContainerPose[]) {
        const at = Math.min(1, Math.max(0, progress)) * (poses.length - 1);
        const index = Math.min(poses.length - 2, Math.floor(at));
        const t = 1 - Math.pow(1 - (at - index), 2);
        const a = poses[index], b = poses[index + 1];
        const value = (i: number) => a[i] + (b[i] - a[i]) * t;
        node.setPosition(value(0), value(1));
        node.angle = value(2);
        node.setScale(value(3), value(4), 1);
        if (opacity) opacity.opacity = Math.round(value(5));
    }

    private startContainerExit(view: SlotView, jar: Jar) {
        // A separate, numberless visual never owns the slot or intercepts touches.
        // It can finish while a new container is already entering the same slot.
        view.exitBody.clear();
        view.exitSprite.spriteFrame = view.sprite.spriteFrame;
        view.exitSprite.node.active = view.sprite.node.active;
        if (view.exitSprite.node.active) this.applyContainerMaterial(view.exitSprite, jar.color);
        if (!view.exitSprite.node.active) this.jar(view.exitBody, jar, 0, 0, 92, 70);
        view.exitElapsed = 0;
        view.exit.active = true;
        this.applyContainerPose(view.exit, view.exitOpacity, 0, EXIT_POSES);
    }

    private updateContainerTransitions(dt: number) {
        for (const view of this.slotViews) {
            if (view.entryElapsed >= 0) {
                view.entryElapsed += dt;
                this.applyContainerPose(view.container, view.opacity, view.entryElapsed / .4, ENTRY_POSES);
                if (view.entryElapsed >= .4) view.entryElapsed = -1;
            }
            if (view.exitElapsed >= 0) {
                view.exitElapsed += dt;
                this.applyContainerPose(view.exit, view.exitOpacity, view.exitElapsed / .22, EXIT_POSES);
                if (view.exitElapsed >= .22) {
                    view.exitElapsed = -1;
                    view.exit.active = false;
                }
            }
        }
    }

    private updateContainerLaunches(dt: number) {
        for (const view of this.slotViews) {
            if (view.launchElapsed < 0)
                continue;
            view.launchElapsed += dt * this.effectiveSpeed;
            const t = view.launchElapsed;
            let stretch = 0;
            if (t < .055)
                stretch = -.13 * Math.sin(t / .055 * Math.PI / 2);
            else if (t < .13)
                stretch = -.13 + .28 * Math.sin((t - .055) / .075 * Math.PI / 2);
            else if (t < LAUNCH_DURATION)
                stretch = .15 * Math.cos((t - .13) / (LAUNCH_DURATION - .13) * Math.PI / 2);
            view.container.setScale(1 - stretch * .65, 1 + stretch, 1);
            // Anchor the base while the rim squashes then springs upward.
            view.container.setPosition(0, stretch * 35);
            if (t >= LAUNCH_DURATION) {
                view.launchElapsed = -1;
                view.container.setPosition(0, 0);
                view.container.setScale(1, 1, 1);
                this.drawSlots();
            }
        }
    }

    private updateFlights(dt: number): boolean {
        let arrived = false;
        for (let i = this.flights.length - 1; i >= 0; i--) {
            const trip = this.flights[i];
            const previousElapsed = trip.elapsed;
            trip.elapsed += dt * this.effectiveSpeed;
            const walk = Math.max(.8, trip.distance / (trip.phase === 'return' ? 160 : 210));
            if (trip.phase === 'outbound') {
                // A frame that crosses a bend must stop on its waypoint first;
                // the chord between two samples could cut an occupied corner.
                const previousDistance = trip.distance * Math.min(1, previousElapsed / walk);
                let boundary = 0;
                for (const length of trip.route.lengths) {
                    boundary += length;
                    if (boundary > previousDistance + 1e-7) {
                        trip.elapsed = Math.min(trip.elapsed, boundary / trip.distance * walk);
                        break;
                    }
                }
                if (trip.clearanceBlocked) {
                    const from = samplePreparedRoute(trip.route, trip.distance * Math.min(1, previousElapsed / walk), trip.fromPose);
                    const to = samplePreparedRoute(trip.route, trip.distance * Math.min(1, trip.elapsed / walk), trip.toPose);
                    trip.fromGrid.x = (from.x - BOARD_LEFT) / CELL_SIZE - .5;
                    trip.fromGrid.y = (BOARD_TOP - from.y) / CELL_SIZE - .5;
                    trip.toGrid.x = (to.x - BOARD_LEFT) / CELL_SIZE - .5;
                    trip.toGrid.y = (BOARD_TOP - to.y) / CELL_SIZE - .5;
                    if (!clearSegment(this.routeBoard, trip.fromGrid, trip.toGrid, .45)) {
                        // Hold at the last safe position until earlier workers
                        // actually clear the reserved corridor. Never tunnel.
                        trip.elapsed = previousElapsed;
                        this.updateAntVisual(trip);
                        continue;
                    }
                    // Pixels only disappear during play, so once every segment
                    // is clear this trip no longer needs per-frame scans.
                    // remaining changes on each successful lift, including lifts
                    // earlier in this frame. Reservations and arrivals do not alter obstacles.
                    if (trip.clearanceRemaining !== this.model.remaining) {
                        trip.clearanceBlocked = this.routeHasBlockedSegment(trip.route);
                        trip.clearanceRemaining = this.model.remaining;
                    }
                }
            }
            if (trip.phase === 'launch' && trip.elapsed >= ANT_LAUNCH_DURATION) {
                trip.elapsed -= ANT_LAUNCH_DURATION;
                trip.phase = 'outbound';
            }
            else if (trip.phase === 'outbound' && trip.elapsed >= walk) {
                if (!this.model.lift(trip.pickup)) {
                    trip.elapsed = walk;
                    this.updateAntVisual(trip);
                    continue;
                }
                trip.elapsed = 0;
                trip.phase = 'grasp';
                trip.lifted = true;
                if (trip.lifted) {
                    const row = Math.floor(trip.pickup.pixel / this.model.level.width);
                    this.dirtyRows.add(row);
                    // Removing a block also exposes the lower wall of the
                    // block above it. Right walls stay within the same row.
                    if (row > 0)
                        this.dirtyRows.add(row - 1);
                }
                // Other workers may have cleared a shortcut since departure.
                trip.path = this.antRoute(trip.pickup.pixel, true, trip.pickup.slot, trip.pickup.approach);
                trip.route = prepareRoute(trip.path);
                trip.distance = trip.route.distance;
                trip.clearanceBlocked = false;
                const returnAngle = samplePreparedRoute(trip.route, 0, trip.pose).angle;
                trip.gripAngle = Math.atan2(trip.pickup.approach.y - Math.floor(trip.pickup.pixel / this.model.level.width), trip.pickup.pixel % this.model.level.width - trip.pickup.approach.x);
                trip.gripTurn = Math.atan2(Math.sin(returnAngle - trip.gripAngle), Math.cos(returnAngle - trip.gripAngle));
            }
            else if (trip.phase === 'grasp' && trip.elapsed >= .35) {
                trip.elapsed = 0;
                trip.phase = 'return';
            }
            else if (trip.phase === 'return' && trip.elapsed >= walk) {
                trip.elapsed = 0;
                trip.phase = 'enter';
            }
            else if (trip.phase === 'enter' && trip.elapsed >= .35) {
                this.model.arrive(trip.pickup);
                this.releaseAnt(trip.visual);
                this.flights.splice(i, 1);
                arrived = true;
                continue;
            }
            this.updateAntVisual(trip);
        }
        return arrived;
    }

    private updateAntVisual(trip: AntTrip) {
        const pose = trip.pose;
        let scale = 1;
        if (trip.phase === 'launch') {
            const t = Math.min(1, Math.max(0, (trip.elapsed - .055) / (ANT_LAUNCH_DURATION - .055)));
            const end = trip.path[0];
            const eased = 1 - (1 - t) * (1 - t);
            pose.x = trip.launchOrigin.x + (end.x - trip.launchOrigin.x) * eased;
            pose.y = trip.launchOrigin.y + (end.y - trip.launchOrigin.y) * eased + Math.sin(t * Math.PI) * 9;
            pose.angle = Math.PI / 2;
            scale = t;
        }
        else if (trip.phase === 'grasp') {
            const t = Math.min(1, Math.max(0, (trip.elapsed - .1) / .25));
            pose.x = trip.path[0].x;
            pose.y = trip.path[0].y;
            pose.angle = trip.gripAngle + trip.gripTurn * t * t * (3 - 2 * t);
        }
        else if (trip.phase === 'enter') {
            samplePreparedRoute(trip.route, trip.distance, pose);
            scale = 1 - trip.elapsed / .35;
        }
        else {
            samplePreparedRoute(trip.route, trip.distance * Math.min(1, trip.elapsed / Math.max(.8, trip.distance / (trip.phase === 'return' ? 160 : 210))), pose);
        }
        const visual = trip.visual;
        // Cocos invalidates child transforms even when setters receive an
        // unchanged value. Straight walking needs position updates only.
        const position = visual.node.position, scaling = visual.node.scale, angle = pose.angle * 180 / Math.PI;
        if (position.x !== pose.x || position.y !== pose.y)
            visual.node.setPosition(pose.x, pose.y);
        if (visual.node.angle !== angle)
            visual.node.angle = angle;
        if (scaling.x !== scale || scaling.y !== scale || scaling.z !== 1)
            visual.node.setScale(scale, scale, 1);
        if (visual.cargo.active !== trip.lifted)
            visual.cargo.active = trip.lifted;
        // Keep the lifted cell upright with the same upper-left light, while
        // its center follows the rotating mandibles through the turn.
        if (trip.lifted && visual.cargo.angle !== -visual.node.angle)
            visual.cargo.angle = -visual.node.angle;
        const frame = trip.phase === 'grasp' || trip.phase === 'enter' ? 0 : Math.floor(trip.elapsed * 12) % 3;
        if (visual.frame !== frame) {
            if (visual.body) {
                visual.body.spriteFrame = this.antFrames[frame];
                visual.bodyDetail!.spriteFrame = this.antFrames[4 + frame];
            }
            else {
                visual.frames[visual.frame].active = false;
                visual.frames[frame].active = true;
            }
            visual.frame = frame;
        }
    }

    private antRoute(pixel: number, returning: boolean, slot = 0, contact?: RoutePoint): RoutePoint[] {
        const width = this.model.level.width;
        const origin = returning ? NEST : { x: collectionSlotX(slot, this.model.slots.length), y: collectionSlotY(slot) + 42 };
        const nest = worldToGrid(origin);
        const approach = contact ?? this.model.approachCells(pixel)[0];
        const gridPath = findAntRoute({ width, height: this.model.level.height, pixels: this.model.pixels }, nest, approach, .45, this.returnRouteSearch);
        const world = gridPath.map(gridToWorld);
        return returning ? world.reverse() : world;
    }

    private boardPixel(g: Graphics, x: number, top: number, hex: string, bottomExposed = true, rightExposed = true) {
        drawBoardPixel(g, x, top, hex, bottomExposed, rightExposed);
    }

    private drawAnt(g: Graphics, x: number, y: number, angle: number, time: number, scale: number, bodyColor = '#493626') {
        drawAnt(g, x, y, angle, time, scale, bodyColor);
    }

    private unlockAudio() {
        this.audioUnlocked = true;
        this.syncMusic();
    }

    private syncMusic() {
        if (!this.save.music || this.paused) {
            this.music.pause();
            this.music.volume = 0;
            return;
        }
        if (this.audioUnlocked && this.music.clip && !this.music.playing)
            this.music.play();
    }

    private play(name: string) {
        this.unlockAudio();
        if (!this.save.sound || this.paused)
            return;
        const clip = this.clips.get(name);
        if (!clip)
            return;
        this.audio.playOneShot(clip, name === 'tap' ? .28 : .42);
    }

    private rewardDay() {
        if (!this.cloudMode) return todayKey();
        const date = new Date(Date.now() + this.serverOffset + 8 * 3600000);
        return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    }

    private connectCloud() {
        this.cloudTask(async () => {
            if (!this.cloud) this.cloud = new CloudGame(wechatTransport(), sys.localStorage);
            return this.cloud.login();
        }, state => {
            this.applyCloudState(state);
            this.cloudReady = true;
            this.save.selected = this.save.unlocked;
            this.showHome(true);
        }, '正在同步进度…');
    }

    private applyCloudState(state: CloudState) {
        const { sound, music } = this.save;
        this.save = state.profile;
        this.save.sound = sound;
        this.save.music = music;
        if (state.highest !== this.cloudHighest || state.reachedAt !== this.cloudReachedAt)
            syncFriendScore(state.highest, state.reachedAt).catch(error => console.warn('Friend score sync failed; retry when opening friends', error));
        this.cloudHighest = state.highest;
        this.cloudReachedAt = state.reachedAt;
        this.serverOffset = state.serverTime - Date.now();
        this.persist();
    }

    private refreshCloudStatus() {
        if (this.cloudStatus) {
            this.cloudStatus.active = false;
            this.cloudStatus.destroy();
            this.cloudStatus = null;
        }
        if (this.queueCount) this.queueCount.node.active = (!this.cloudBusy && !this.cloudMessage) || !!this.home || !!this.modal;
        if (this.homePlayLabel) this.homePlayLabel.node.active = !!this.modal || this.cloudReady || !this.cloudMode;
        if (this.homeRewardButton) this.homeRewardButton.active = !this.cloudBusy && !this.cloudMessage;
        if (this.drawerSubtitle) this.drawerSubtitle.node.active = !this.cloudBusy && !this.cloudMessage;
        if (!this.cloudBusy && !this.cloudMessage) return;
        const parent = this.drawerSheet ?? this.modal ?? this.home ?? this.gameRoot;
        const inGame = parent === this.gameRoot;
        const homeLogin = parent === this.home && !this.cloudReady;
        const y = this.drawerSubtitle ? this.drawerSubtitle.node.position.y : this.modal ? this.modalStatusY : this.home ? (homeLogin ? -233 : -585) : 670;
        const width = inGame ? 300 : homeLogin || this.drawerSheet ? 500 : 610;
        const n = this.node2d('Cloud status', parent, inGame ? 170 : 0, y, width, this.touchSize);
        this.cloudStatus = n;
        this.text(n, this.cloudMessage, 0, 0, homeLogin ? 28 : 22, homeLogin ? INK : MUTED, width);
        n.on(Node.EventType.TOUCH_END, () => this.cloudRetry?.());
    }

    private cloudTask<T>(task: () => Promise<T>, complete: (result: T) => void, message: string, cancellable = false) {
        if (this.cloudBusy) return;
        this.cloudBusy = true;
        this.cloudCancellable = cancellable;
        const request = ++this.cloudRequest;
        let inFlight = false;
        const attempt = () => {
            if (inFlight || request !== this.cloudRequest) return;
            inFlight = true;
            this.cloudBusy = true;
            this.cloudRetry = null;
            this.cloudMessage = message;
            this.refreshCloudStatus();
            task().then(result => {
                if (!this.isValid || request !== this.cloudRequest) return;
                this.cloudBusy = false;
                this.cloudCancellable = false;
                this.cloudMessage = '';
                this.refreshCloudStatus();
                complete(result);
            }).catch(error => {
                if (!this.isValid || request !== this.cloudRequest) return;
                console.error('Cloud game request failed', error);
                inFlight = false;
                const rejected = error instanceof CloudGameError;
                if (rejected && this.cloudReady && error.code !== 'LOGIN' && error.code !== 'VERSION') this.cloudBusy = false;
                if (rejected && error.code === 'SESSION') {
                    this.cloudRunId = '';
                    this.cloudRetry = null;
                    this.cloudMessage = '';
                    const n = this.openModal('需要重新开始', error.message, 440);
                    this.button(n, '返回主页', -142, -105, 240, 70, PAPER, () => this.showHome());
                    this.button(n, '重新开始', 142, -105, 240, 70, GREEN, () => this.startLevel(this.save.selected));
                    return;
                }
                this.cloudMessage = rejected ? `${error.message} · 点击重试` : '连接未完成，点击重试';
                this.cloudRetry = attempt;
                this.refreshCloudStatus();
            });
        };
        attempt();
    }

    private claimCloudRewards() {
        if (!this.cloudReady) return;
        const view = this.modal;
        this.cloudTask(() => this.cloud!.mutate('claim'), state => {
            this.applyCloudState(state);
            if (this.modal === view) this.showHome();
            else if (this.home) this.showHome(true);
            this.notify('奖励已收下', `${state.output.amount!} 金币已经放进你的小窝`, 'success');
        }, '正在领取奖励…');
    }

    private worldLeaderboard(page: number) {
        if (!this.cloudReady || (this.cloudBusy && !this.cloudCancellable)) return;
        const gap = Math.max(105, this.touchSize + 4);
        const n = this.openModal('世界排行榜', '通关越多越靠前 · 同关卡先到者在前', 1100 + 3 * (gap - 105));
        this.button(n, '返回', 0, -270 - gap * 2, 480, 64, GREEN, () => this.closeModal(), '#FFFFFF');
        this.modalStatusY = 80;
        this.cloudTask(() => this.cloud!.leaderboard(page), result => {
            if (!result.rows.length)
                this.text(n, '还没有通关成绩', 0, 80, 30);
            result.rows.forEach((row, i) => this.text(n,
                `${row.rank}. ${row.self ? '我' : row.player}   第 ${row.highest} 关`,
                0, 300 - i * 51, 24, row.self ? '#366650' : INK, 560));
            if (page > 0)
                this.button(n, '上一页', -175, -270, 150, 48, PAPER, () => this.worldLeaderboard(page - 1));
            if (result.hasNext)
                this.button(n, '下一页', 175, -270, 150, 48, PAPER, () => this.worldLeaderboard(page + 1));
            this.text(n, '展示前一百名玩家', 0, -195, 22, MUTED);
            this.button(n, '微信好友榜', 0, -270 - gap, 300, 48, PAPER, () => this.friendLeaderboard(0));
        }, '正在加载排行…', true);
    }

    private friendLeaderboard(page: number) {
        if (!this.cloudReady || (this.cloudBusy && !this.cloudCancellable)) return;
        const n = this.openModal('微信好友排行榜', '通关越多越靠前 · 同关卡先到者在前', 1100);
        this.button(n, '返回', 0, -465, 480, 64, GREEN, () => this.closeModal(), '#FFFFFF');
        this.modalStatusY = 80;
        this.cloudTask(async () => {
            await authorizeFriends();
            await syncFriendScore(this.cloudHighest, this.cloudReachedAt);
        }, () => {
            this.closeModal();
            const content = this.openModal('微信好友排行榜', '通关越多越靠前 · 同关卡先到者在前', 1100);
            const board = this.node2d('Friend board', content, 0, 10, 440, 660);
            const subContext = board.addComponent(SubContextView);
            subContext.fps = 10;
            showFriendPage(page);
            this.button(content, '刷新', 0, -365, 150, 48, PAPER, () => showFriendPage(0));
            this.button(content, '上一页', -175, -365, 150, 48, PAPER, () => changeFriendPage(-1));
            this.button(content, '下一页', 175, -365, 150, 48, PAPER, () => changeFriendPage(1));
            this.button(content, '世界榜', 0, -365 - Math.max(100, this.touchSize + 4), 480, 64, GREEN, () => this.worldLeaderboard(0), '#FFFFFF');
        }, '正在加载好友…', true);
    }

    private watchCloudAd(placement: 'speed' | 'slot', complete: () => void) {
        this.cloudTask(() => this.cloud!.mutate('adStart', { runId: this.cloudRunId, placement }), state => {
            this.openModal('广告准备中', '完整观看视频即可获得', 360);
            showRewardedVideo().then(ok => {
                if (!this.isValid) return;
                this.closeModal();
                if (!ok) {
                    this.notify('广告未完成', '看完广告后才能获得奖励', 'warning');
                    return;
                }
                this.cloudTask(() => this.cloud!.mutate('adComplete', { adId: state.output.adId! }), result => {
                    this.applyCloudState(result);
                    complete();
                }, '正在确认广告奖励…');
            });
        }, '正在准备广告…');
    }

    private persist() {
        try {
            if (this.cloudMode)
                sys.localStorage.setItem('ant-device-settings', JSON.stringify({ sound: this.save.sound, music: this.save.music }));
            else
                sys.localStorage.setItem('pixel-garden-v1', JSON.stringify(this.save));
        }
        catch {
            console.warn('本机存储不可用，进度暂时无法保存');
        }
    }

    private readSave() {
        try {
            if (this.cloudMode) {
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
        }
        catch {
            this.save = freshProfile();
        }
    }

    private notify(title: string, description: string, type: 'info' | 'success' | 'warning' = 'info') {
        if (this.notification) {
            this.notification.node.active = false;
            this.notification.node.destroy();
        }
        const n = this.node2d('Notification', this.root, 0, 610, 650, 112), g = this.graphics(n);
        const styles = { info: ['#ECF9F6', '#19C8B9', '#C2ECE6', 'i'], success: ['#F5FAE9', '#6FBA2C', '#D8EFC1', '✓'], warning: ['#FDF6D9', '#F5C31C', '#FBEAA1', '!'] };
        const [bg, border, icon, symbol] = styles[type];
        this.box(g, 0, -5, 650, 112, 28, ISLAND.shadow);
        this.box(g, 0, 0, 650, 112, 28, bg);
        g.strokeColor = color(border);
        g.lineWidth = 3;
        g.roundRect(-324, -55, 648, 110, 27);
        g.stroke();
        g.fillColor = color(icon);
        g.circle(-270, 0, 27);
        g.fill();
        g.strokeColor = color(type === 'success' ? '#5A9E1E' : type === 'warning' ? '#B88A06' : '#11A89B');
        g.lineWidth = 4;
        if (type === 'success') {
            g.moveTo(-282, 0);
            g.lineTo(-273, -9);
            g.lineTo(-257, 11);
            g.stroke();
        }
        else
            this.text(n, symbol, -270, 0, 30, INK, 48).isBold = false;
        this.text(n, title, -2, 23, 26, INK, 460).isBold = false;
        this.text(n, description, -2, -19, 21, MUTED, 460);
        const close = this.node2d('Dismiss notification', n, 281, 0, 62, 80);
        this.text(close, '×', 0, 0, 32, MUTED, 60);
        close.on(Node.EventType.TOUCH_END, () => {
            if (this.notification?.node === n) {
                n.active = false;
                n.destroy();
                this.notification = null;
            }
        });
        n.on(Node.EventType.TOUCH_START, (e?: {
            propagationStopped: boolean;
        }) => {
            if (e)
                e.propagationStopped = true;
        });
        n.on(Node.EventType.TOUCH_END, (e?: {
            propagationStopped: boolean;
        }) => {
            if (e)
                e.propagationStopped = true;
        });
        this.notification = { node: n, elapsed: 0 };
    }

    private updateOverlays(dt: number) {
        const ad = this.rewardAdDemo;
        if (ad) {
            ad.remaining -= dt;
            if (ad.remaining > 0) ad.label.string = `测试广告 ${Math.ceil(ad.remaining)} 秒`;
            else {
                this.rewardAdDemo = null;
                const complete = ad.complete;
                this.closeModal();
                complete();
            }
        }
        if (this.pendingVictory && !this.modal && !this.home) {
            this.pendingVictory = false;
            this.showVictory();
        }
        const note = this.notification;
        if (note) {
            note.elapsed += dt;
            const shift = note.elapsed < .25 ? 32 * (1 - note.elapsed / .25) : note.elapsed > 3.25 ? 32 * Math.min(1, (note.elapsed - 3.25) / .25) : 0;
            note.node.setPosition(0, 610 + shift);
            if (note.elapsed >= 3.5) {
                note.node.active = false;
                note.node.destroy();
                this.notification = null;
            }
        }
        const motion = this.drawerMotion;
        if (motion) {
            motion.elapsed += dt;
            const t = Math.min(1, motion.elapsed / .36), ease = 1 - Math.pow(1 - t, 3);
            motion.node.setPosition(0, motion.from + (motion.to - motion.from) * ease);
            if (motion.closing) {
                if (this.drawerVeil) this.drawerVeil.opacity = 255 * (1 - ease);
                if (motion.previewFrom !== undefined) {
                    const offset = motion.previewFrom * (1 - ease);
                    this.homeScene?.node.setPosition(0, offset);
                    this.courtyardNode?.setPosition(0, offset);
                }
            }
            if (t === 1) {
                this.drawerMotion = null;
                if (motion.closing)
                    this.closeModal();
            }
        }
    }

    private dismissOverlay() {
        if (this.drawerSheet) {
            if (this.drawerMotion?.closing)
                return;
            // Stop when the visible sheet top reaches the screen bottom, so the
            // landscape reaches its origin before the sheet uncovers it.
            const sheetHeight = this.drawerSheet.getComponent(UITransform)!.height;
            const to = -this.screenHeight / 2 - sheetHeight / 2 + 30;
            const coveredHeight = Math.max(0, this.drawerSheet.position.y - to);
            const previewFrom = this.courtyardPreview
                ? Math.min(this.homeScene!.node.position.y, coveredHeight) : undefined;
            if (previewFrom !== undefined) {
                this.homeScene!.node.setPosition(0, previewFrom);
                this.courtyardNode!.setPosition(0, previewFrom);
            }
            this.drawerMotion = { node: this.drawerSheet, from: this.drawerSheet.position.y, to, elapsed: 0, closing: true, previewFrom };
        }
        else
            this.closeModal();
    }

    private openDrawer(title: string, subtitle: string, height: number) {
        this.clearPreview();
        this.closeModal();
        const n = this.node2d('Bottom drawer', this.root);
        this.modal = n;
        const mask = this.node2d('Drawer mask', n, 0, 0, this.screenWidth, this.screenHeight), veil = mask.addComponent(Graphics);
        this.drawerVeil = mask.addComponent(UIOpacity);
        veil.fillColor = new Color(0, 0, 0, 46);
        veil.rect(-this.screenWidth / 2, -this.screenHeight / 2, this.screenWidth, this.screenHeight);
        veil.fill();
        mask.on(Node.EventType.TOUCH_END, () => this.dismissOverlay());
        const sheet = this.node2d('Drawer sheet', n, 0, -this.screenHeight, this.screenWidth, height + 120);
        this.drawerSheet = sheet;
        this.modalStatusY = -height / 2 + 20;
        const g = this.graphics(sheet);
        this.box(g, 0, -15, this.screenWidth, height + 90, 40, ISLAND.card);
        // Extend the bottom beyond the viewport; only top corners remain visible.
        g.fillColor = color(ISLAND.card);
        g.rect(-this.screenWidth / 2, -height / 2 - 60, this.screenWidth, 70);
        g.fill();
        this.box(g, 0, height / 2 + 7, 76, 7, 3.5, '#C4B89E');
        this.text(sheet, title, 0, height / 2 - 52, 34, INK, 530).isBold = false;
        this.drawerSubtitle = this.text(sheet, subtitle, 0, height / 2 - 124, 26, MUTED, 500);
        const close = this.node2d('Close drawer', sheet, 310, height / 2 - 49, this.touchSize, this.touchSize);
        this.text(close, '×', 0, 0, 38, MUTED, 64);
        close.on(Node.EventType.TOUCH_END, () => this.dismissOverlay());
        sheet.on(Node.EventType.TOUCH_START, (e?: {
            propagationStopped: boolean;
        }) => {
            if (e)
                e.propagationStopped = true;
        });
        sheet.on(Node.EventType.TOUCH_END, (e?: {
            propagationStopped: boolean;
        }) => {
            if (e)
                e.propagationStopped = true;
        });
        const handle = this.node2d('Drawer handle', sheet, 0, height / 2 + 7, 220, this.touchSize);
        handle.on(Node.EventType.TOUCH_END, (e?: {
            getUILocation: () => {
                y: number;
            };
            getUIStartLocation: () => {
                y: number;
            };
        }) => {
            if (e && e.getUIStartLocation().y - e.getUILocation().y > 45)
                this.dismissOverlay();
        });
        this.drawerMotion = { node: sheet, from: -this.screenHeight, to: -this.screenHeight / 2 + height / 2 + 60, elapsed: 0, closing: false };
        if (this.notification)
            this.notification.node.setSiblingIndex(999);
        this.refreshCloudStatus();
        return sheet;
    }

    private openModal(title: string, subtitle: string, height = 500) {
        this.clearPreview();
        this.closeModal();
        const n = this.node2d('Dialog', this.root, 0, 0, this.screenWidth, this.screenHeight);
        this.modal = n;
        this.modalStatusY = -height / 2 + 20;
        const veil = n.addComponent(Graphics);
        veil.fillColor = new Color(61, 52, 40, 145);
        veil.rect(-this.screenWidth / 2, -this.screenHeight / 2, this.screenWidth, this.screenHeight);
        veil.fill();
        n.on(Node.EventType.TOUCH_START, (e: {
            propagationStopped: boolean;
        }) => {
            e.propagationStopped = true;
        });
        n.on(Node.EventType.TOUCH_END, (e: {
            propagationStopped: boolean;
        }) => {
            e.propagationStopped = true;
        });
        islandModal(veil, 650, height);
        this.text(n, title, 0, height / 2 - 64, 34, INK, 560).isBold = false;
        this.text(n, subtitle, 0, height / 2 - 119, 25, MUTED, 560);
        this.refreshCloudStatus();
        return n;
    }

    private closeModal() {
        if (this.cloudCancellable) {
            this.cloudRequest++;
            this.cloudBusy = false;
            this.cloudCancellable = false;
            this.cloudRetry = null;
            this.cloudMessage = '';
        }
        this.rewardAdDemo = null;
        this.drawerMotion = null;
        this.drawerSheet = null;
        this.drawerVeil = null;
        this.courtyardShopContent = null;
        this.nestShopContent = null;
        this.drawerSubtitle = null;
        this.celebration = null;
        if (this.modal) {
            this.modal.destroy();
            this.modal = null;
        }
        this.courtyardPreview = undefined;
        this.refreshCourtyard();
        this.refreshCloudStatus();
    }

    private controlsGuide(step = 0) {
        const titles = ['选择容器', '观察搬运', '长按找同色'];
        const lines = [
            ['点击上面一排容器，放入收集槽', '下面一排是预览，选走上方后会补位'],
            ['蚂蚁搬走能接触到的同色像素', '容器数字表示还没有派出的蚂蚁数量'],
            ['按住容器，查看画中剩余同色像素', '松手结束查看；滑动可以取消'],
        ];
        const n = this.openModal(titles[step], `操作说明 ${step + 1} / 3`, 500);
        this.text(n, lines[step][0], 0, 35, 27, INK, 570);
        this.text(n, lines[step][1], 0, -25, 25, MUTED, 570);
        this.button(n, step < 2 ? '下一步' : '开始收集', 0, -155, 440, 72, GREEN, () => {
            if (step < 2) this.controlsGuide(step + 1);
            else {
                this.controlsSeen = true;
                try { sys.localStorage.setItem('ant-controls-seen', '1'); } catch {}
                this.closeModal();
            }
        });
    }

    private settings() {
        const gap = Math.max(110, this.touchSize + 12);
        const count = this.home ? 3 : 6;
        const height = 252 + gap * count + 86;
        const n = this.openDrawer('小窝设置', '', height);
        const top = height / 2 - 252;
        const music = this.button(n, this.save.music ? '音乐：开启' : '音乐：关闭', 0, top, 440, 68, '#E8FAF5', () => {
            this.save.music = !this.save.music;
            this.persist();
            this.syncMusic();
            music.string = this.save.music ? '音乐：开启' : '音乐：关闭';
        });
        const sound = this.button(n, this.save.sound ? '音效：开启' : '音效：关闭', 0, top - gap, 440, 68, '#E8FAF5', () => {
            this.save.sound = !this.save.sound;
            this.persist();
            sound.string = this.save.sound ? '音效：开启' : '音效：关闭';
        });
        if (!this.home) {
            this.button(n, '操作说明', 0, top - gap * 2, 440, 68, PAPER, () => this.controlsGuide());
            this.button(n, '重新开始', 0, top - gap * 3, 440, 68, PAPER, () => this.restart());
            this.button(n, '返回主页', 0, top - gap * 4, 440, 68, PAPER, () => this.showHome());
        }
        this.button(n, this.home ? '完成' : '继续游戏', 0, top - gap * (this.home ? 2 : 5), 440, 72, PAPER, () => this.dismissOverlay());
        const credit = top - gap * (this.home ? 2 : 5) - gap;
        const credits = this.node2d('Music credits', n, 0, credit, 240, this.touchSize);
        this.text(credits, '音乐鸣谢 ›', 0, 0, 23, MUTED, 220);
        credits.on(Node.EventType.TOUCH_END, () => {
            this.play('tap');
            this.musicCredits();
        });
    }

    private musicCredits() {
        const n = this.openModal('音乐鸣谢', '背景音乐', 620);
        this.text(n, 'Easy Lemon', 0, 112, 32, INK, 560);
        this.text(n, 'Kevin MacLeod · incompetech.com', 0, 62, 23, MUTED, 560);
        this.text(n, 'CC BY 4.0', 0, 0, 24, INK, 560);
        this.text(n, 'creativecommons.org/licenses/by/4.0/', 0, -38, 20, MUTED, 560);
        this.text(n, '节选、循环交叉淡化及柔化处理', 0, -100, 22, MUTED, 560);
        this.button(n, '返回设置', 0, -211, 440, 72, PAPER, () => this.settings());
    }

    private restart() {
        const n = this.openModal('重新收集这一幅？', '本关将重新开始，已解锁关卡会保留', 350);
        this.button(n, '继续游戏', -142, -73, 240, 66, '#E8FAF5', () => this.closeModal());
        this.button(n, '重新开始', 142, -73, 240, 66, GREEN, () => this.startLevel(this.save.selected), '#FFFFFF');
    }

    private showBlocked() {
        const n = this.openModal('暂时无法继续收集', '槽位已满，容器颜色与当前可达的像素不匹配', 560);
        this.text(n, this.model.slots.length < 5 + EXPANSION_COLUMNS.length ? '观看视频可增加一个槽位，本关生效' : '可以重新开始，或返回主页休息一下', 0, -5, 24);
        this.button(n, '重新开始', -142, -80, 240, 70, PAPER, () => this.startLevel(this.save.selected));
        if (this.model.slots.length < 5 + EXPANSION_COLUMNS.length)
            this.button(n, '解锁槽位', 142, -80, 240, 70, GREEN, () => this.requestSlotExpansion(), '#FFFFFF');
        this.button(n, '返回主页', 0, -80 - Math.max(110, this.touchSize + 4), 480, 70, PAPER, () => this.showHome());
    }

    private victory() {
        if (this.cloudBusy) return;
        this.won = true;
        if (this.cloudMode) {
            const values = { runId: this.cloudRunId, seconds: Math.max(.01, this.elapsed), moves: this.model.moves };
            this.cloudTask(() => this.cloud!.mutate('complete', values), state => {
                this.applyCloudState(state);
                if (this.home) this.showHome(true);
                else if (!this.modal) this.showVictory();
                else this.pendingVictory = true;
            }, '正在保存通关…');
            return;
        }
        recordWin(this.save, { level: this.save.selected, seconds: Math.max(.01, this.elapsed), moves: this.model.moves }, LEVEL_COUNT);
        this.persist();
        this.showVictory();
    }

    private showVictory() {
        this.won = true;
        this.effects.clear();
        this.play('win');
        const index = this.save.selected;
        const n = this.openModal('这一关完成了', this.model.level.name, 1100);
        const album = this.node2d('Album pocket', n, 0, 100, 330, 440);
        const pocket = album.addComponent(Graphics);
        this.box(pocket, 0, -5, 330, 440, 24, '#C6D3B8');
        this.box(pocket, 0, 0, 330, 440, 24, '#E6EDDB');
        this.box(pocket, 0, 20, 306, 382, 12, PAPER);
        this.text(album, '通关完成', 0, -196, 24, '#366650', 180);
        album.active = false;
        const art = this.node2d('Restored artwork', n, 0, 140, 400, 500), rows: Node[] = [];
        const level = this.model.level, step = 400 / level.width;
        // Draw each strip once; the reveal animates only row node transforms.
        for (let row = 0; row < level.height; row++) {
            const strip = this.node2d('Restored row ' + row, art), g = strip.addComponent(Graphics);
            for (let col = 0; col < level.width; col++) {
                g.fillColor = color(PALETTE[level.pixels[row * level.width + col]]);
                g.rect(-200 + col * step, -step, step + .1, step + .1);
                g.fill();
            }
            strip.active = false;
            rows.push(strip);
        }
        const status = this.text(n, '小蚂蚁带回的颜色，正在拼回这幅画', 0, -275, 25, '#366650', 560);
        const actions = this.node2d('Collection actions', n);
        if (!this.save.claimed.includes(index))
            this.text(actions, '首通奖励 +100 金币 · 主页领取', 0, -277, 24, '#86602E', 550);
        this.button(actions, index < LEVEL_COUNT - 1 ? '下一关' : '完成全部关卡', 0, -345, 480, 72, GREEN, () => {
            if (index < LEVEL_COUNT - 1)
                this.startLevel(index + 1);
            else
                this.showHome();
        }, '#FFFFFF');
        this.button(actions, '换一关', 0, -345 - Math.max(110, this.touchSize + 4), 480, 62, '#E8FAF5', () => {
            this.showHome();
            this.levelPicker();
        });
        actions.active = false;
        const skip = this.button(n, '跳过动画', 0, -442, 260, 56, '#E8FAF5', () => this.finishCelebration()).node.parent!;
        this.celebration = { elapsed: 0, art, rows, album, actions, status, skip };
        this.updateCelebration(0);
    }

    private updateCelebration(dt: number) {
        const c = this.celebration;
        if (!c)
            return;
        c.elapsed += dt;
        const step = 400 / this.model.level.width;
        if (c.elapsed < 2.25) {
            c.rows.forEach((row, i) => {
                const t = Math.min(1, Math.max(0, (c.elapsed - (c.rows.length - 1 - i) * .018) / .7));
                row.active = t > 0;
                const ease = 1 - Math.pow(1 - t, 3);
                row.setPosition(Math.sin(i * 2.4) * 110 * (1 - ease), (250 - i * step) * ease - 320 * (1 - ease));
                row.setScale(.55 + .45 * ease, .55 + .45 * ease, 1);
            });
            if (c.elapsed >= 1.65)
                c.status.string = '每一颗颜色，都回到了画里';
        }
        else {
            const t = Math.min(1, (c.elapsed - 2.25) / .7), ease = t * t * (3 - 2 * t);
            c.album.active = true;
            c.art.setPosition(0, 140 - 20 * ease);
            c.art.setScale(1 - .28 * ease, 1 - .28 * ease, 1);
            c.status.string = '正在整理通关完成…';
            if (t >= 1)
                this.finishCelebration();
        }
    }

    private finishCelebration() {
        const c = this.celebration;
        if (!c)
            return;
        const step = 400 / this.model.level.width;
        c.rows.forEach((row, i) => {
            row.active = true;
            row.setPosition(0, 250 - i * step);
            row.setScale(1, 1, 1);
        });
        c.art.setPosition(0, 120);
        c.art.setScale(.72, .72, 1);
        c.status.node.setPosition(0, -180);
        c.actions.setPosition(0, 35);
        c.album.active = true;
        c.actions.active = true;
        c.skip.active = false;
        c.status.string = `第 ${this.save.selected + 1} 关已完成`;
        // The win was persisted before animation: skipping/backgrounding cannot lose it.
        this.celebration = null;
    }
}
