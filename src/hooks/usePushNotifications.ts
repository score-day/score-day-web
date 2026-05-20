import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "../lib/api";

export function usePushNotifications(onNavigate?: (tab: string) => void) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let registered = false;

    async function setup() {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive !== "granted") return;

      await PushNotifications.register();

      PushNotifications.addListener("registration", ({ value: token }) => {
        if (registered) return;
        registered = true;
        api.setDeviceToken(token).catch(() => {});
      });

      PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const tab = notification.data?.tab as string | undefined;
        if (tab && onNavigate) onNavigate(tab);
      });
    }

    setup().catch(() => {});

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [onNavigate]);
}
