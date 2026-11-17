/** All coordinates are in the unscaled modal root, including the native profile button. */
export const WORLD_BOARD = {
    championY: 382,
    runnersY: 202,
    firstRowY: 80,
    rowStep: 72,
    scrollTop: 486,
    scrollBottom: -450,
    scrollWidth: 664,
    summaryY: -486,
    footerAnchorY: -456,
} as const;

export function worldBoardFooter(touchSize: number, consent = false) {
    const gap = Math.max(104, touchSize + 8);
    const returnY = WORLD_BOARD.footerAnchorY - gap;
    const bottom = Math.min(-630, returnY - Math.max(86, touchSize) / 2 - 30);
    return {
        consentY: returnY,
        consentX: 115,
        returnY,
        returnX: consent ? -195 : 0,
        returnWidth: consent ? 210 : 500,
        panelY: (630 + bottom) / 2,
        height: 630 - bottom,
    };
}

/** Includes the podium and bottom padding; short boards never stretch beyond the viewport. */
export function worldBoardContentHeight(lastRank: number) {
    const viewport = WORLD_BOARD.scrollTop - WORLD_BOARD.scrollBottom;
    const bottom =
        lastRank <= 3
            ? WORLD_BOARD.runnersY - 80
            : WORLD_BOARD.firstRowY - (lastRank - 4) * WORLD_BOARD.rowStep - 44;
    return Math.max(viewport, WORLD_BOARD.scrollTop - bottom);
}
