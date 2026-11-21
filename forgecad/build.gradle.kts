plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The web app (CAD UI, geometry kernel, slicer, CAM) is built from forgecad/web into
// src/main/assets/web by `npm ci && npm run build` (CI does this before Gradle runs).

android {
    namespace = "com.apppilot.forgecad"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.apppilot.forgecad"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    // Same fixed key as AppPilot so updates install over the previous build.
    signingConfigs {
        create("shared") {
            storeFile = file("../app/apppilot.keystore")
            storePassword = "android"
            keyAlias = "apppilot"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("shared") }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("shared")
        }
    }

    // keep the WebAssembly kernel uncompressed so it streams in quickly
    androidResources { noCompress += listOf("wasm") }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

// Fail early with a clear message if the web part hasn't been built.
tasks.register("checkWebAssets") {
    doLast {
        if (!file("src/main/assets/web/index.html").exists()) {
            throw GradleException("ForgeCAD web assets missing. Run: cd forgecad/web && npm ci && npm run build")
        }
    }
}
tasks.named("preBuild") { dependsOn("checkWebAssets") }
