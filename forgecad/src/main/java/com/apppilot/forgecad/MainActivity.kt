package com.apppilot.forgecad

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import org.json.JSONObject
import java.io.IOException

/**
 * Hosts the ForgeCAD web app (bundled in assets/web) in a WebView. Files are served from the APK
 * under a private https origin so Web Workers, WebAssembly and IndexedDB all work offline.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: ByteArray? = null
    private var pageReady = false
    private var pendingOpen: Pair<String, String>? = null

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val ORIGIN = "https://$HOST/"
        private const val REQ_OPEN = 41
        private const val REQ_SAVE = 42
        private const val MAX_OPEN_BYTES = 150L * 1024 * 1024
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            textZoom = 100
            cacheMode = WebSettings.LOAD_NO_CACHE
            mediaPlaybackRequiresUserGesture = true
        }
        web.addJavascriptInterface(Bridge(), "ForgeBridge")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                if (url.host != HOST) return null
                var path = url.path ?: "/"
                if (path == "/" || path.isEmpty()) path = "/index.html"
                return try {
                    val stream = assets.open("web" + path)
                    WebResourceResponse(mimeFor(path), if (isText(path)) "utf-8" else null, stream).apply {
                        responseHeaders = mapOf("Cache-Control" to "no-cache", "Cross-Origin-Resource-Policy" to "same-origin")
                    }
                } catch (e: IOException) {
                    WebResourceResponse("text/plain", "utf-8", 404, "Not found", emptyMap(), "".byteInputStream())
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                // never navigate away from the app (it's offline anyway)
                return request.url.host != HOST
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                pendingOpen?.let { deliverFile(it.first, it.second) }
                pendingOpen = null
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                }
                return try {
                    startActivityForResult(intent, REQ_OPEN); true
                } catch (e: Exception) {
                    fileCallback = null; false
                }
            }
        }
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(ORIGIN + "index.html")
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.forgeBack && window.forgeBack()) ? 'yes' : 'no'") { r ->
            if (r?.contains("yes") != true) {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        // ask the app to save immediately when we go to the background
        web.evaluateJavascript("window.forgecad && window.forgecad.saveNow && window.forgecad.saveNow()", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_OPEN -> {
                val cb = fileCallback
                fileCallback = null
                if (resultCode != RESULT_OK || data == null) { cb?.onReceiveValue(null); return }
                val uris = mutableListOf<Uri>()
                data.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri) }
                if (uris.isEmpty()) data.data?.let { uris.add(it) }
                cb?.onReceiveValue(uris.toTypedArray())
            }
            REQ_SAVE -> {
                val bytes = pendingSave
                pendingSave = null
                var ok = false
                val uri = data?.data
                if (resultCode == RESULT_OK && uri != null && bytes != null) {
                    try {
                        contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) }
                        ok = true
                        Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(this, "Couldn't save: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
                web.evaluateJavascript("window.__forgeSaveDone && window.__forgeSaveDone($ok)", null)
            }
        }
    }

    private fun handleIntent(intent: Intent?) {
        intent ?: return
        val uri: Uri? = when (intent.action) {
            Intent.ACTION_VIEW -> intent.data
            Intent.ACTION_SEND -> {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
            }
            else -> null
        }
        uri ?: return
        try {
            var name = "file"
            var size = -1L
            contentResolver.query(uri, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val si = c.getColumnIndex(OpenableColumns.SIZE)
                    if (ni >= 0) name = c.getString(ni) ?: name
                    if (si >= 0 && !c.isNull(si)) size = c.getLong(si)
                }
            }
            if (size > MAX_OPEN_BYTES) { Toast.makeText(this, "File is too large to open", Toast.LENGTH_LONG).show(); return }
            val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return
            val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            if (pageReady) deliverFile(name, b64) else pendingOpen = name to b64
        } catch (e: Exception) {
            Toast.makeText(this, "Couldn't open file: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun deliverFile(name: String, b64: String) {
        val n = JSONObject.quote(name)
        val b = JSONObject.quote(b64)
        web.evaluateJavascript("if (window.forgeOpenFile) window.forgeOpenFile($n, $b); else window.__pendingOpen = {name: $n, b64: $b};", null)
    }

    private fun isText(path: String) = path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css") ||
        path.endsWith(".svg") || path.endsWith(".json") || path.endsWith(".txt") || path.endsWith(".webmanifest")

    private fun mimeFor(path: String): String = when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".js") -> "text/javascript"
        path.endsWith(".css") -> "text/css"
        path.endsWith(".wasm") -> "application/wasm"
        path.endsWith(".svg") -> "image/svg+xml"
        path.endsWith(".json") || path.endsWith(".webmanifest") -> "application/json"
        path.endsWith(".png") -> "image/png"
        path.endsWith(".txt") -> "text/plain"
        else -> "application/octet-stream"
    }

    /** Called from JavaScript as window.ForgeBridge. */
    inner class Bridge {
        @JavascriptInterface
        fun saveFile(name: String, mime: String, base64: String) {
            val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: Exception) { null }
            runOnUiThread {
                if (bytes == null) {
                    web.evaluateJavascript("window.__forgeSaveDone && window.__forgeSaveDone(false)", null)
                    return@runOnUiThread
                }
                pendingSave = bytes
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = if (mime.isBlank()) "application/octet-stream" else mime
                    putExtra(Intent.EXTRA_TITLE, name)
                }
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, REQ_SAVE)
                } catch (e: Exception) {
                    pendingSave = null
                    web.evaluateJavascript("window.__forgeSaveDone && window.__forgeSaveDone(false)", null)
                }
            }
        }

        @JavascriptInterface
        fun platform(): String = "android"
    }
}
