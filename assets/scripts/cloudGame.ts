import type { Profile } from './profile';

export const CLOUD_ENV = 'cloudbase-d9glil4qk6b5865ba';
export const CATALOG_VERSION = 4;
export interface CloudState {
    ok: true;
    profile: Profile;
    day: string;
    serverTime: number;
    adViews: number;
    highest: number;
    reachedAt: number;
    output: { userId?: string; runId?: string; adId?: string; amount?: number; purchase?: string };
}
export interface WorldBoard {
    ok: true;
    rows: { rank: number; player: string; highest: number; reachedAt: number; self: boolean }[];
    hasNext: boolean;
}
type Failure = { ok: false; code: string; message: string };
type Request = { action: string; catalogVersion: number; requestId?: string; [key: string]: unknown };
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
type Transport = <T>(data: Request) => Promise<T | Failure>;
export class CloudGameError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}
export function wechatAvailable(): boolean {
    return typeof (globalThis as unknown as { wx?: unknown }).wx !== 'undefined';
}
export function wechatTransport(): Transport {
    const wxApi = (globalThis as unknown as { wx: { cloud: {
        init(options: { env: string }): void;
        callFunction(options: { name: string; data: Request }): Promise<{ result: unknown }>;
    } } }).wx;
    wxApi.cloud.init({ env: CLOUD_ENV });
    return async <T>(data: Request) => (await wxApi.cloud.callFunction({ name: 'game', data })).result as T | Failure;
}

// Persist the exact request before sending; a timeout may have happened after commit.
export class CloudGame {
    private userId = '';
    private busy = false;
    private transport: Transport;
    private storage: Storage;
    constructor(transport: Transport, storage: Storage) {
        this.transport = transport;
        this.storage = storage;
    }
    private key() { return `ant-cloud-pending:${CLOUD_ENV}:${this.userId}`; }
    private async call<T extends { ok: true }>(data: Request): Promise<T> {
        const result = await this.transport<T>(data);
        if (!result.ok) throw new CloudGameError(result.code, result.message);
        return result;
    }
    async login(): Promise<CloudState> {
        const state = await this.call<CloudState>({ action: 'login', catalogVersion: CATALOG_VERSION });
        this.userId = state.output.userId!;
        const pending = this.storage.getItem(this.key());
        if (pending) return this.send(JSON.parse(pending));
        return state;
    }
    async mutate(action: string, values: Record<string, unknown> = {}): Promise<CloudState> {
        if (this.busy) throw new Error('Another cloud request is running');
        if (!this.userId) throw new Error('Cloud login is required');
        const pending = this.storage.getItem(this.key());
        const request: Request = pending ? JSON.parse(pending) : {
            ...values, action, catalogVersion: CATALOG_VERSION,
            requestId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2),
        };
        if (pending && (request.action !== action || Object.keys(values).some(key => request[key] !== values[key])))
            throw new Error('Resolve the pending request before starting another action');
        this.storage.setItem(this.key(), JSON.stringify(request));
        return this.send(request);
    }
    private async send(request: Request): Promise<CloudState> {
        this.busy = true;
        try {
            const state = await this.call<CloudState>(request);
            this.storage.removeItem(this.key());
            return state;
        } catch (error) {
            if (error instanceof CloudGameError) this.storage.removeItem(this.key());
            throw error;
        } finally {
            this.busy = false;
        }
    }
    leaderboard(page: number): Promise<WorldBoard> {
        return this.call({ action: 'leaderboard', catalogVersion: CATALOG_VERSION, page });
    }
}
