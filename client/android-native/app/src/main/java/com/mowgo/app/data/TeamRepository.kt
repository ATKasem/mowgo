package com.mowgo.app.data

import com.mowgo.app.data.auth.AuthRepository
import com.mowgo.app.data.model.Profile
import com.mowgo.app.data.model.UserProfile
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody

class TeamRepository(
    private val authRepository: AuthRepository = AuthRepository(),
    private val httpClient: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun loadTeamMembers(): List<UserProfile> {
        if (!SupabaseClientProvider.isConfigured) return demoTeamMembers

        val profile = ProfileRepository().loadProfile() ?: return emptyList()
        val currentUserId = authRepository.currentSession?.user?.id ?: return emptyList()
        val businessId = if (profile.role == null || profile.role == OWNER_ROLE) {
            currentUserId
        } else {
            profile.businessId ?: return emptyList()
        }
        val client = SupabaseClientProvider.client

        // Two simple queries are used instead of relying on version-sensitive `or` DSL syntax.
        val owner = client.from("profiles").select {
            filter { eq("id", businessId) }
        }.decodeList<UserProfile>()
        val crew = client.from("profiles").select {
            filter { eq("business_id", businessId) }
            order("business_name", Order.ASCENDING)
        }.decodeList<UserProfile>()

        return (owner + crew).distinctBy { it.id }.sortedBy { it.businessName?.lowercase() ?: "" }
    }

    suspend fun inviteTeamMember(email: String): UserProfile {
        val normalizedEmail = email.trim().lowercase()
        require(normalizedEmail.isNotEmpty()) { "Email address is required" }

        if (!SupabaseClientProvider.isConfigured) {
            val ownerId = demoTeamMembers.firstOrNull { it.role == OWNER_ROLE }?.id ?: DEMO_OWNER_ID
            val member = UserProfile(
                id = "demo-crew-${System.currentTimeMillis()}",
                businessName = normalizedEmail.substringBefore('@').ifBlank { normalizedEmail },
                tier = "crew",
                role = "crew",
                businessId = ownerId,
            )
            demoTeamMembers = demoTeamMembers + member
            return member
        }

        val token = authRepository.currentSession?.accessToken
            ?: throw IllegalStateException("Not authenticated")
        val requestJson = json.encodeToString(InviteRequest.serializer(), InviteRequest(normalizedEmail))
        val requestBody = RequestBody.create("application/json".toMediaType(), requestJson)
        val request = Request.Builder()
            .url("https://mowgoapp.com/api/invite-crew")
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .post(requestBody)
            .build()

        val responseText = withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException(body.ifBlank { "Server error (${response.code})" })
                }
                body
            }
        }
        val profile = json.decodeFromString(InviteResponse.serializer(), responseText).profile
        val member = UserProfile(
            id = profile.id,
            businessName = profile.businessName,
            tier = profile.tier,
            role = profile.role,
            businessId = profile.businessId,
        )
        demoTeamMembers = (demoTeamMembers + member).distinctBy { it.id }
        return member
    }

    suspend fun removeTeamMember(member: UserProfile) {
        if (!SupabaseClientProvider.isConfigured) {
            demoTeamMembers = demoTeamMembers.filterNot { it.id == member.id }
            JobRepository().unassignJobsFromMember(member.id)
            return
        }

        val profile: Profile? = ProfileRepository().loadProfile()
        if (profile?.role != OWNER_ROLE) {
            throw IllegalStateException("Only an owner can remove crew members")
        }

        val token = authRepository.currentSession?.accessToken
            ?: throw IllegalStateException("Not authenticated")
        val request = Request.Builder()
            .url("https://mowgoapp.com/api/team/${member.id}")
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .delete()
            .build()

        val responseText = withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                val result = runCatching {
                    json.decodeFromString(RemoveResponse.serializer(), body)
                }.getOrNull()
                if (!response.isSuccessful || result?.success != true) {
                    throw IllegalStateException(
                        result?.error?.takeIf { it.isNotBlank() }
                            ?: body.takeIf { it.isNotBlank() }
                            ?: "Server error (${response.code})",
                    )
                }
                body
            }
        }
        val result = json.decodeFromString(RemoveResponse.serializer(), responseText)
        if (!result.success) throw IllegalStateException(result.error ?: "Could not remove crew member")
    }

    @Serializable
    private data class InviteRequest(val email: String)

    @Serializable
    private data class InviteResponse(val profile: InviteProfile)

    @Serializable
    private data class InviteProfile(
        val id: String,
        val businessName: String,
        val tier: String = "crew",
        val role: String = "crew",
        val businessId: String? = null,
    )

    @Serializable
    private data class RemoveResponse(
        val success: Boolean = false,
        val error: String? = null,
    )

    companion object {
        private const val OWNER_ROLE = "owner"
        private const val DEMO_OWNER_ID = "demo-owner"

        @Volatile
        private var demoTeamMembers: List<UserProfile> = seedTeamMembers()

        private fun seedTeamMembers(): List<UserProfile> = listOf(
            UserProfile(
                id = DEMO_OWNER_ID,
                businessName = "Green Thumb Lawn Care",
                phone = "405-555-0100",
                tier = "solo",
                role = OWNER_ROLE,
            ),
            UserProfile(
                id = "demo-crew-jake",
                businessName = "Jake Torres",
                tier = "crew",
                role = "crew",
                businessId = DEMO_OWNER_ID,
            ),
            UserProfile(
                id = "demo-crew-maria",
                businessName = "Maria Santos",
                tier = "crew",
                role = "crew",
                businessId = DEMO_OWNER_ID,
            ),
        )

        fun resetDemoTeam() {
            demoTeamMembers = seedTeamMembers()
        }
    }
}
