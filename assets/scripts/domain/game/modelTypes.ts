/** Container identity survives slot reuse; pickups belong to jarId until delivery. */
export interface Jar {
    id: number;
    color: number;
    capacity: number;
    /** Undelivered pixels, including trips that have already departed. */
    remaining: number;
}

export interface Pickup {
    pixel: number;
    slot: number;
    color: number;
    jarId: number;
    approach: {
        x: number;
        y: number;
    };
}
