export interface BestRun {
    level: number;
    seconds: number;
    moves: number;
}

export interface Profile {
    catalogVersion: number;
    unlocked: number;
    selected: number;
    sound: boolean;
    music: boolean;
    completed: number[];
    coins: number;
    claimed: number[];
    daily: string;
    owned: string[];
    nest: string;
    courtyard: Courtyard;
    best: BestRun[];
}

export const COURTYARD_SLOTS = ['entrance', 'path', 'garden', 'living'] as const;
export type CourtyardSlot = (typeof COURTYARD_SLOTS)[number];
export interface Courtyard {
    owned: string[];
    equipped: Record<CourtyardSlot, string>;
}
export interface Furnishing {
    id: string;
    slot: CourtyardSlot;
    name: string;
    price: number;
    description: string;
}
export const FURNISHINGS: Furnishing[] = [
    {
        id: 'leaf-awning',
        slot: 'entrance',
        name: '叶片雨棚',
        price: 180,
        description: '给洞口添一片遮雨的叶子',
    },
    {
        id: 'mushroom-awning',
        slot: 'entrance',
        name: '蘑菇门廊',
        price: 500,
        description: '圆滚滚的蘑菇撑起温暖门廊',
    },
    {
        id: 'flower-arch',
        slot: 'entrance',
        name: '花藤拱门',
        price: 1000,
        description: '花藤环绕的小窝入口',
    },
    {
        id: 'pebble-path',
        slot: 'path',
        name: '石子小路',
        price: 250,
        description: '把回家的路铺得整整齐齐',
    },
    {
        id: 'wood-path',
        slot: 'path',
        name: '木片步道',
        price: 650,
        description: '一片片木头连成庭院步道',
    },
    {
        id: 'petal-path',
        slot: 'path',
        name: '花瓣小径',
        price: 1200,
        description: '沿着花瓣铺成的小路回家',
    },
    {
        id: 'daisy-bed',
        slot: 'garden',
        name: '雏菊花圃',
        price: 300,
        description: '在门边种下一小片雏菊',
    },
    {
        id: 'mushroom-garden',
        slot: 'garden',
        name: '蘑菇小园',
        price: 700,
        description: '高低错落的蘑菇围成小花园',
    },
    {
        id: 'lantern-garden',
        slot: 'garden',
        name: '灯笼花园',
        price: 1400,
        description: '柔和的小灯照亮花丛',
    },
    {
        id: 'leaf-bed',
        slot: 'living',
        name: '叶片躺椅',
        price: 350,
        description: '搬运之后有个歇脚的地方',
    },
    {
        id: 'seed-pantry',
        slot: 'living',
        name: '种子粮仓',
        price: 850,
        description: '把收集的种子整齐地存起来',
    },
    {
        id: 'dew-pond',
        slot: 'living',
        name: '露珠水池',
        price: 1600,
        description: '石头围起一汪清亮的小水池',
    },
];

export function freshCourtyard(): Courtyard {
    return { owned: [], equipped: { entrance: '', path: '', garden: '', living: '' } };
}

// A one-time stored-profile migration; network consumers use the current contract directly.
export function upgradeCourtyard(profile: Profile): boolean {
    if (Object.prototype.hasOwnProperty.call(profile, 'courtyard')) return false;
    profile.courtyard = freshCourtyard();
    return true;
}

export function buyOrEquipFurnishing(
    profile: Profile,
    id: string,
): 'purchased' | 'equipped' | 'insufficient' | 'invalid' {
    const item = FURNISHINGS.find((value) => value.id === id);
    if (!item) return 'invalid';
    if (profile.courtyard.owned.includes(id)) {
        profile.courtyard.equipped[item.slot] = id;
        return 'equipped';
    }
    if (profile.coins < item.price) return 'insufficient';
    profile.coins -= item.price;
    profile.courtyard.owned.push(id);
    profile.courtyard.equipped[item.slot] = id;
    return 'purchased';
}

export const SKINS = [
    {
        id: 'sand',
        name: '暖沙小窝',
        price: 0,
        rim: '#BD9D70',
        light: '#E1C294',
    },
    {
        id: 'moss',
        name: '苔藓庭院',
        price: 100,
        rim: '#64805A',
        light: '#B5C992',
    },
    {
        id: 'rose',
        name: '玫瑰花园',
        price: 150,
        rim: '#AF7373',
        light: '#E9B0A3',
    },
    {
        id: 'night',
        name: '星夜小筑',
        price: 200,
        rim: '#506A90',
        light: '#9FBAD8',
    },
];

export function freshProfile(): Profile {
    return {
        catalogVersion: 4,
        unlocked: 0,
        selected: 0,
        sound: true,
        music: true,
        completed: [],
        coins: 0,
        claimed: [],
        daily: '',
        owned: ['sand'],
        nest: 'sand',
        courtyard: freshCourtyard(),
        best: [],
    };
}

