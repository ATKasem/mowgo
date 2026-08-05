package com.mowgo.app

import android.app.Application
import com.mowgo.app.data.SupabaseClientProvider

class MowGoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SupabaseClientProvider.initialize(this)
    }
}
