package dev.themos.regimen

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Edge to edge, the window no longer shrinks for the keyboard, so it would cover the
    // field being typed in. Ending the page at the keyboard's top lets the WebView scroll
    // that field into view; the page's own insets still cover the status and nav bars.
    ViewCompat.setOnApplyWindowInsetsListener(findViewById<View>(android.R.id.content)) { view, insets ->
      view.updatePadding(bottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
      insets
    }
  }
}
