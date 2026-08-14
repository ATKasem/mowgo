package com.mowgo.app

import android.app.Application
import com.mowgo.app.data.SupabaseClientProvider
import com.mowgo.app.data.local.AppDatabaseProvider
import com.mowgo.app.data.sync.SyncManager

class MowGoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SupabaseClientProvider.initialize(this)
        AppDatabaseProvider.initialize(this)
        SyncManager.initialize(this)
    }
}
