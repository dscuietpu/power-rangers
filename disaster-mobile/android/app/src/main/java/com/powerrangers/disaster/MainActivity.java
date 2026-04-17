package com.powerrangers.disaster;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createEmergencyNotificationChannel();
    }

    /**
     * Creates a high-priority notification channel with a custom siren sound.
     * This channel is used for all disaster/SOS push notifications.
     * The siren will play even when the app is closed/backgrounded.
     */
    private void createEmergencyNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "disaster_alerts",
                "Disaster Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Emergency SOS and disaster alert notifications with siren sound");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500, 200, 500, 200, 500});
            channel.enableLights(true);
            channel.setLightColor(0xFFEF4444); // Red

            // Set custom siren sound
            Uri soundUri = Uri.parse(
                ContentResolver.SCHEME_ANDROID_RESOURCE + "://" +
                getPackageName() + "/raw/siren"
            );
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)  // ALARM usage = plays at alarm volume, overrides silent mode
                .build();
            channel.setSound(soundUri, audioAttributes);

            // Also create the default Capacitor channel for non-emergency notifications
            NotificationChannel defaultChannel = new NotificationChannel(
                "PushPluginChannel",
                "General Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            defaultChannel.setDescription("General app notifications");

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                notificationManager.createNotificationChannel(defaultChannel);
            }
        }
    }
}
