package dev.themos.regimen

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // The Syncthing folder is on shared storage, which needs "All files access".
    // Coming back from the settings screen brings the app to the foreground, which reloads the logs.
    if (!Environment.isExternalStorageManager()) {
      startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName")))
    }
  }
}
