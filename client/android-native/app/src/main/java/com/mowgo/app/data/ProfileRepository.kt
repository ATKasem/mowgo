package com.mowgo.app.data

import com.mowgo.app.data.model.Profile
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ProfileRepository {
    suspend fun loadProfile(): Profile? {
        if (!SupabaseClientProvider.isConfigured) return demoProfile()
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id ?: return null
        // decodeList + firstOrNull: an empty result is a normal "no profile yet" case;
        // network/auth/decoding errors still propagate to the caller.
        val profiles = SupabaseClientProvider.client.from("profiles").select {
            filter { eq("id", userId) }
        }.decodeList<Profile>()
        return profiles.firstOrNull()
    }

    suspend fun updateProfile(
        businessName: String,
        phone: String,
        email: String,
        venmoHandle: String = "",
        cashappHandle: String = "",
        zelleHandle: String = "",
    ) {
        if (!SupabaseClientProvider.isConfigured) {
            val current = demoProfile()
            demoProfileMutable = Profile(
                businessName = businessName,
                phone = phone,
                email = email,
                venmoHandle = venmoHandle,
                cashappHandle = cashappHandle,
                zelleHandle = zelleHandle,
                tier = current.tier,
                role = current.role,
                businessId = current.businessId,
            )
            return
        }
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
            ?: throw IllegalStateException("Not authenticated")
        // RLS grants authenticated updates to business_name, phone, and the
        // payment handles (019) — email is auth-managed and must NOT be
        // included or the whole update is rejected.
        SupabaseClientProvider.client.from("profiles").update(
            mapOf(
                "business_name" to businessName,
                "phone" to phone,
                "venmo_handle" to venmoHandle,
                "cashapp_handle" to cashappHandle,
                "zelle_handle" to zelleHandle,
            )
        ) { filter { eq("id", userId) } }
    }

    // MARK: - Trial-first no-card flow (spec 2026-08-07)

    /**
     * Grant the 14-day no-card trial for a plan. Returns true if granted.
     * One-shot per human (email-normalized, enforced server-side) — repeated
     * calls return false.
     */
    suspend fun grantTrial(plan: String): Boolean {
        if (!SupabaseClientProvider.isConfigured) return false
        val granted: Boolean = SupabaseClientProvider.client.postgrest.rpc(
            "grant_trial",
            buildJsonObject { put("p_plan", plan) },
        ).decodeAs()
        return granted
    }

    /**
     * Expire any past app trial (idempotent, cheap). Call on app open / after
     * sign-in so the UI converges even if the daily cron hasn't run yet.
     */
    suspend fun expireTrial(): Boolean {
        if (!SupabaseClientProvider.isConfigured) return false
        val expired: Boolean = SupabaseClientProvider.client.postgrest.rpc(
            "expire_trial",
            buildJsonObject {},
        ).decodeAs()
        return expired
    }

    private fun demoProfile(): Profile {
        val sessionEmail = runCatching {
            SupabaseClientProvider.auth.currentSessionOrNull()?.user?.email
        }.getOrNull()
        return demoProfileMutable ?: Profile(
            businessName = "Green Thumb Lawn Care",
            phone = "405-555-0100",
            email = sessionEmail ?: "owner@mowgoapp.com",
            tier = "solo",
            role = "owner",
        )
    }

    companion object {
        @Volatile private var demoProfileMutable: Profile? = null

        /** Reset demo profile state on sign-out so the next demo session starts fresh. */
        fun resetDemoState() {
            demoProfileMutable = null
        }
    }
}
