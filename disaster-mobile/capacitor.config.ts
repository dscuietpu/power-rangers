import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.powerrangers.disaster',
  appName: 'Power Rangers - Disaster Response',
  webDir: 'www',

  // ====================================================================
  // REMOTE URL — Points the native shell to your running web app.
  //
  // For DEVELOPMENT: Use your local network IP (run `ipconfig` to find it).
  //   Example: http://10.132.145.212:3000
  //
  // For PRODUCTION: Use your deployed URL (e.g. Vercel).
  //   Example: https://your-app.vercel.app
  //
  // Comment out this block to use the local www/ folder instead.
  // ====================================================================
  server: {
    url: 'http://10.132.145.86:3000',  // <-- Change this to your deployed URL for production
    cleartext: true,  // Allow HTTP for local dev (Android blocks HTTP by default)
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#EF4444',
      sound: 'siren.wav',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#EF4444',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },

  android: {
    allowMixedContent: true,  // For dev: allow HTTP resources
  },
};

export default config;
