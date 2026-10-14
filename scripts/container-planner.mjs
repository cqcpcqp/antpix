// Offline constructive solver: exhaust one bottom-connected monochrome region at a time.
// All contact directions are allowed; side borders and enclosed holes are not entrances.
export function colorClosure(pixels, width, height, color) {
  const seen = new Uint8Array(pixels.length),
    queue = [],
    result = [];
  const visit = (p) => {
    if (!seen[p] && (pixels[p] < 0 || pixels[p] === color)) {
      seen[p] = 1;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) visit((height - 1) * width + x);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      x = p % width,
      y = Math.floor(p / width);
    if (pixels[p] === color) result.push(p);
    if (x > 0) visit(p - 1);
    if (x + 1 < width) visit(p + 1);
    if (y > 0) visit(p - width);
    if (y + 1 < height) visit(p + width);
  }
  return result;
}
export function planContainers(level, seed = 1) {
  const pixels = [...level.pixels],
    colors = [...new Set(pixels)].filter((c) => c >= 0),
    jars = [];
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let remaining = pixels.filter((c) => c >= 0).length,
    stages = 0;
  while (remaining) {
    const candidates = colors
      .map((color) => ({ color, pixels: colorClosure(pixels, level.width, level.height, color) }))
      .filter((c) => c.pixels.length);
    if (!candidates.length) throw new Error('No reachable monochrome region');
    candidates.sort((a, b) => b.pixels.length - a.pixels.length || a.color - b.color);
    // Limited variety among similarly productive choices, never an inaccessible color.
    const choices = candidates.filter((c) => c.pixels.length >= candidates[0].pixels.length * 0.8);
    const chosen = choices[Math.floor(random() * choices.length)],
      count = chosen.pixels.length;
    // Balance a region across containers instead of producing 40 + an avoidable 1.
    const chunks = Math.ceil(count / level.capacity),
      base = Math.floor(count / chunks),
      extra = count % chunks;
    for (let i = 0; i < chunks; i++) jars.push([chosen.color, base + (i < extra ? 1 : 0)]);
    for (const p of chosen.pixels) pixels[p] = -1;
    remaining -= count;
    stages++;
  }
  return { jars, stages };
}
