// Generated from visible digit ink; do not use system-font advance widths.
const metrics: number[][] = [[27,149384,13.501593209446796],[16,80499,10.803047242822892],[25,131877,12.224493277827067],[26,143251,14.013546153255474],[28,134374,15.210896453182908],[26,150131,12.590460997395608],[27,162323,12.973789912704916],[25,98417,12.948022191288091],[27,164574,13.694113286424344],[27,162037,13.608327110474768]];

export function containerNumberOffset(text: string, size: number): number {
    let pen = 0, weight = 0, moment = 0, right = 0;
    for (const digit of text) {
        const [width, mass, center] = metrics[Number(digit)];
        moment += (pen + center) * mass;
        weight += mass;
        right = pen + width;
        pen += width + 3;
    }
    return weight ? (right / 2 - moment / weight) * size / 48 : 0;
}
