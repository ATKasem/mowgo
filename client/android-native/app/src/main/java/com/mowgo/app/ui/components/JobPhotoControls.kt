package com.mowgo.app.ui.components

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.LaunchedEffect
import com.mowgo.app.BuildConfig
import com.mowgo.app.data.SupabaseClientProvider
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import coil.compose.AsyncImage
import com.mowgo.app.BuildConfig
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun JobPhotoButton(
    jobId: String,
    isUploading: Boolean,
    onImageReady: (ByteArray) -> Unit,
    onError: (String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showSources by remember { mutableStateOf(false) }
    var cameraUri by remember { mutableStateOf<Uri?>(null) }

    fun prepare(uri: Uri) {
        scope.launch {
            try {
                val bytes = withContext(Dispatchers.IO) {
                    compressJpeg(context.contentResolver, uri)
                }
                onImageReady(bytes)
            } catch (error: Exception) {
                onError(error.message ?: "Failed to prepare photo")
            }
        }
    }

    val libraryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let(::prepare) }
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { saved -> if (saved) cameraUri?.let(::prepare) }

    Box {
        IconButton(
            enabled = !isUploading,
            onClick = { showSources = true },
        ) {
            if (isUploading) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Icon(Icons.Default.CameraAlt, contentDescription = "Add job photo")
            }
        }
    }

    if (showSources) {
        AlertDialog(
            onDismissRequest = { showSources = false },
            title = { Text("Add Photo") },
            text = {
                androidx.compose.foundation.layout.Column {
                    DropdownMenuItem(
                        text = { Text("Take Photo") },
                        leadingIcon = { Icon(Icons.Default.CameraAlt, null) },
                        onClick = {
                            showSources = false
                            try {
                                val directory = File(context.cacheDir, "camera").apply { mkdirs() }
                                val file = File(directory, "$jobId-${UUID.randomUUID()}.jpg")
                                cameraUri = FileProvider.getUriForFile(
                                    context,
                                    "${BuildConfig.APPLICATION_ID}.fileprovider",
                                    file,
                                )
                                cameraLauncher.launch(cameraUri!!)
                            } catch (error: Exception) {
                                onError(error.message ?: "Camera could not be opened")
                            }
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Choose from Library") },
                        leadingIcon = { Icon(Icons.Default.PhotoLibrary, null) },
                        onClick = {
                            showSources = false
                            libraryLauncher.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                            )
                        },
                    )
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showSources = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
fun JobPhotoThumbnail(photoUrl: String?, modifier: Modifier = Modifier) {
    val displayUrl = photoUrl?.takeIf { it.isNotBlank() && !it.startsWith("demo://") } ?: return
    // DB stores the storage PATH (signed URLs expire). Resolve a fresh signed
    // URL at render time; legacy absolute URLs pass through unchanged.
    var resolved by remember(displayUrl) { mutableStateOf<String?>(null) }
    LaunchedEffect(displayUrl) {
        resolved = if (displayUrl.startsWith("http")) displayUrl
        // Path-traversal defense-in-depth: storage keys are UUID-segmented;
        // reject anything that isn't a plain relative path.
        else if (displayUrl.startsWith("/") || displayUrl.contains("..") || displayUrl.contains("\\")) null
        else runCatching {
            SupabaseClientProvider.client.auth.currentSessionOrNull()?.let { session ->
                val req = Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL}/storage/v1/object/sign/job-photo/$displayUrl")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .header("Authorization", "Bearer ${session.accessToken}")
                    .header("Content-Type", "application/json")
                    .post("{\"expiresIn\":3600}".toRequestBody("application/json".toMediaType()))
                    .build()
                val body = withContext(Dispatchers.IO) {
                    OkHttpClient().newCall(req).execute().use { it.body?.string().orEmpty() }
                }
                val signedPath = runCatching {
                    kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
                        .decodeFromString<SignedUrlResponse>(body).signedURL
                }.getOrNull() ?: return@LaunchedEffect
                if (signedPath.startsWith("http")) signedPath
                else "${BuildConfig.SUPABASE_URL}/storage/v1$signedPath"
            }
        }.getOrNull()
    }
    val finalUrl = resolved ?: return
    AsyncImage(
        model = finalUrl,
        contentDescription = "Job photo",
        contentScale = ContentScale.Crop,
        modifier = modifier
            .size(width = 64.dp, height = 48.dp)
            .clip(RoundedCornerShape(8.dp)),
    )
}

@Serializable
private data class SignedUrlResponse(val signedURL: String)

private fun compressJpeg(contentResolver: ContentResolver, uri: Uri): ByteArray {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    val boundsStream = contentResolver.openInputStream(uri)
        ?: throw IllegalStateException("The selected photo could not be opened")
    boundsStream.use { stream ->
        BitmapFactory.decodeStream(stream, null, bounds)
    }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
        throw IllegalArgumentException("The selected file is not a valid image")
    }

    var sampleSize = 1
    while (bounds.outWidth / sampleSize > 1600 || bounds.outHeight / sampleSize > 1600) {
        sampleSize *= 2
    }
    val bitmap = contentResolver.openInputStream(uri)?.use { stream ->
        BitmapFactory.decodeStream(
            stream,
            null,
            BitmapFactory.Options().apply { inSampleSize = sampleSize },
        )
    } ?: throw IllegalArgumentException("The selected image could not be decoded")

    val scale = minOf(1f, 1600f / maxOf(bitmap.width, bitmap.height).toFloat())
    val resized = if (scale < 1f) {
        Bitmap.createScaledBitmap(
            bitmap,
            (bitmap.width * scale).toInt(),
            (bitmap.height * scale).toInt(),
            true,
        )
    } else {
        bitmap
    }

    return ByteArrayOutputStream().use { output ->
        if (!resized.compress(Bitmap.CompressFormat.JPEG, 85, output)) {
            throw IllegalStateException("The image could not be compressed")
        }
        if (resized !== bitmap) resized.recycle()
        bitmap.recycle()
        output.toByteArray()
    }
}
