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
        workers: 4,
        delay: 0,
        failureRate: 0,
        color: "green",
        speed: "Auto"
    },
    media: {
        name: "media",
        label: "Media Studio (100Mbps, Stable)",
        chunkSize: 5 * 1024 * 1024,
        workers: 8,
        delay: 0,
        failureRate: 0,
        color: "green",
        speed: "100Mbps"
    },
    rural: {
        name: "rural",
        label: "Rural Lab (2G, Unstable)",
        chunkSize: 5 * 1024,
        workers: 1,
        delay: 2000,
        failureRate: 30,
        color: "red",
        speed: "2G"
    },
    mobile: {
        name: "mobile",
        label: "Mobile Clinic (4G, Handoffs)",
        chunkSize: 500 * 1024,
        workers: 3,
        delay: 500,
        failureRate: 15,
        color: "yellow",
        speed: "4G"
    },
    satellite: {
        name: "satellite",
        label: "Remote Engineering (Satellite)",
        chunkSize: 1024 * 1024,
        workers: 2,
        delay: 800,
        failureRate: 10,
        color: "yellow",
        speed: "Satellite"
    },
    disaster: {
        name: "disaster",
        label: "Disaster Zone (3G, Intermittent)",
        chunkSize: 100 * 1024,
        workers: 2,
        delay: 1500,
        failureRate: 40,
        color: "red",
        speed: "3G"
    }
};