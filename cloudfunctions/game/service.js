const { createHash, randomUUID } = require('node:crypto');
const {
    freshProfile,
    recordWin,
    claimRewards,
    buyOrEquip,
    buyOrEquipFurnishing,
    upgradeCourtyard,
    unlockAppendedLevels,
    COURTYARD_SLOTS,
} = require('./profile');
const { levelCount, levels } = require('./catalog.json');

const APP_ID = 'wxd8e27ad9cd0289df';
const dayAt = (now) => {
    const date = new Date(now + 8 * 60 * 60 * 1000);
    return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
};
class GameError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
function requireRule(condition, code, message) {
    if (!condition) throw new GameError(code, message);
}
const digest = (value) => createHash('sha256').update(value).digest('hex');

// The store adapter executes the callback atomically, including request receipts.
function createService(store, clock = Date.now, uuid = randomUUID) {
    return async (event, context) => {
        try {
            requireRule(
                context.APPID === APP_ID &&
                    typeof context.OPENID === 'string' &&
                    context.OPENID.length > 0,
                'UNAUTHORIZED',
                '请使用当前小游戏的微信账号登录',
            );
            requireRule(
                event.catalogVersion === freshProfile().catalogVersion,
                'VERSION',
                '请更新游戏后重试',
            );
            const uid = digest(context.APPID + ':' + context.OPENID);
            const now = clock();
            if (event.action === 'leaderboard') {
                requireRule(
                    Number.isInteger(event.page) && event.page >= 0 && event.page < 10,
                    'INPUT',
                    '排行榜页码无效',
                );
                const rows = await store.leaderboard(event.page * 10, 11);
                return {
                    ok: true,
                    rows: rows.slice(0, 10).map((row, index) => ({
                        rank: event.page * 10 + index + 1,
                        player: row.player,
                        highest: row.highest,
                        reachedAt: row.reachedAt,
                        self: row._id === uid,
                    })),
                    hasNext: rows.length > 10 && event.page < 9,
                };
            }
            const result = await store.transaction(async (tx) => {
                let user = await tx.get('players', uid);
                if (event.action === 'login') {
                    if (!user) {
                        user = {
                            profile: freshProfile(),
                            player: '蚂蚁' + uuid().replace(/-/g, '').slice(0, 8),
                            highest: 0,
                            reachedAt: 0,
                            adViews: 0,
                            run: null,
                            ad: null,
                            createdAt: now,
                        };
                        await tx.set('players', uid, user);
                    }
                    requireRule(
                        user.profile.catalogVersion === event.catalogVersion,
                        'VERSION',
                        '存档版本需要升级',
                    );
                    const courtyardUpgraded = upgradeCourtyard(user.profile);
                    if (unlockAppendedLevels(user.profile, levelCount) || courtyardUpgraded)
                        await tx.set('players', uid, user);
                    return response(user, now, { userId: uid });
                }
                requireRule(!!user, 'LOGIN', '请重新登录');
                requireRule(
                    user.profile.catalogVersion === event.catalogVersion,
                    'VERSION',
                    '存档版本需要升级',
                );
                if (upgradeCourtyard(user.profile)) await tx.set('players', uid, user);
                requireRule(
                    typeof event.requestId === 'string' &&
                        /^[a-zA-Z0-9_-]{16,100}$/.test(event.requestId),
                    'INPUT',
                    '请求编号无效',
                );
                const receiptId = digest(uid + ':' + event.requestId);
                const fingerprint = digest(JSON.stringify(event));
                const receipt = await tx.get('receipts', receiptId);
                if (receipt) {
                    requireRule(receipt.fingerprint === fingerprint, 'INPUT', '请求编号已经使用');
                    return response(user, now, receipt.output);
                }
                const output = {};
                switch (event.action) {
                    case 'start':
                        requireRule(
                            Number.isInteger(event.level) &&
                                event.level >= 0 &&
                                event.level < levelCount &&
                                event.level <= user.profile.unlocked,
                            'LOCKED',
                            '前一关完成后才能挑战',
                        );
                        user.run = { id: uuid(), level: event.level, startedAt: now };
                        user.profile.selected = event.level;
                        user.ad = null;
                        output.runId = user.run.id;
                        break;
                    case 'complete': {
                        requireRule(
                            user.run && user.run.id === event.runId,
                            'SESSION',
                            '本次挑战已失效，请重新开始',
                        );
                        requireRule(
                            Number.isFinite(event.seconds) &&
                                event.seconds > 0 &&
                                event.seconds <= (now - user.run.startedAt) / 1000 + 5,
                            'INPUT',
                            '通关用时无效',
                        );
                        requireRule(
                            Number.isInteger(event.moves) &&
                                event.moves > 0 &&
                                event.moves <= 100000,
                            'INPUT',
                            '通关步数无效',
                        );
                        const level = user.run.level;
                        requireRule(
                            levels[level].moves.includes(event.moves) &&
                                event.seconds >= levels[level].minimumSeconds,
                            'SCORE',
                            '成绩不符合当前关卡规则',
                        );
                        recordWin(
                            user.profile,
                            { level, seconds: event.seconds, moves: event.moves },
                            levelCount,
                        );
                        if (level + 1 > user.highest) {
                            user.highest = level + 1;
                            user.reachedAt = now;
                        }
                        user.run = null;
                        user.ad = null;
                        break;
                    }
                    case 'claim':
                        output.amount = claimRewards(user.profile, dayAt(now));
                        break;
                    case 'shop':
                        requireRule(typeof event.skin === 'string', 'INPUT', '装扮无效');
                        output.purchase = buyOrEquip(user.profile, event.skin);
                        requireRule(output.purchase !== 'invalid', 'INPUT', '装扮无效');
                        requireRule(
                            output.purchase !== 'insufficient',
                            'COINS',
                            '金币不足，请先领取奖励',
                        );
                        break;
                    case 'furnish':
                        requireRule(typeof event.item === 'string', 'INPUT', '庭院装饰无效');
                        output.purchase = buyOrEquipFurnishing(user.profile, event.item);
                        requireRule(output.purchase !== 'invalid', 'INPUT', '庭院装饰无效');
                        requireRule(
                            output.purchase !== 'insufficient',
                            'COINS',
                            '金币不足，请先领取奖励',
                        );
                        break;
                    case 'unfurnish':
                        requireRule(COURTYARD_SLOTS.includes(event.slot), 'INPUT', '庭院位置无效');
                        user.profile.courtyard.equipped[event.slot] = '';
                        break;
                    case 'adStart':
                        requireRule(
                            user.run && user.run.id === event.runId,
                            'SESSION',
                            '请先开始挑战',
                        );
                        requireRule(
                            event.placement === 'speed' || event.placement === 'slot',
                            'INPUT',
                            '广告入口无效',
                        );
                        requireRule(
                            !user.ad || now - user.ad.startedAt >= 5000,
                            'RATE',
                            '请稍后再试',
                        );
                        user.ad = {
                            id: uuid(),
                            runId: user.run.id,
                            placement: event.placement,
                            startedAt: now,
                        };
                        output.adId = user.ad.id;
                        break;
                    case 'adComplete':
                        requireRule(
                            user.ad &&
                                user.ad.id === event.adId &&
                                user.run &&
                                user.ad.runId === user.run.id,
                            'SESSION',
                            '本次广告已失效，请重新观看',
                        );
                        requireRule(
                            now - user.ad.startedAt <= 60 * 60 * 1000,
                            'SESSION',
                            '本次广告已过期',
                        );
                        user.adViews += 1;
                        user.ad = null;
                        break;
                    default:
                        throw new GameError('INPUT', '未知操作');
                }
                await tx.set('players', uid, user);
                await tx.set('receipts', receiptId, { fingerprint, output, createdAt: now });
                return response(user, now, output);
            });
            return result;
        } catch (error) {
            if (error instanceof GameError)
                return { ok: false, code: error.code, message: error.message };
            throw error;
        }
    };
}
function response(user, now, output) {
    return {
        ok: true,
        profile: user.profile,
        day: dayAt(now),
        serverTime: now,
        adViews: user.adViews,
        highest: user.highest,
        reachedAt: user.reachedAt,
        output,
    };
}
module.exports = { createService, dayAt };
