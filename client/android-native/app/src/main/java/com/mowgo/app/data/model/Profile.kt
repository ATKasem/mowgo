package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.ceil
import kotlin.math.max

@Serializable
data class Profile(
    @SerialName("business_name") val businessName: String = "",
    val phone: String = "",
    val email: String = "",
    @SerialName("venmo_handle") val venmoHandle: String = "",
    @SerialName("cashapp_handle") val cashappHandle: String = "",
    @SerialName("zelle_handle") val zelleHandle: String = "",
    val tier: String = "free",
    @SerialName("role") val role: String? = null,
    @SerialName("business_id") val businessId: String? = null,
    /// Trial-first no-card flow: plan granted during trial + expiry.
    /// `select=*` in fetchProfile picks these up automatically.
    @SerialName("trial_tier") val trialTier: String? = null,
    @SerialName("trial_ends_at") val trialEndsAt: String? = null,
) {
    /** True while a 14-day app trial is active (trialTier set, not expired). */
    val hasActiveTrial: Boolean
        get() {
            val endRaw = trialEndsAt ?: return false
            if (trialTier == null) return false
            return try {
                Instant.parse(endRaw).isAfter(Instant.now())
            } catch (_: Exception) {
                false
            }
        }

    /** True when this user already used their app trial (active OR expired). */
    val hasUsedTrial: Boolean get() = trialTier != null

    /** Whole days left in an active trial (1…14). */
    val trialDaysLeft: Int?
        get() {
            val endRaw = trialEndsAt ?: return null
            return try {
                val end = Instant.parse(endRaw)
                val hours = ChronoUnit.HOURS.between(Instant.now(), end)
                max(1, ceil(hours.toDouble() / 24).toInt())
            } catch (_: Exception) {
                null
            }
        }

    /** Plan label for the trial banner (trialTier or current tier). */
    val trialPlanLabel: String?
        get() = when (trialTier) {
            "solo" -> "Solo"
            "crew" -> "Crew"
            "premium" -> "Premium"
            else -> trialTier
        }
}
