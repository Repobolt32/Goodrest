package com.goodrest.rider;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.goodrest.rider.locationsync.LocationSyncPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Register the native location-sync plugin before the bridge initializes,
    // so it is available when the WebView's JS calls it.
    this.registerPlugin(LocationSyncPlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onStart() {
    super.onStart();
    WebView webView = (WebView) this.bridge.getWebView();
    if (webView != null) {
      webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
  }
}
