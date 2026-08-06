package com.mowgo.app.data

import com.mowgo.app.BuildConfig
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Uploads job images to private Supabase Storage.
 *
 * The DB stores the storage PATH (not a signed URL — signed URLs expire).
 * Callers resolve a fresh signed URL via [signedUrl] at render time.
 */
class JobPhotoRepository(
    private val jobRepository: JobRepository,
    private val httpClient: OkHttpClient = OkHttpClient(),
) {
    suspend fun uploadJobPhoto(
        jobId: String,
        imageData: ByteArray,
        mimeType: String = "image/jpeg",
    ): String {
        if (!SupabaseClientProvider.isConfigured) {
            val demoUrl = "demo://photo/$jobId"
            jobRepository.updateJobPhoto(jobId, demoUrl)
            return demoUrl
        }

        val session = SupabaseClientProvider.client.auth.currentSessionOrNull()
            ?: throw IllegalStateException("Not authenticated")
        val userId = session.user?.id ?: throw IllegalStateException("Missing user ID")
        val path = "$userId/$jobId/photo.jpg"
        val objectUrl = "${BuildConfig.SUPABASE_URL}/storage/v1/object/job-photo/$path"
        val request = Request.Builder()
            .url(objectUrl)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("Content-Type", mimeType)
            .header("x-upsert", "true")
            .post(imageData.toRequestBody(mimeType.toMediaType()))
            .build()

        withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val detail = response.body?.string()?.take(240)?.takeIf { it.isNotBlank() }
                    throw IllegalStateException(
                        detail ?: "Photo upload failed (${response.code})",
                    )
                }
            }
        }

        // Store the PATH, not a signed URL (signed URLs expire).
        jobRepository.updateJobPhoto(jobId, path)
        return path
    }

    /**
     * Resolve a storage path to a fresh 1-hour signed URL for display.
     * Absolute URLs (legacy rows) pass through ONLY if the host matches this
     * project's Supabase host; anything else → null. Mirrors the guard in
     * JobPhotoThumbnail.
     */
    suspend fun signedUrl(pathOrUrl: String?): String? {
        if (pathOrUrl.isNullOrBlank()) return null
        if (pathOrUrl.startsWith("demo://")) return pathOrUrl
        if (pathOrUrl.startsWith("http")) {
            val allowed = runCatching {
                val baseHost = java.net.URI(BuildConfig.SUPABASE_URL).host
                java.net.URI(pathOrUrl).host == baseHost
            }.getOrDefault(false)
            return if (allowed) pathOrUrl else null
        }
        // Path-traversal defense-in-depth (mirrors JobPhotoThumbnail).
        if (pathOrUrl.startsWith("/") || pathOrUrl.contains("..") || pathOrUrl.contains("\\")) return null

        val session = SupabaseClientProvider.client.auth.currentSessionOrNull()
            ?: return null
        val signRequest = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/storage/v1/object/sign/job-photo/$pathOrUrl")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("Content-Type", "application/json")
            .post("{\"expiresIn\":3600}".toRequestBody("application/json".toMediaType()))
            .build()
        return withContext(Dispatchers.IO) {
            httpClient.newCall(signRequest).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string().orEmpty()
                runCatching {
                    val signedPath = json.decodeFromString<SignedUrlResponse>(body).signedURL
                    if (signedPath.startsWith("http")) signedPath
                    else "${BuildConfig.SUPABASE_URL}/storage/v1$signedPath"
                }.getOrNull()
            }
        }
    }

    private val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    @Serializable
    private data class SignedUrlResponse(val signedURL: String)
}
