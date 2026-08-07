# kotlinx.serialization keep rules
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.mowgo.app.**$$serializer { *; }
-keepclassmembers class com.mowgo.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.mowgo.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Supabase
-keep class io.github.jan.supabase.** { *; }
-keep class io.github.jan.tennert.supabase.** { *; }

# Ktor HTTP engine (service-loader discovery — REQUIRED or release builds crash
# at startup: "Failed to find HTTP client engine implementation in the classpath")
-keep class io.ktor.client.engine.okhttp.** { *; }
-keep class io.ktor.client.HttpClientEngineContainer { *; }

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
