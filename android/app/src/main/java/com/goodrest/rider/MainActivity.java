package com.goodrest.rider;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
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
