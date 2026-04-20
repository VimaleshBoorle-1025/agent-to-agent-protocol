plugins {
    `java-library`
    kotlin("jvm") version "1.9.22"
    kotlin("plugin.serialization") version "1.9.22"
    `maven-publish`
}

group   = "dev.aap"
version = "1.0.0"

kotlin { jvmToolchain(17) }

repositories {
    mavenCentral()
    google()
}

dependencies {
    // HTTP + WebSocket (Android-compatible, zero-config)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")

    // JSON serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // Ed25519 + SHA-256 via Bouncy Castle (available on all Android API levels)
    implementation("org.bouncycastle:bcprov-jdk18on:1.78.1")

    // Testing
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId    = "dev.aap"
            artifactId = "aap-android"
            version    = "1.0.0"
            from(components["java"])
            pom {
                name.set("AAP Android SDK")
                description.set("Agent Authentication Protocol SDK for Android & JVM")
                url.set("https://github.com/VimaleshBoorle-1025/agent-to-agent-protocol")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
            }
        }
    }
}
