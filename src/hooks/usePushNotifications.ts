import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "../lib/api";

export function usePushNotifications(onNavigate?: (tab: string) => void) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let registered = false;
    const handles: { remove: () => void }[] = [];

    async function setup() {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive !== "granted") return;

      await PushNotifications.register();

      handles.push(await PushNotifications.addListener("registration", ({ value: token }) => {
        if (registered) return;
        registered = true;
        api.setDeviceToken(token).catch(() => {});
      }));

      handles.push(await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const tab = notification.data?.tab as string | undefined;
        if (tab && onNavigate) onNavigate(tab);
      }));
    }

    setup().catch(() => {});

    return () => {
      handles.forEach((h) => h.remove());
    };
  }, [onNavigate]);
}
