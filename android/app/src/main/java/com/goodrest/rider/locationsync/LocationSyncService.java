package com.goodrest.rider.locationsync;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.Logger;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Foreground service that captures the rider's GPS via FusedLocationProviderClient
 * and POSTs each fix to the web backend, all on a native thread.
 *
 * <p>This is the fix for the background-location bug: previously the upload ran in a
 * JS callback inside the WebView, which Android freezes when the app is backgrounded
 * / screen-off. Running the capture+upload here keeps {@code riders.current_location}
 * updating regardless of WebView state.</p>
 *
 * <p>Each fix is also forwarded to JS via {@link #setFixListener(FixListener)} (only
 * useful while the WebView is alive, e.g. to keep lastLat/lastLng populated for the
 * "Start Riding" button).</p>
 */
public class LocationSyncService extends Service {

    public static final String ACTION_START = "com.goodrest.rider.locationsync.START";
    public static final String ACTION_STOP = "com.goodrest.rider.locationsync.STOP";

    public static final String EXTRA_TOKEN = "token";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_INTERVAL_MILLIS = "intervalMillis";
    public static final String EXTRA_DISTANCE_METERS = "distanceFilterMeters";

    public static final int DEFAULT_INTERVAL_MILLIS = 8000;
    public static final int DEFAULT_DISTANCE_METERS = 10;

    private static final String CHANNEL_ID = "goodrest_location_sync";
    private static final int NOTIFICATION_ID = 0xBEEF;

    /** Each location fix is optionally forwarded to JS (plugin registers this). */
    public interface FixListener {
        void onFix(double lat, double lng);
    }

    private static final AtomicReference<WeakReference<FixListener>> FIX_LISTENER = new AtomicReference<>();

    public static void setFixListener(@Nullable FixListener listener) {
        FIX_LISTENER.set(listener == null ? null : new WeakReference<>(listener));
    }

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;

    // Connection params for the running session; cleared on stop.
    private final AtomicReference<String> tokenRef = new AtomicReference<>();
    private final AtomicReference<String> urlRef = new AtomicReference<>();

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Started service, not bound.
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null) {
            // Service restarted by the system after a kill. Nothing to resume without params.
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(action)) {
            startForegroundWithNotification();
            startTracking(intent);
        }
        // If we've been started, keep the service alive until explicitly stopped.
        return START_STICKY;
    }

    private void startTracking(Intent intent) {
        // If already tracking, stop the previous session before applying new params.
        if (locationCallback != null) {
            stopLocationUpdates();
        }

        tokenRef.set(intent.getStringExtra(EXTRA_TOKEN));
        urlRef.set(intent.getStringExtra(EXTRA_URL));
        int interval = intent.getIntExtra(EXTRA_INTERVAL_MILLIS, DEFAULT_INTERVAL_MILLIS);
        int distance = intent.getIntExtra(EXTRA_DISTANCE_METERS, DEFAULT_DISTANCE_METERS);

        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, interval)
                .setMinUpdateIntervalMillis(interval)
                .setMinUpdateDistanceIntervalMeters(distance)
                .setWaitForAccurateLocation(false)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@androidx.annotation.NonNull LocationResult result) {
                Location location = result.getLastLocation();
                if (location != null) {
                    handleFix(location.getLatitude(), location.getLongitude());
                }
            }
        };

        try {
            // Requires ACCESS_FINE_LOCATION; declared in manifest and checked by the plugin.
            fusedClient.requestLocationUpdates(request, locationCallback, ioExecutor);
        } catch (SecurityException e) {
            Logger.error("LocationSync", "Missing location permission; cannot request updates", e);
            stopSelf();
        }
    }

    private void handleFix(double lat, double lng) {
        // Upload on this (executor) thread. Ignore result; failures are logged and swallowed
        // so a transient server/429 error never tears down tracking.
        upload(lat, lng);

        FixListener listener = null;
        WeakReference<FixListener> ref = FIX_LISTENER.get();
        if (ref != null) {
            listener = ref.get();
        }
        if (listener != null) {
            listener.onFix(lat, lng);
        }
    }

    private void upload(double lat, double lng) {
        String urlStr = urlRef.get();
        String token = tokenRef.get();
        if (urlStr == null || token == null) {
            return;
        }

        HttpURLConnection conn = null;
        try {
            URL endpoint = new URL(urlStr);
            conn = (HttpURLConnection) endpoint.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("lat", lat);
            body.put("lng", lng);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code == 429) {
                // Rate-limited by the server; just skip this fix.
            } else if (code == 401) {
                // Token expired/invalid. Log and keep running; rider must re-login.
                Logger.warn("LocationSync", "Upload rejected with 401; token may have expired");
            } else if (code >= 400) {
                Logger.warn("LocationSync", "Upload failed with HTTP " + code);
            }
        } catch (Exception e) {
            // Network errors are expected intermittently (e.g. tunnels dropping).
            // Keep the service alive; the next fix will retry.
            Logger.warn("LocationSync", "Upload threw: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void stopTracking() {
        stopLocationUpdates();
        tokenRef.set(null);
        urlRef.set(null);
    }

    private void stopLocationUpdates() {
        if (locationCallback != null && fusedClient != null) {
            try {
                fusedClient.removeLocationUpdates(locationCallback);
            } catch (Exception e) {
                Logger.warn("LocationSync", "Failed to remove location updates: " + e.getMessage());
            }
            locationCallback = null;
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App was swiped away — stop tracking rather than lingering as a ghost service.
        stopTracking();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        stopTracking();
        setFixListener(null);
        super.onDestroy();
    }

    private void startForegroundWithNotification() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+ requires declaring the foreground service type at start.
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(getResources().getIdentifier("location_sync_title", "string", getPackageName())))
                .setContentText(getString(getResources().getIdentifier("location_sync_text", "string", getPackageName())))
                .setSmallIcon(getResources().getIdentifier("ic_stat_notify", "drawable", getPackageName()))
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    getString(getResources().getIdentifier("location_sync_channel_name", "string", getPackageName())),
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(getString(getResources().getIdentifier("location_sync_channel_desc", "string", getPackageName())));
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
