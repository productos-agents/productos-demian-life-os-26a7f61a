"use client";

import { useEffect } from "react";

/**
 * Keeps installed DEMian PWAs aligned with the latest production deployment.
 * Server pages/APIs are intentionally network-first; the service worker only
 * caches a small allowlist of public static assets.
 */
export default function AppUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Only reload when an already-controlled app receives a replacement worker.
    // A first-time install should not cause an unnecessary reload.
    const alreadyControlled = Boolean(navigator.serviceWorker.controller);
    let hasReloaded = false;
    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      if (!alreadyControlled || hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    };

    const checkForUpdates = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });

        // Explicitly ask the browser to compare the worker with the deployed
        // version instead of relying only on its periodic background check.
        await registration.update();

        // Compatibility fallback if a browser leaves the replacement waiting.
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        // Updates will be retried when the app returns online or to foreground.
      }
    };

    // Register the listener before registration/update so we don't miss a
    // fast controller switch during activation.
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void checkForUpdates();
      }
    };
    const onOnline = () => void checkForUpdates();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    void checkForUpdates();
    const interval = window.setInterval(() => {
      if (navigator.onLine) void checkForUpdates();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
