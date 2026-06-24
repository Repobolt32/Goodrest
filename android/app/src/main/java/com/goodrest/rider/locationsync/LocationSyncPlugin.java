package com.goodrest.rider.locationsync;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that bridges JS to the native {@link LocationSyncService}.
 *
 * The actual GPS capture + HTTP upload lives in the foreground service so it
 * keeps running when the WebView is frozen (app backgrounded / screen off).
 * This plugin only starts/stops the service and forwards each fix back to JS
 * via the {@code locationUpdate} event (so lastLat/lastLng stay populated while
 * the rider is actively using the app).
 */
@CapacitorPlugin(name = "LocationSync")
public class LocationSyncPlugin extends Plugin {

    /** JS event name for each new location fix: { lat: double, lng: double }. */
    public static final String EVENT_LOCATION_UPDATE = "locationUpdate";

    @Override
    public void load() {
        // Register as the service's fix listener so each GPS fix is forwarded to JS.
        // Held via a WeakReference by the service, so it never keeps the plugin alive.
        LocationSyncService.setFixListener((lat, lng) -> emitLocation(lat, lng));
    }

    /**
     * Start the foreground location-sync service.
     *
     * Options (all from JS):
     *   token              String  Rider JWT, sent as `Authorization: Bearer <token>`
     *   url                String  Absolute URL to POST {lat,lng} to
     *   intervalMillis     int     GPS sample interval (default 8000)
     *   distanceFilterMeters int    Min distance between fixes (default 10)
     */
    @PluginMethod
    public void startTracking(PluginCall call) {
        String token = call.getString("token");
        String url = call.getString("url");

        if (token == null || token.isEmpty()) {
            call.reject("token is required");
            return;
        }
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        if (!hasLocationPermission()) {
            call.reject("Location permission not granted. Grant precise location and background location in settings.");
            return;
        }

        Integer intervalMillis = call.getInt("intervalMillis", LocationSyncService.DEFAULT_INTERVAL_MILLIS);
        Integer distanceFilterMeters = call.getInt("distanceFilterMeters", LocationSyncService.DEFAULT_DISTANCE_METERS);

        Intent intent = new Intent(getContext(), LocationSyncService.class)
                .setAction(LocationSyncService.ACTION_START)
                .putExtra(LocationSyncService.EXTRA_TOKEN, token)
                .putExtra(LocationSyncService.EXTRA_URL, url)
                .putExtra(LocationSyncService.EXTRA_INTERVAL_MILLIS, intervalMillis)
                .putExtra(LocationSyncService.EXTRA_DISTANCE_METERS, distanceFilterMeters);

        ContextCompat.startForegroundService(getContext(), intent);

        call.resolve();
    }

    /** Stop the foreground location-sync service and release the GPS callback. */
    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), LocationSyncService.class)
                .setAction(LocationSyncService.ACTION_STOP);
        getContext().startService(intent);
        LocationSyncService.setFixListener(null);
        call.resolve();
    }

    /**
     * Forward a location fix from the service back to JS. Called by the service
     * on its own thread; notifyListeners is safe to call from any thread.
     */
    public void emitLocation(double lat, double lng) {
        JSObject data = new JSObject();
        data.put("lat", lat);
        data.put("lng", lng);
        notifyListeners(EVENT_LOCATION_UPDATE, data);
    }

    private boolean hasLocationPermission() {
        boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        if (!fine) return false;

        // Background location is a separate runtime permission on Android 10+.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }
}
