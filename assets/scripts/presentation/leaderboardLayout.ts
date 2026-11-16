/** Shared geometry keeps cards, native consent hit areas and footer controls apart. */
export const WORLD_BOARD = {
    height: 1390,
    championY: 438,
    runnersY: 256,
    firstRowY: 128,
    rowStep: 72,
    laterPageY: 452,
    laterPageStep: 84,
    summaryY: -368,
    paginationY: -424,
} as const;

export function worldBoardFooter(touchSize: number) {
    const gap = Math.max(105, touchSize + 4);
    return {
        consentY: -424 - gap,
        returnY: -424 - gap * 2,
        height: 1390 + 4 * (gap - 105) + Math.max(0, touchSize - 110),
    };
}
