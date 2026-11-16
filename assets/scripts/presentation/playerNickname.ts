/** Keep combining accents, emoji joins, skin tones and regional flag pairs intact. */
export function nicknameClusters(value: string): string[] {
    const clusters: string[] = [];
    let joined = false;
    let regional = false;
    for (const char of value.replace(/\s+/gu, ' ')) {
        const point = char.codePointAt(0)!;
        const flag = point >= 0x1f1e6 && point <= 0x1f1ff;
        const attachment =
            /\p{Mark}/u.test(char) || (point >= 0x1f3fb && point <= 0x1f3ff) || point === 0x200d;
        if (clusters.length && (attachment || joined || (flag && regional))) {
            clusters[clusters.length - 1] += char;
        } else clusters.push(char);
        joined = point === 0x200d;
        regional = flag && !regional;
    }
    return clusters;
}

/** Measure with the actual Label font, preserving its readable size instead of shrinking names. */
export function ellipsizeNickname(
    value: string,
    width: number,
    measure: (text: string) => number,
): string {
    const clusters = nicknameClusters(value);
    const name = clusters.join('');
    if (measure(name) <= width) return name;
    const suffix = '…';
    let low = 0;
    let high = clusters.length;
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (measure(clusters.slice(0, middle).join('') + suffix) <= width) low = middle;
        else high = middle - 1;
    }
    return clusters.slice(0, low).join('') + suffix;
}
