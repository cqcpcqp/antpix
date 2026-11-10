// Friend identities remain inside the WeChat open data context.
const canvas = wx.getSharedCanvas();
const context = canvas.getContext('2d');
const SCORE_KEY = 'ant-progress-v4';
let page = 0;
let rows = [];
let status = '';
let generation = 0;
// Cache only the current response's images; callbacks from older requests are ignored.
let avatars = new Map();
function loadAvatars(request) {
    for (const row of rows) {
        if (avatars.has(row.avatarUrl)) continue;
        const image = wx.createImage();
        const entry = { image, ready: false };
        avatars.set(row.avatarUrl, entry);
        image.onload = () => {
            if (request !== generation) return;
            entry.ready = true;
            render();
        };
        image.onerror = (error) => {
            if (request !== generation) return;
            console.warn('Friend avatar failed to load', error);
        };
        image.src = row.avatarUrl;
    }
}
function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(canvas.width / 640, canvas.height / 960);
    context.fillStyle = '#465438';
    context.textAlign = 'center';
    context.font = '28px sans-serif';
    if (status) context.fillText(status, 320, 160);
    rows.slice(page * 8, page * 8 + 8).forEach((row, index) => {
        const y = 70 + index * 100;
        const avatar = avatars.get(row.avatarUrl);
        if (avatar?.ready) context.drawImage(avatar.image, 65, y - 42, 64, 64);
        context.textAlign = 'left';
        context.fillText(`${page * 8 + index + 1}`, 15, y);
        context.fillText(Array.from(row.nickname).slice(0, 9).join(''), 145, y, 300);
        context.textAlign = 'right';
        context.fillText(`第 ${row.highest} 关`, 625, y);
    });
    context.textAlign = 'center';
    context.font = '24px sans-serif';
    if (rows.length)
        context.fillText(`第 ${page + 1} / ${Math.ceil(rows.length / 8)} 页`, 320, 920);
    context.restore();
}
wx.onMessage((message) => {
    if (message.type === 'ant-friends-page') {
        page = Math.min(
            Math.max(0, page + message.delta),
            Math.max(0, Math.ceil(rows.length / 8) - 1),
        );
        render();
        return;
    }
    if (message.type === 'engine') {
        render();
        return;
    }
    if (message.type !== 'ant-friends') return;
    const request = ++generation;
    status = '正在读取好友成绩';
    rows = [];
    avatars = new Map();
    render();
    wx.getFriendCloudStorage({
        keyList: [SCORE_KEY],
        success: (result) => {
            if (request !== generation) return;
            rows = result.data
                .filter((user) => user.KVDataList.some((item) => item.key === SCORE_KEY))
                .map((user) => {
                    const score = JSON.parse(
                        user.KVDataList.find((item) => item.key === SCORE_KEY).value,
                    );
                    return {
                        nickname: user.nickname,
                        avatarUrl: user.avatarUrl,
                        openid: user.openid,
                        highest: score.highest,
                        reachedAt: score.reachedAt,
                    };
                })
                .filter((row) => row.highest > 0);
            rows.sort(
                (a, b) =>
                    b.highest - a.highest ||
                    a.reachedAt - b.reachedAt ||
                    a.openid.localeCompare(b.openid),
            );
            page = Math.min(message.page, Math.max(0, Math.ceil(rows.length / 8) - 1));
            status = rows.length ? '' : '暂无同玩好友成绩';
            render();
            loadAvatars(request);
        },
        fail: (error) => {
            if (request !== generation) return;
            console.error('Friend cloud storage failed', error);
            status = '读取失败，请点击刷新重试';
            render();
        },
    });
});
