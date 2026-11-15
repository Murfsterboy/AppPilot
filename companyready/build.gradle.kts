plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Signing: CI and local builds use the bundled companyready.keystore so new builds install
// over old ones. For Google Play, create your own private upload key and pass it in with
// these Gradle properties or environment variables (never commit the real key):
//   CR_UPLOAD_STORE_FILE, CR_UPLOAD_STORE_PASSWORD, CR_UPLOAD_KEY_ALIAS, CR_UPLOAD_KEY_PASSWORD
fun setting(name: String): String? =
    (project.findProperty(name) as String?) ?: System.getenv(name)

android {
    namespace = "com.apppilot.companyready"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.apppilot.companyready"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        create("shared") {
            val upload = setting("CR_UPLOAD_STORE_FILE")
            if (upload != null) {
                storeFile = file(upload)
                storePassword = setting("CR_UPLOAD_STORE_PASSWORD")
                keyAlias = setting("CR_UPLOAD_KEY_ALIAS")
                keyPassword = setting("CR_UPLOAD_KEY_PASSWORD")
            } else {
                storeFile = file("companyready.keystore")
                storePassword = "android"
                keyAlias = "companyready"
                keyPassword = "android"
            }
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
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
