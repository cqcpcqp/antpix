const cloud = require('wx-server-sdk');
const { createService } = require('./service');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const service = createService({
    transaction: work => db.runTransaction(async transaction => work({
        get: async (collection, id) => (await transaction.collection(collection).doc(id).get()).data,
        set: (collection, id, data) => {
            // CloudBase returns _id on reads; the document path owns this immutable field.
            const { _id, ...fields } = data;
            return transaction.collection(collection).doc(id).set({ data: fields });
        },
    })),
    leaderboard: async (skip, limit) => (await db.collection('players')
        .where({ highest: db.command.gt(0) })
        .orderBy('highest', 'desc').orderBy('reachedAt', 'asc').orderBy('_id', 'asc')
        .skip(skip).limit(limit).field({ player: true, highest: true, reachedAt: true }).get()).data,
});
exports.main = event => service(event, cloud.getWXContext());
