package com.mowgo.app.data

import com.mowgo.app.data.model.ReferralStats
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ReferralRepository {
    suspend fun loadStats(): ReferralStats? {
        if (!SupabaseClientProvider.isConfigured) return DEMO_STATS
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
            ?: throw IllegalStateException("Not authenticated")
        return SupabaseClientProvider.client.postgrest.rpc(
            "get_referral_stats",
            buildJsonObject { put("user_id", userId) },
        ).decodeList<ReferralStats>().firstOrNull()
    }

    suspend fun generateCode(): String {
        if (!SupabaseClientProvider.isConfigured) return DEMO_STATS.code
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
            ?: throw IllegalStateException("Not authenticated")
        return SupabaseClientProvider.client.postgrest.rpc(
            "generate_referral_code",
            buildJsonObject { put("user_id", userId) },
        ).decodeAs()
    }

    companion object {
        private val DEMO_STATS = ReferralStats("MOWGO123", 3, 1, 1, 1, 1)
    }
}
