package com.mowgo.app.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.mowgo.app.data.local.AppDatabaseProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Watches device connectivity and kicks off a WorkManager sync whenever the
 * network comes back, so mutations queued while offline (see
 * [com.mowgo.app.data.local.MutationQueue]) get replayed without the user
 * having to do anything.
 */
object SyncManager {
    private const val SYNC_WORK_NAME = "mowgo-mutation-sync"

    private lateinit var appContext: Context
    private val _isOnline = MutableStateFlow(false)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    fun initialize(context: Context) {
        appContext = context.applicationContext
        val connectivityManager = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        _isOnline.value = isCurrentlyOnline(connectivityManager)

        // Require NET_CAPABILITY_VALIDATED too, not just INTERNET — a captive portal
        // (e.g. hotel/airport wifi) satisfies INTERNET but hasn't actually verified
        // connectivity, and would otherwise look "online" while every request fails.
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()
        connectivityManager.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                val wasOffline = !_isOnline.value
                _isOnline.value = true
                if (wasOffline) triggerSync()
            }

            override fun onLost(network: Network) {
                _isOnline.value = isCurrentlyOnline(connectivityManager)
            }
        })

        // If already online at startup, sync any pending mutations from a prior
        // process death that left the queue stranded.
        if (_isOnline.value) {
            triggerSync()
        }
    }

    private fun isCurrentlyOnline(connectivityManager: ConnectivityManager): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    /** Enqueues a one-time, network-constrained WorkManager job to replay the offline mutation queue. */
    fun triggerSync() {
        if (!::appContext.isInitialized) return
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(appContext).enqueueUniqueWork(SYNC_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    /**
     * Enqueues a sync and suspends until that WorkManager run finishes (success,
     * failure, or cancellation). Callers that reload remote data right after
     * reconnecting must wait on this first — otherwise the reload can race the
     * queued replay and stale server rows win over not-yet-synced local writes.
     */
    suspend fun triggerSyncAndAwait() {
        if (!::appContext.isInitialized) return
        triggerSync()
        // Use REPLACE policy above so the newly enqueued worker is the one we wait for.
        // getWorkInfosForUniqueWorkFlow emits current state; first { isFinished }
        // blocks until the replaced worker finishes.
        WorkManager.getInstance(appContext)
            .getWorkInfosForUniqueWorkFlow(SYNC_WORK_NAME)
            .map { infos -> infos.firstOrNull() }
            .filterNotNull()
            .first { it.state.isFinished }
    }

    suspend fun pendingMutationCount(): Int = AppDatabaseProvider.mutationQueue.pendingCount()
}
