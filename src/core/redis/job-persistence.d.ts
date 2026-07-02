export declare class JobPersistence {
    private readonly prefix;
    private client;
    constructor();
    get enabled(): boolean;
    private key;
    saveJob(jobId: string, payload: Record<string, unknown>): Promise<void>;
    close(): Promise<void>;
}
