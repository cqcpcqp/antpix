export const MELON_PRICE = 15;
export const PET_HOUR = 3600000;
export const FULL_HOURS = 72;
export const PAT_LIMIT = 3;

interface PetCare {
    health: number;
    healthAt: number;
    mood: number;
    moodAt: number;
    patDay: string;
    pats: number;
}

export interface Pet {
    id: 0;
    name: string;
    fedUntil: number;
    rationDay: string;
    care: PetCare;
}

export interface Pets {
    residents: [Pet];
    melons: number;
}

interface PetProfile {
    pets: Pets;
    coins: number;
}

function freshCare(now: number): PetCare {
    return { health: 100, healthAt: now, mood: 60, moodAt: now, patDay: '', pats: 0 };
}

/** Reads saved care snapshots at the storage boundary, including saves made before care existed. */
export function readPetCare(saved: Partial<PetCare> | null | undefined, now: number): PetCare {
    if (
        saved &&
        typeof saved.health === 'number' &&
        saved.health >= 60 &&
        saved.health <= 100 &&
        typeof saved.mood === 'number' &&
        saved.mood >= 0 &&
        saved.mood <= 100 &&
        typeof saved.healthAt === 'number' &&
        Number.isSafeInteger(saved.healthAt) &&
        saved.healthAt >= 0 &&
        typeof saved.moodAt === 'number' &&
        Number.isSafeInteger(saved.moodAt) &&
        saved.moodAt >= 0 &&
        typeof saved.patDay === 'string' &&
        typeof saved.pats === 'number' &&
        Number.isInteger(saved.pats) &&
        saved.pats >= 0 &&
        saved.pats <= PAT_LIMIT
    ) {
        const { health, healthAt, mood, moodAt, patDay, pats } = saved as PetCare;
        return { health, healthAt, mood, moodAt, patDay, pats };
    }
    return freshCare(now);
}

export function freshPets(now: number): Pets {
    return {
        residents: [
            {
                id: 0,
                name: '栗栗',
                fedUntil: now + FULL_HOURS * PET_HOUR,
                rationDay: '',
                care: freshCare(now),
            },
        ],
        melons: 0,
    };
}

/** Derives current values without advancing or writing a save every frame. */
export function petVitals(pet: Pet, now: number) {
    const { care, fedUntil } = pet;
    const fedHours = Math.max(0, Math.min(now, fedUntil) - care.healthAt) / PET_HOUR;
    const hungrySince = Math.max(fedUntil, care.healthAt);
    const hungryHours = Math.max(0, (now - hungrySince) / PET_HOUR - 12);
    const health = Math.max(
        60,
        Math.min(100, care.health + Math.floor(fedHours)) - Math.floor(hungryHours / 3),
    );
    const moodSteps = Math.floor(Math.max(0, now - care.moodAt) / (6 * PET_HOUR));
    const mood =
        care.mood + Math.sign(60 - care.mood) * Math.min(moodSteps, Math.abs(60 - care.mood));
    const satiety = Math.min(100, Math.max(0, ((fedUntil - now) * 100) / (FULL_HOURS * PET_HOUR)));
    return { health, satiety, mood };
}

export function canBoostMood(pet: Pet, day: string) {
    return pet.care.patDay !== day || pet.care.pats < PAT_LIMIT;
}

function addMood(pet: Pet, now: number, amount: number) {
    pet.care.mood = Math.min(100, petVitals(pet, now).mood + amount);
    pet.care.moodAt = Math.max(now, pet.care.moodAt);
}

export function petAction(
    profile: PetProfile,
    action: unknown,
    id: unknown,
    value: unknown,
    now: number,
    day: string,
): string {
    if (action === 'buy') {
        if (profile.coins < MELON_PRICE) return '金币不足';
        profile.coins -= MELON_PRICE;
        profile.pets.melons++;
        return '';
    }
    if (id !== 0) return '这只蚂蚁不在庭院';
    const [pet] = profile.pets.residents;
    if (action === 'pat') {
        if (!canBoostMood(pet, day)) return '';
        addMood(pet, now, 8);
        pet.care.pats = pet.care.patDay === day ? pet.care.pats + 1 : 1;
        pet.care.patDay = day;
        return '';
    }
    if (action === 'rename') {
        const name = typeof value === 'string' ? value.trim() : '';
        if (!/^[\p{L}\p{N} ]{1,8}$/u.test(name)) return '名字需要一到八个字';
        pet.name = name;
        return '';
    }
    if (action === 'feed') {
        if (pet.fedUntil >= now + (FULL_HOURS - 1 / 60) * PET_HOUR) return '吃饱啦';
        if (value === 'melon') {
            if (!profile.pets.melons) return '西瓜丁用完了';
            profile.pets.melons--;
        } else if (value === 'ration') {
            if (pet.rationDay === day) return '今天的口粮已经吃过了';
            pet.rationDay = day;
        } else return '请选择食物';
        if (pet.fedUntil <= now) {
            pet.care.health = petVitals(pet, now).health;
            pet.care.healthAt = Math.max(now, pet.care.healthAt);
        }
        addMood(pet, now, 4);
        pet.fedUntil = Math.min(
            now + FULL_HOURS * PET_HOUR,
            Math.max(now, pet.fedUntil) + (value === 'melon' ? 48 : 24) * PET_HOUR,
        );
        return '';
    }
    return '操作无效';
}
