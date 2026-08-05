package com.mowgo.app.data

import android.content.Context
import com.mowgo.app.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime

/**
 * Supabase client singleton for MowGo.
 * Reads URL and anon key from BuildConfig fields injected via gradle.
 *
 * The anon key IS public — it ships in every web/mobile client.
 * Never put the service_role key in client code.
 */
object SupabaseClientProvider {

    private lateinit var applicationContext: Context

    fun initialize(context: Context) {
        applicationContext = context.applicationContext
    }

    val client: SupabaseClient by lazy {
        check(::applicationContext.isInitialized) { "SupabaseClientProvider must be initialized by MowGoApplication" }
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            install(Auth) {
                sessionManager = EncryptedSessionManager(applicationContext)
            }
            install(Postgrest)
            install(Realtime)
        }
    }

    /** Convenience accessor for the Auth module. */
    val auth: Auth get() = client.auth

    /** Returns true if the project URL/key are configured (not placeholders). */
    val isConfigured: Boolean
        get() = !BuildConfig.SUPABASE_URL.contains("YOUR_") &&
                !BuildConfig.SUPABASE_ANON_KEY.contains("YOUR_") &&
                BuildConfig.SUPABASE_URL.isNotEmpty() &&
                BuildConfig.SUPABASE_ANON_KEY.isNotEmpty()
}
