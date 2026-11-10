/* global require, module */
const layout = require('./layout.js');

// Both renderers use the same logical viewport and bottom safe spacing.
function paint(ctx, surface, images, progress, message, minimumTextSize = 24) {
    const aspect = surface.width / surface.height;
    const width = Math.max(layout.width, layout.minimumHeight * aspect);
    const height = Math.max(layout.minimumHeight, layout.width / aspect);
    ctx.save();
    ctx.scale(surface.width / width, surface.height / height);
    const background = images.background;
    const scale = Math.max(width / background.width, height / background.height);
    ctx.drawImage(
        background,
        (width - background.width * scale) / 2,
        (height - background.height * scale) / 2,
        background.width * scale,
        background.height * scale,
    );
    const titleWidth = Math.min(layout.titleWidth, width - 104);
    ctx.drawImage(
        images.title,
        (width - titleWidth) / 2,
        height * layout.titleTopRatio - titleWidth / 6,
        titleWidth,
        titleWidth / 3,
    );
    const wash = ctx.createLinearGradient(0, height * 0.65, 0, height);
    wash.addColorStop(0, 'rgba(244,248,216,0)');
    wash.addColorStop(1, 'rgba(244,248,216,0.86)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, height * 0.65, width, height * 0.35);
    const w = Math.min(layout.barWidth, width - 184);
    const x = (width - w) / 2;
    const y = height - layout.barBottom - layout.barHeight / 2;
    const rounded = (x, y, w, h, fill) => {
        const r = Math.min(w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    };
    rounded(x, y + 3, w, 30, '#B7C58A');
    rounded(x, y, w, 30, '#FFFAE0');
    const fill = ((w - 8) * progress) / 100;
    if (fill > 0) {
        const gold = ctx.createLinearGradient(0, y + 4, 0, y + 26);
        gold.addColorStop(0, '#FFD96E');
        gold.addColorStop(1, '#EAAF3A');
        rounded(x + 4, y + 4, fill, 22, gold);
        if (fill > 32) rounded(x + 14, y + 7, fill - 20, 3, '#FFF2BD');
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.max(24, minimumTextSize)}px sans-serif`;
    ctx.fillStyle = '#596C3F';
    ctx.fillText(message, x, height - layout.statusBottom, w - 110);
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.max(27, minimumTextSize)}px sans-serif`;
    ctx.fillText(`${Math.floor(progress)}%`, x + w, height - layout.statusBottom);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#65794C';
    ctx.font = `700 ${Math.max(22, minimumTextSize)}px sans-serif`;
    ctx.fillText(layout.healthTitle, width / 2, height - 164);
    ctx.font = `700 ${Math.max(17, minimumTextSize)}px sans-serif`;
    ctx.fillText(layout.healthLines[0], width / 2, height - 127);
    ctx.fillText(layout.healthLines[1], width / 2, height - 98);
    ctx.font = `700 ${Math.max(19, minimumTextSize)}px sans-serif`;
    ctx.fillText(layout.registration, width / 2, height - 44);
    ctx.restore();
}
module.exports = { paint };
