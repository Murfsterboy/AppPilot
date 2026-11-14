package com.benchtrainer.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException

/**
 * Shows the Bench Trainer web app (bundled in assets) full screen.
 *
 * Assets are served from https://appassets.androidplatform.net/ (the host Android reserves for
 * this) rather than file://, so the app gets a normal web origin and localStorage / IndexedDB
 * keep progress, equipment and photos between launches.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraFile: File? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createWebView()
    }

    /** Builds the WebView. Also used to start afresh if the web page's process dies. */
    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView() {
        web = WebView(this)
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            mediaPlaybackRequiresUserGesture = true
        }

        web.addJavascriptInterface(NativeStore(), "BTNative")

        web.webViewClient = object : WebViewClient() {
            // If Android kills the page's renderer process (e.g. low memory), recover by
            // building a new WebView instead of letting the whole app close.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                if (view === web) {
                    (view.parent as? ViewGroup)?.removeView(view)
                    view.destroy()
                    createWebView()
                }
                return true
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                if (url.host != HOST) return null
                val path = url.path.orEmpty().trimStart('/').ifEmpty { "index.html" }
                if (path.split('/').any { it == ".." }) return notFound()
                return try {
                    val mime = mimeFor(path)
                    WebResourceResponse(mime, if (mime.startsWith("image/") && !mime.contains("svg")) null else "utf-8", assets.open(path))
                } catch (e: IOException) {
                    notFound()
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                // Links to other sites open in the browser.
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                } catch (e: ActivityNotFoundException) {
                    // nothing can open it
                }
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

        web.loadUrl("https://$HOST/index.html")
    }

    /** Offers the camera app and the gallery / files picker for the equipment photo. */
    private fun choosePhoto(callback: ValueCallback<Array<Uri>>): Boolean {
        fileCallback?.onReceiveValue(null)
        fileCallback = callback

        val pick = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
        }
        val extra = mutableListOf<Intent>()
        val camera = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (camera.resolveActivity(packageManager) != null) {
            val file = PhotoProvider.file(this, "capture-${System.currentTimeMillis()}.jpg")
            PhotoProvider.dir(this).listFiles()?.forEach { if (it != file) it.delete() }
            val uri = PhotoProvider.uri(this, file.name)
            cameraFile = file
            camera.putExtra(MediaStore.EXTRA_OUTPUT, uri)
            camera.clipData = ClipData.newRawUri("", uri)
            camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            extra += camera
        }
        val chooser = Intent.createChooser(pick, getString(R.string.choose_photo))
            .putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toTypedArray())
        return try {
            startActivityForResult(chooser, REQ_PHOTO)
            true
        } catch (e: ActivityNotFoundException) {
            fileCallback = null
            callback.onReceiveValue(null)
            false
        }
    }

    @Deprecated("Activity result API needs AndroidX; this app has no dependencies")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQ_PHOTO) return super.onActivityResult(requestCode, resultCode, data)
        val callback = fileCallback ?: return
        fileCallback = null
        val picked = data?.data
        val taken = cameraFile?.takeIf { it.length() > 0 }?.let { PhotoProvider.uri(this, it.name) }
        val result = if (resultCode != RESULT_OK) null else picked ?: taken
        callback.onReceiveValue(result?.let { arrayOf(it) })
    }

    @Deprecated("Predictive back is not enabled for this app")
    override fun onBackPressed() {
        // Lessons, quizzes and screens are hash routes, so Back steps through them.
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        web.destroy()
        super.onDestroy()
    }

    /**
     * Key/value storage for progress and equipment, written to disk synchronously. WebView's own
     * localStorage can lag a few seconds behind, so a quiz result could be lost if the app was
     * swiped away immediately. Only the bundled app's own pages are ever loaded in this WebView.
     */
    inner class NativeStore {
        private val prefs = getSharedPreferences("bench-trainer", MODE_PRIVATE)

        @JavascriptInterface
        fun get(key: String): String? = prefs.getString(key, null)

        @JavascriptInterface
        fun set(key: String, value: String) {
            prefs.edit().putString(key, value).commit()
        }
    }

    private fun notFound() =
        WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    private fun mimeFor(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js" -> "application/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "webmanifest" -> "application/manifest+json"
        "svg" -> "image/svg+xml"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        else -> "application/octet-stream"
    }

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val REQ_PHOTO = 1
    }
}
