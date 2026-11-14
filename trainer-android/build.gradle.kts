plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Bench Trainer for Android: the web app in ../trainer bundled as assets and shown in a WebView,
// so it installs from GitHub Releases like AppPilot and works offline.
android {
    namespace = "com.benchtrainer.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.benchtrainer.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    sourceSets["main"].assets.srcDirs("../trainer")
    androidResources {
        // Default ignore list plus the Markdown docs, which the app doesn't need.
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:.*:<dir>_*:!CVS:!thumbs.db:!picasa.ini:!*~:!*.md"
    }

    // Same fixed key as AppPilot so each new build installs over the previous one.
    signingConfigs {
        create("shared") {
            storeFile = file("../app/apppilot.keystore")
            storePassword = "android"
            keyAlias = "apppilot"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("shared")
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("shared")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