export function readProfile(raw: string | null, levelCount: number): Profile {
    const base = freshProfile();
    if (!raw) return base;
    try {
        const profile = JSON.parse(raw);
        if (!profile || typeof profile !== 'object') return base;
        const replacedCatalog = profile.catalogVersion !== 4;
        if (replacedCatalog)
            Object.assign(profile, {
                unlocked: 0,
                selected: 0,
                completed: [],
                claimed: [],
                best: [],
            });
        const level = (v: unknown) =>
            Number.isInteger(v) && Number(v) >= 0 && Number(v) < levelCount;
        if (
            !level(profile.unlocked) ||
            !level(profile.selected) ||
            profile.selected > profile.unlocked ||
            typeof profile.sound !== 'boolean' ||
            !Array.isArray(profile.completed) ||
            !profile.completed.every(level)
        )
            return base;
        Object.assign(base, {
            unlocked: profile.unlocked,
            selected: profile.selected,
            sound: profile.sound,
            completed: Array.from(new Set<number>(profile.completed)),
        });
        base.music = typeof profile.music === 'boolean' ? profile.music : profile.sound;
        if (Number.isSafeInteger(profile.coins) && profile.coins >= 0) base.coins = profile.coins;
        if (Array.isArray(profile.claimed))
            base.claimed = Array.from(
                new Set<number>(
                    profile.claimed.filter(
                        (v: unknown) => level(v) && base.completed.includes(Number(v)),
                    ),
                ),
            );
        if (typeof profile.daily === 'string') base.daily = profile.daily;
        if (Array.isArray(profile.owned))
            base.owned = Array.from(
                new Set([
                    'sand',
                    ...profile.owned.filter((v: unknown) => SKINS.some((s) => s.id === v)),
                ]),
            ) as string[];
        if (base.owned.includes(profile.nest)) base.nest = profile.nest;
        if (profile.courtyard && Array.isArray(profile.courtyard.owned)) {
            base.courtyard.owned = Array.from(
                new Set<string>(
                    profile.courtyard.owned.filter((id: unknown) =>
                        FURNISHINGS.some((item) => item.id === id),
                    ),
                ),
            );
            for (const slot of COURTYARD_SLOTS) {
                const id = profile.courtyard.equipped?.[slot];
                if (
                    base.courtyard.owned.includes(id) &&
                    FURNISHINGS.some((item) => item.id === id && item.slot === slot)
                )
                    base.courtyard.equipped[slot] = id;
            }
        }
        if (Array.isArray(profile.best))
            base.best = profile.best.filter(
                (v: BestRun) =>
                    v &&
                    level(v.level) &&
                    Number.isFinite(v.seconds) &&
                    v.seconds > 0 &&
                    Number.isInteger(v.moves) &&
                    v.moves > 0,
            );
        unlockAppendedLevels(base, levelCount);
        return base;
    } catch {
        return base;
    }
}

// Appending artwork does not replace the catalog or erase earned progress.
// A save that finished the old final level can enter the newly added next level.
export function unlockAppendedLevels(profile: Profile, count: number): boolean {
    const previous = profile.unlocked;
    while (profile.unlocked < count - 1 && profile.completed.includes(profile.unlocked))
        profile.unlocked++;
    return profile.unlocked !== previous;
}

export function todayKey(date = new Date()): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function rewardAmount(profile: Profile, day: string): number {
    return (
        profile.completed.filter((l) => !profile.claimed.includes(l)).length * 100 +
        (profile.daily === day ? 0 : 30)
    );
}

export function claimRewards(profile: Profile, day: string): number {
    const amount = rewardAmount(profile, day);
    profile.coins += amount;
    profile.claimed = [...profile.completed];
    profile.daily = day;
    return amount;
}

export function buyOrEquip(
    profile: Profile,
    id: string,
): 'purchased' | 'equipped' | 'insufficient' | 'invalid' {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin) return 'invalid';
    if (profile.owned.includes(id)) {
        profile.nest = id;
        return 'equipped';
    }
    if (profile.coins < skin.price) return 'insufficient';
    profile.coins -= skin.price;
    profile.owned.push(id);
    profile.nest = id;
    return 'purchased';
}

export function recordWin(profile: Profile, run: BestRun, count: number) {
    if (!profile.completed.includes(run.level)) profile.completed.push(run.level);
    profile.unlocked = Math.max(profile.unlocked, Math.min(count - 1, run.level + 1));
    const old = profile.best.find((v) => v.level === run.level);
    if (!old) profile.best.push({ ...run });
    else if (run.seconds < old.seconds || (run.seconds === old.seconds && run.moves < old.moves))
        Object.assign(old, run);
}
