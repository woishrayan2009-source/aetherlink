import { useEffect, useState } from "react";
import { detectConnectionSpeed } from "@/utils/helpers/file";
import { NETWORK_PROFILES } from "@/types/NetworkProfile";

export function useNetworkDetection(selectedProfile: string) {
    const [networkInfo, setNetworkInfo] = useState({
        type: "Auto",
        chunkSize: 10 * 1024 * 1024
    });

    const currentProfile = NETWORK_PROFILES[selectedProfile];

    useEffect(() => {
        const updateNetwork = async () => {
            if (selectedProfile === "normal") {
                const info = await detectConnectionSpeed();
                setNetworkInfo(info);
            } else {
                setNetworkInfo({
                    type: currentProfile.speed,
                    chunkSize: currentProfile.chunkSize
                });
            }
        };

        updateNetwork();

        const connection = (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection;

        if (connection) {
            connection.addEventListener("change", updateNetwork);
            return () => connection.removeEventListener("change", updateNetwork);
        }
    }, [selectedProfile, currentProfile.speed, currentProfile.chunkSize]);

    return { networkInfo, currentProfile };
}
