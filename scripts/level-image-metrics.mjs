import { colorClosure } from './container-simulation.mjs';

// Image-only measurements use production bottom-entry, four-way connectivity.
// They describe structural risk, not player difficulty or a proof of solvability.
export function imageMetrics(level) {
  const { pixels, width, height, capacity } = level;
  const colors = [...new Set(pixels)].filter((color) => color >= 0);
  const counts = new Map(colors.map((color) => [color, pixels.filter((c) => c === color).length]));
  const seen = new Set(),
    components = [];
  for (let pixel = 0; pixel < pixels.length; pixel++) {
    if (pixels[pixel] < 0 || seen.has(pixel)) continue;
    const color = pixels[pixel],
      queue = [pixel];
    seen.add(pixel);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor],
        x = current % width,
        y = Math.floor(current / width);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];
      for (const next of neighbors)
        if (next >= 0 && !seen.has(next) && pixels[next] === color) {
          seen.add(next);
          queue.push(next);
        }
    }
    components.push({ color, size: queue.length, origin: pixel });
  }
  components.sort((a, b) => b.size - a.size || a.origin - b.origin);
  const occupied = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const sortedColors = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const opening = colors
    .map((color) => ({
      color,
      count: colorClosure(pixels, width, height, color).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const work = [...pixels],
    sweeps = [];
  while (work.some((color) => color >= 0)) {
    const reachable = colors
      .map((color) => ({
        color,
        cells: colorClosure(work, width, height, color),
      }))
      .filter((entry) => entry.cells.length > 0);
    if (!reachable.length) throw new Error('Image sweep requires a bottom-connected board');
    reachable.sort((a, b) => b.cells.length - a.cells.length || a.color - b.color);
    const opportunities = reachable.filter(
      ({ color, cells }) =>
        cells.length < capacity && work.filter((c) => c === color).length > cells.length,
    ).length;
    const chosen = reachable[0];
    sweeps.push({ color: chosen.color, count: chosen.cells.length, opportunities });
    chosen.cells.forEach((pixel) => (work[pixel] = -1));
  }
  return {
    occupied,
    colors: colors.length,
    componentCount: components.length,
    maxComponent: components[0]?.size ?? 0,
    maxComponentShare: occupied ? components[0].size / occupied : 0,
    topThreeColorShare: occupied
      ? sortedColors.slice(0, 3).reduce((sum, item) => sum + item[1], 0) / occupied
      : 0,
    bulkPixelShare: occupied
      ? components.filter((c) => c.size >= capacity * 3).reduce((sum, c) => sum + c.size, 0) /
        occupied
      : 0,
    largestOpening: opening[0]?.count ?? 0,
    openingColors: opening.length,
    sweepCount: sweeps.length,
    largestSweep: Math.max(0, ...sweeps.map((sweep) => sweep.count)),
    opportunityStates: sweeps.filter((sweep) => sweep.opportunities > 0).length,
    topComponents: components.slice(0, 6),
    topColors: sortedColors.slice(0, 5).map(([color, count]) => ({ color, count })),
    sweeps,
  };
}

// Draft triage thresholds prioritize manual review. They are neither approved
// artwork gates nor a difficulty score, and never modify source manifests.
export const IMAGE_REVIEW_THRESHOLDS = {
  priority: { componentShare: 0.1, topThreeColorShare: 0.55, bulkPixelShare: 0.45 },
  review: { componentShare: 0.05, topThreeColorShare: 0.4, bulkPixelShare: 0.25 },
};

export function imageReview(metrics) {
  for (const [tier, thresholds] of Object.entries(IMAGE_REVIEW_THRESHOLDS)) {
    const reasons = [];
    if (metrics.maxComponentShare >= thresholds.componentShare)
      reasons.push('large-connected-region');
    if (metrics.topThreeColorShare >= thresholds.topThreeColorShare)
      reasons.push('dominant-three-colors');
    if (metrics.bulkPixelShare >= thresholds.bulkPixelShare) reasons.push('bulk-area');
    if (reasons.length) return { tier, reasons };
  }
  return { tier: 'candidate', reasons: [] };
}
