import type { Metadata } from "next";

export const siteConfig = {
    name: "AetherLink",
    description: "A self-healing, adaptive file transfer system that ensures reliable data delivery even on unstable networks.",
    url: "https://aetherlink.dev",
    ogImage: "https://aetherlink.dev/og_image.png",
    logo: "https://aetherlink.dev/logo.png",
    twitter: "@howankush07",
    themeColor: "#00E0FF"
};

export const metadata: Metadata = {
    title: {
        default: `${siteConfig.name} - Adaptive File Transfer Reinvented`,
        template: `%s - ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: [
        "AetherLink",
        "File Transfer",
        "Reliable Networking",
        "Go Backend",
        "Next.js Frontend",
        "Ankush Singh",
    ],
    authors: [{ name: "Ankush Singh" }],
    creator: "Ankush Singh",

    metadataBase: new URL(siteConfig.url),
    alternates: {
        canonical: "/",
    },

    openGraph: {
        type: "website",
        locale: "en_US",
        url: siteConfig.url,
        title: `${siteConfig.name} - Adaptive File Transfer Reinvented`,
        description: siteConfig.description,
        siteName: siteConfig.name,
        images: [
            {
                url: siteConfig.ogImage,
                width: 1200,
                height: 627,
                alt: siteConfig.name,
            },
        ],
    },

    twitter: {
        card: "summary_large_image",
        creator: siteConfig.twitter,
        title: `${siteConfig.name} - Adaptive File Transfer Reinvented`,
        description: siteConfig.description,
        images: [
            {
                url: siteConfig.ogImage,
                width: 1200,
                height: 627,
                alt: siteConfig.name,
            },
        ],
    },

    manifest: "/manifest.webmanifest",

    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },

    // verification: {
    //     google: "",
    // },
};

export default siteConfig;
