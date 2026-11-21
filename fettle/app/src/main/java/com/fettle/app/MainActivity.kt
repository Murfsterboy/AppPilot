package com.fettle.app

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.util.Locale

/**
 * Fettle is a native shell around the bundled guide app in assets/index.html.
 * The web layer handles the guides and UI; this class adds what a phone app needs:
 * drying-timer notifications, camera photos, read-aloud, sharing and the back button.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingSpeech: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applySystemBarColours()

        web = WebView(this)
        web.setBackgroundColor(if (isNight()) BG_DARK else BG_LIGHT)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            textZoom = (resources.configuration.fontScale * 100).toInt()
        }
        web.addJavascriptInterface(Bridge(), "FettleNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "file") return false
                openExternal(url)
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean = choosePhoto(callback)
        }
        setContentView(web)

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState)
        } else {
            web.loadUrl(START_URL + hashFrom(intent))
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val hash = hashFrom(intent)
        if (hash.isNotEmpty()) web.evaluateJavascript("location.hash='${hash.removePrefix("#")}'", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        tts?.shutdown()
        web.destroy()
        super.onDestroy()
    }

    // ---------- photos ----------

    private fun choosePhoto(callback: ValueCallback<Array<Uri>>): Boolean {
        fileCallback?.onReceiveValue(null)
        fileCallback = callback
        cameraUri = null

        val pick = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        val extras = ArrayList<Intent>()
        if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "fettle_${System.currentTimeMillis()}.jpg")
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Fettle")
            }
            cameraUri = try {
                contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            } catch (e: Exception) {
                null
            }
            cameraUri?.let {
                extras += Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    .putExtra(MediaStore.EXTRA_OUTPUT, it)
                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        }
        val chooser = Intent.createChooser(pick, getString(R.string.add_photo))
            .putExtra(Intent.EXTRA_INITIAL_INTENTS, extras.toTypedArray())
        return try {
            startActivityForResult(chooser, REQ_PHOTO)
            true
        } catch (e: ActivityNotFoundException) {
            discardCameraUri()
            fileCallback = null
            callback.onReceiveValue(null)
            false
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PHOTO) return
        val cb = fileCallback ?: return
        fileCallback = null
        val picked = data?.data
        val result: Uri? = when {
            resultCode != RESULT_OK -> null
            picked != null -> picked
            else -> cameraUri
        }
        if (result != cameraUri) discardCameraUri()
        cb.onReceiveValue(result?.let { arrayOf(it) })
    }

    private fun discardCameraUri() {
        cameraUri?.let { try { contentResolver.delete(it, null, null) } catch (_: Exception) {} }
        cameraUri = null
    }

    // ---------- read aloud ----------

    private fun speak(text: String) {
        val engine = tts
        if (engine != null && ttsReady) {
            if (engine.isSpeaking) engine.stop()
            else engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "step")
            return
        }
        pendingSpeech = text
        if (engine == null) {
            tts = TextToSpeech(this) { status ->
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    tts?.language = Locale.UK
                    pendingSpeech?.let { tts?.speak(it, TextToSpeech.QUEUE_FLUSH, null, "step") }
                } else {
                    toast(getString(R.string.no_tts))
                }
                pendingSpeech = null
            }
        }
    }

    // ---------- helpers ----------

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            toast(getString(R.string.no_browser))
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY)
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    private fun isNight() =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    @Suppress("DEPRECATION")
    private fun applySystemBarColours() {
        val night = isNight()
        window.statusBarColor = if (night) BG_DARK else BG_LIGHT
        window.navigationBarColor = if (night) SURFACE_DARK else SURFACE_LIGHT
        var flags = 0
        if (!night) flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        window.decorView.systemUiVisibility = flags
    }

    private fun hashFrom(intent: Intent?): String {
        val target = intent?.getStringExtra(EXTRA_OPEN) ?: return ""
        return if (target.matches(Regex("[a-z0-9-]+"))) "#$target" else ""
    }

    /** Exposed to the web layer as window.FettleNative. */
    inner class Bridge {
        @JavascriptInterface
        fun scheduleTimer(id: String, label: String, endMillis: Double) {
            runOnUiThread {
                askNotificationPermission()
                Timers.schedule(this@MainActivity, id, label, endMillis.toLong())
            }
        }

        @JavascriptInterface
        fun cancelTimer(id: String) {
            runOnUiThread { Timers.cancel(this@MainActivity, id) }
        }

        @JavascriptInterface
        fun speak(text: String) {
            runOnUiThread { this@MainActivity.speak(text) }
        }

        @JavascriptInterface
        fun share(text: String) {
            runOnUiThread {
                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                try {
                    startActivity(Intent.createChooser(send, getString(R.string.share_list)))
                } catch (e: ActivityNotFoundException) {
                    toast(getString(R.string.no_share))
                }
            }
        }
    }

    companion object {
        const val EXTRA_OPEN = "open"
        private const val START_URL = "file:///android_asset/index.html"
        private const val REQ_PHOTO = 1
        private const val REQ_NOTIFY = 2
        private const val BG_LIGHT = 0xFFF3F2EE.toInt()
        private const val BG_DARK = 0xFF111819.toInt()
        private const val SURFACE_LIGHT = 0xFFFFFFFF.toInt()
        private const val SURFACE_DARK = 0xFF1A2326.toInt()
    }
}
