"use client";

import { useEffect, useState } from "react";

import { isIOS, isStandalonePWA } from "./pwa";
import { safeWrite } from "./storage";

// Suppression key — persists the user's dismissal so we don't
// re-prompt on every load. Lives in localStorage like every other
// preference, and writes through safeWrite so a quota-full state
// doesn't crash the dismiss.
export const INSTALL_PROMPT_DISMISSED_KEY = "simple-todos:install-prompted";

interface InstallPromptState {
    /** Stop showing the banner now and on future loads. */
    dismiss: () => void;
    /**
     * True when the user is on an iOS device, is *not* already running
     * the installed PWA, and hasn't dismissed the prompt previously.
     * This is the only state that surfaces the banner — Android Chrome
     * has its own native install affordance via `beforeinstallprompt`,
     * which we don't need to duplicate.
     */
    shouldPrompt: boolean;
}

export function useInstallPrompt(): InstallPromptState {
    // Hydration-safe initial state: render-time defaults to `false`
    // so SSR and the first client paint agree, then we upgrade in an
    // effect once we can read navigator + localStorage.
    const [shouldPrompt, setShouldPrompt] = useState(false);

    useEffect(() => {
        if (!isIOS()) return;
        if (isStandalonePWA()) return;
        if (
            globalThis.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) ===
            "1"
        ) {
            return;
        }
        // setState-in-effect is the right pattern here: the inputs
        // (navigator UA, navigator.standalone, localStorage) are
        // external systems, not derivable React state. We deliberately
        // start `false` to keep SSR + first-paint identical, then
        // upgrade once we can read those signals client-side.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShouldPrompt(true);
    }, []);

    return {
        dismiss: () => {
            safeWrite(INSTALL_PROMPT_DISMISSED_KEY, "1");
            setShouldPrompt(false);
        },
        shouldPrompt,
    };
}
