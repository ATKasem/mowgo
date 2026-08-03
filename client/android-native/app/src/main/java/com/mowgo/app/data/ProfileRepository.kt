package com.mowgo.app.data

import com.mowgo.app.data.model.Profile
import io.github.jan.supabase.postgrest.from

class ProfileRepository {
    suspend fun loadProfile(): Profile? {
        if (!SupabaseClientProvider.isConfigured) return demoProfile()
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id ?: return null
        return try {
            SupabaseClientProvider.client.from("profiles").select {
                filter { eq("id", userId) }
            }.decodeSingle<Profile>()
        } catch (_: Exception) {
            null
        }
    }

    suspend fun updateProfile(businessName: String, phone: String, email: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoProfileMutable = Profile(businessName, phone, email, demoProfile().tier)
            return
        }
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
            ?: throw IllegalStateException("Not authenticated")
        SupabaseClientProvider.client.from("profiles").update(
            mapOf("business_name" to businessName, "phone" to phone, "email" to email)
        ) { filter { eq("id", userId) } }
    }

    private fun demoProfile(): Profile {
        val sessionEmail = runCatching {
            SupabaseClientProvider.auth.currentSessionOrNull()?.user?.email
        }.getOrNull()
        return demoProfileMutable ?: Profile(
            businessName = "Green Thumb Lawn Care",
            phone = "405-555-0100",
            email = sessionEmail ?: "owner@mowgo.app",
            tier = "solo",
        )
    }

    companion object {
        @Volatile private var demoProfileMutable: Profile? = null
    }
}
