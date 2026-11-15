plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.apppilot.launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.apppilot.launcher"
        minSdk = 26
        targetSdk = 34
        // CI run number, so every build has a higher version (testers can tell builds apart; Play needs it too).
        val build = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
        versionCode = build
        versionName = "1.0.$build"
    }

    // A fixed key so each new build installs over the previous one
    // (personal app; not intended for Play Store distribution).
    signingConfigs {
        create("shared") {
            storeFile = file("apppilot.keystore")
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
