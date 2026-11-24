import { Color, Graphics, Node } from 'cc';

const outlineInk = '#47291F';

/** Builds the resident's joint hierarchy and the temporary paint used before the atlas loads. */
export function joint(parent: Node, name: string, x = 0, y = 0) {
    const node = new Node(name);
    node.layer = parent.layer;
    node.parent = parent;
    node.setPosition(x, y);
    return node;
}

export function oval(
    art: Graphics,
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
    outline = false,
) {
    art.ellipse(x, y, rx, ry);
    art.fillColor = new Color(fill);
    art.fill();
    if (outline) {
        art.strokeColor = new Color(outlineInk);
        art.lineWidth = 3;
        art.stroke();
    }
}

export function polygon(art: Graphics, points: [number, number][], fill: string) {
    points.forEach(([x, y], index) => {
        if (index === 0) art.moveTo(x, y);
        else art.lineTo(x, y);
    });
    art.close();
    art.fillColor = new Color(fill);
    art.fill();
    art.strokeColor = new Color(outlineInk);
    art.lineWidth = 2.5;
    art.stroke();
}
