package com.apppilot.launcher

import android.content.Context
import android.graphics.Color
import android.util.TypedValue
import android.view.View

fun Context.dp(v: Float): Float =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)

fun Context.dpi(v: Int): Int = dp(v.toFloat()).toInt()

fun Context.sp(v: Float): Float =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, v, resources.displayMetrics)

/** Tablets (and large foldables): the smaller screen side is at least 600dp. */
fun Context.isTablet(): Boolean = resources.configuration.smallestScreenWidthDp >= 600

/** How much bigger the home screen's clock, text and feed are drawn on a tablet. */
fun Context.uiScale(): Float = if (isTablet()) 1.45f else 1f

fun View.dp(v: Float): Float = context.dp(v)
fun View.sp(v: Float): Float = context.sp(v)
fun View.dpi(v: Int): Int = context.dpi(v)

object Colors {
    fun blend(a: Int, b: Int, t: Float): Int {
        val u = 1f - t
        return Color.argb(
            (Color.alpha(a) * u + Color.alpha(b) * t).toInt(),
            (Color.red(a) * u + Color.red(b) * t).toInt(),
            (Color.green(a) * u + Color.green(b) * t).toInt(),
            (Color.blue(a) * u + Color.blue(b) * t).toInt()
        )
    }

    fun withAlpha(c: Int, alpha: Float): Int {
        val a = (Color.alpha(c) * alpha).toInt().coerceIn(0, 255)
        return (c and 0x00FFFFFF) or (a shl 24)
    }

    fun isLight(c: Int): Boolean = Color.luminance(c) > 0.5f

    fun hex(c: Int): String = String.format("#%06X", 0xFFFFFF and c)
}
