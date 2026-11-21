# Methods called from JavaScript must keep their names.
-keepclassmembers class com.apppilot.forgecad.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
