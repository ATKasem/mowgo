package com.mowgo.app.data

import com.mowgo.app.BuildConfig
import io.github.jan.supabase.auth.auth
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** Uploads job images directly to the public Supabase Storage bucket. */
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
        val path = "$userId/$jobId/${UUID.randomUUID()}.jpg"
        val objectUrl = "${BuildConfig.SUPABASE_URL}/storage/v1/object/job-photo/$path"
        val request = Request.Builder()
            .url(objectUrl)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("Content-Type", mimeType)
            .header("x-upsert", "public")
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

        val publicUrl = "${BuildConfig.SUPABASE_URL}/storage/v1/object/public/job-photo/$path"
        jobRepository.updateJobPhoto(jobId, publicUrl)
        return publicUrl
    }
}
