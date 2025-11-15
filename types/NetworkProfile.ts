export type NetworkProfile = {
    name: string;
    label: string;
    chunkSize: number;
    workers: number;
    delay: number;
    failureRate: number;
    color: string;
    speed: string;
};

export const NETWORK_PROFILES: Record<string, NetworkProfile> = {
    normal: {
        name: "normal",
        label: "Normal Network",
        chunkSize: 10 * 1024 * 1024,
        workers: 40,
        delay: 0,
        failureRate: 0,
        color: "green",
        speed: "Auto"
    }
};