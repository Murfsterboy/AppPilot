package com.benchtrainer.app

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Minimal content provider for camera photos (a tiny stand-in for AndroidX FileProvider, which
 * this dependency-free project doesn't use). It only serves files in cache/photos.
 */
class PhotoProvider : ContentProvider() {

    companion object {
        fun dir(ctx: Context) = File(ctx.cacheDir, "photos").apply { mkdirs() }
        fun file(ctx: Context, name: String) = File(dir(ctx), name)
        fun uri(ctx: Context, name: String): Uri = Uri.parse("content://${ctx.packageName}.photos/$name")
    }

    private fun resolve(uri: Uri): File {
        val name = uri.lastPathSegment ?: throw FileNotFoundException()
        if (name.contains('/') || name.startsWith(".")) throw FileNotFoundException(name)
        return file(context!!, name)
    }

    override fun onCreate() = true

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor =
        ParcelFileDescriptor.open(resolve(uri), ParcelFileDescriptor.parseMode(mode))

    override fun getType(uri: Uri) = "image/jpeg"

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
        val f = resolve(uri)
        val cols = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        return MatrixCursor(cols, 1).apply {
            addRow(cols.map { if (it == OpenableColumns.SIZE) f.length() else if (it == OpenableColumns.DISPLAY_NAME) f.name else null })
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0
}
