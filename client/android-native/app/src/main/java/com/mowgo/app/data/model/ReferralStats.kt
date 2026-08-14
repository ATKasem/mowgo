package com.mowgo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ReferralStats(
    val code: String = "",
    @SerialName("total_referrals") val totalReferrals: Int = 0,
    @SerialName("reward_earned") val rewardEarned: Int = 0,
    @SerialName("sent_count") val sentCount: Long = 0,
    @SerialName("signed_up_count") val signedUpCount: Long = 0,
    @SerialName("converted_count") val convertedCount: Long = 0,
)
