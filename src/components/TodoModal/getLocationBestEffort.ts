// Best-effort browser geolocation; resolves null on unsupported
// platforms, denied permission, or timeout. Module-scoped so it isn't
// re-created on every render.
export async function getLocationBestEffort(): Promise<null | {
    latitude: number;
    longitude: number;
}> {
    if (
        typeof navigator === "undefined" ||
        // TS types `navigator.geolocation` as always defined, but it's
        // genuinely absent in sandboxed contexts (iOS Lockdown mode, http
        // origins, headless browsers without the API enabled).
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        !navigator.geolocation
    ) {
        return null;
    }
    return new Promise((resolve) => {
        // Only fires after the user explicitly clicks the
        // "Generate description with AI" button — that's the feature intent.
        // eslint-disable-next-line sonarjs/no-intrusive-permissions
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                });
            },
            () => {
                resolve(null);
            },
            { maximumAge: 600_000, timeout: 6000 },
        );
    });
}
