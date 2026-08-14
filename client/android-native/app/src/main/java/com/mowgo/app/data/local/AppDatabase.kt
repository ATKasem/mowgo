package com.mowgo.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.mowgo.app.data.local.dao.ClientDao
import com.mowgo.app.data.local.dao.InvoiceDao
import com.mowgo.app.data.local.dao.JobDao
import com.mowgo.app.data.local.dao.LeadDao
import com.mowgo.app.data.local.dao.MutationDao
import com.mowgo.app.data.local.entity.CachedClientEntity
import com.mowgo.app.data.local.entity.CachedInvoiceEntity
import com.mowgo.app.data.local.entity.CachedJobEntity
import com.mowgo.app.data.local.entity.CachedLeadEntity
import com.mowgo.app.data.local.entity.MutationEntity

@Database(
    entities = [
        CachedJobEntity::class,
        CachedClientEntity::class,
        CachedInvoiceEntity::class,
        CachedLeadEntity::class,
        MutationEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun jobDao(): JobDao
    abstract fun clientDao(): ClientDao
    abstract fun invoiceDao(): InvoiceDao
    abstract fun leadDao(): LeadDao
    abstract fun mutationDao(): MutationDao
}

/**
 * Process-wide Room instance, initialized by MowGoApplication — mirrors
 * SupabaseClientProvider so repositories can keep using no-arg constructors.
 */
object AppDatabaseProvider {

    private lateinit var applicationContext: Context

    fun initialize(context: Context) {
        applicationContext = context.applicationContext
    }

    val database: AppDatabase by lazy {
        check(::applicationContext.isInitialized) { "AppDatabaseProvider must be initialized by MowGoApplication" }
        // No destructive-migration fallback: cached_jobs/cached_clients are safe to
        // lose (they're re-fetched), but mutation_queue holds writes that haven't
        // synced yet — silently dropping it on a version bump would lose real user
        // data. Any future schema change must ship an explicit Migration.
        Room.databaseBuilder(applicationContext, AppDatabase::class.java, "mowgo-cache.db")
            .addMigrations(MIGRATION_1_2)
            .build()
    }

    val mutationQueue: MutationQueue by lazy { MutationQueue(database.mutationDao()) }

    /** Wipes all cached data + the mutation queue — call on sign-out so the next account starts clean. */
    suspend fun clearAll() {
        database.jobDao().clearAll()
        database.clientDao().clearAll()
        database.invoiceDao().clearAll()
        database.leadDao().clearAll()
        database.mutationDao().clearAll()
    }

    private val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE mutation_queue ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0")
        }
    }
}
