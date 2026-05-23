import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.scoreday.app',
  appName: 'Score Day',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
  },
  ...(isDev && {
    server: {
      url: 'http://10.0.2.2:5173',
      cleartext: true,
    },
  }),
};

export default config;
