import type { Metadata, Viewport } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
});

export const metadata: Metadata = {
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Todos",
    },
    applicationName: "Simple Todos",
    description: "Minimalist PWA todo app with labels, sorting and filtering.",
    icons: {
        apple: [{ sizes: "180x180", url: "/icons/apple-touch-icon.png" }],
        icon: [
            { sizes: "192x192", type: "image/png", url: "/icons/icon-192.png" },
            { sizes: "512x512", type: "image/png", url: "/icons/icon-512.png" },
        ],
    },
    manifest: "/manifest.webmanifest",
    title: "Simple Todos",
};

export const viewport: Viewport = {
    initialScale: 1,
    themeColor: [
        { color: "#F7F8FA", media: "(prefers-color-scheme: light)" },
        { color: "#0B0C10", media: "(prefers-color-scheme: dark)" },
    ],
    viewportFit: "cover",
    width: "device-width",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
            lang="en"
            suppressHydrationWarning
        >
            <head>
                {/* Set theme class before paint so the page never flashes the wrong scheme. */}
                <script
                    dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
                />
            </head>
            <body className="min-h-full flex flex-col bg-bg text-fg">
                {children}
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
