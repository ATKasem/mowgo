package com.mowgo.app.data

import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * Repository for Invoice and extended Client operations.
 * Uses Supabase PostgREST when configured, in-memory demo data otherwise.
 */
class InvoiceRepository {

    suspend fun loadClients(): List<Client> {
        if (!SupabaseClientProvider.isConfigured) return demoClients()
        val userId = getCurrentUserId() ?: return emptyList()
        val profile = ProfileRepository().loadProfile()
        val ownerId = if (profile?.role == "crew") profile.businessId else userId
        if (ownerId == null) return emptyList()
        return SupabaseClientProvider.client.from("clients").select {
            filter { eq("user_id", ownerId) }
            order("name", Order.ASCENDING)
        }.decodeList<Client>()
    }

    // ── Invoice CRUD ────────────────────────────────────────────────────

    /** Load all invoices for the current user. */
    suspend fun loadInvoices(): List<Invoice> {
        if (!SupabaseClientProvider.isConfigured) return demoInvoices()

        val client = SupabaseClientProvider.client
        val userId = getCurrentUserId() ?: return emptyList()
        if (ProfileRepository().loadProfile()?.role == "crew") return emptyList()

        return client.from("invoices")
            .select {
                filter { eq("user_id", userId) }
                order("created_at", Order.DESCENDING)
            }
            .decodeList<Invoice>()
    }

    /** Create a new invoice. */
    suspend fun createInvoice(invoice: Invoice) {
        if (!SupabaseClientProvider.isConfigured) {
            val newInvoice = invoice.copy(
                id = "demo-inv-${System.currentTimeMillis()}",
                createdAt = Instant.now().toString(),
            )
            demoInvoicesMutable = listOf(newInvoice) + demoInvoicesMutable
            return
        }

        val userId = getCurrentUserId() ?: throw IllegalStateException("Not authenticated")
        val invoiceWithUser = invoice.copy(userId = userId)

        SupabaseClientProvider.client.from("invoices")
            .insert(invoiceWithUser)
    }

    /**
     * Auto-invoice for a completed job (mirrors web + iOS). Owner-safe RPC:
     * resolves the OWNER for crew completions (RLS is owner-only) and is
     * atomically idempotent per job (ON CONFLICT). Callers skip $0 rates.
     */
    suspend fun createInvoiceForJob(jobId: String, clientId: String, amount: Double): Invoice? {
        val existing = loadInvoices().firstOrNull { it.jobId == jobId }
        if (existing != null) return existing

        if (!SupabaseClientProvider.isConfigured) {
            val newInvoice = Invoice(
                id = "demo-inv-${System.currentTimeMillis()}",
                clientId = clientId,
                jobId = jobId,
                amount = amount,
                status = Invoice.STATUS_UNPAID,
                createdAt = Instant.now().toString(),
            )
            demoInvoicesMutable = listOf(newInvoice) + demoInvoicesMutable
            return newInvoice
        }

        val createdId: String?
        val created: Boolean
        var serverAmount: Double? = null
        try {
            val rows = SupabaseClientProvider.client.postgrest.rpc(
                "create_invoice_for_job",
                buildJsonObject {
                    put("p_job_id", jobId)
                    put("p_amount", amount)
                }
            ).decodeAs<JsonArray>()
            val row = rows.firstOrNull() as? JsonObject
            createdId = row?.get("invoice_id")
                ?.let { it as? JsonPrimitive }
                ?.takeIf { it.isString }
                ?.content
            created = row?.get("created")
                ?.let { it as? JsonPrimitive }
                ?.booleanOrNull ?: false
            // Prefer the RPC-returned authoritative amount (client rate may
            // be stale); fall back to the local amount if absent.
            serverAmount = row?.get("amount")
                ?.let { it as? JsonPrimitive }
                ?.doubleOrNull
        } catch (e: Exception) {
            // Duplicates are handled server-side (ON CONFLICT → created=false);
            // every other failure propagates so the caller can surface it.
            throw e
        }

        if (createdId == null) return null
        if (created) {
            return Invoice(
                id = createdId,
                userId = "",
                clientId = clientId,
                jobId = jobId,
                amount = serverAmount ?: amount,
                status = Invoice.STATUS_UNPAID,
                createdAt = Instant.now().toString(),
            )
        }
        // Duplicate (another device won the race) — owners reload the existing
        // row; crew can't see owner invoices by design and gets null.
        return loadInvoices().firstOrNull { it.jobId == jobId }
    }

    /** Mark an invoice as paid with current timestamp. */
    suspend fun markInvoicePaid(invoiceId: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoInvoicesMutable = demoInvoicesMutable.map {
                if (it.id == invoiceId) it.copy(
                    status = Invoice.STATUS_PAID,
                    paidAt = Instant.now().toString(),
                ) else it
            }
            return
        }

        val invoice = SupabaseClientProvider.client.from("invoices").select {
            filter { eq("id", invoiceId) }
        }.decodeSingle<Invoice>()
        val paidAt = Instant.now().toString()
        val client = invoice.clientId?.let { clientId ->
            SupabaseClientProvider.client.from("clients").select {
                filter { eq("id", clientId) }
            }.decodeList<Client>().firstOrNull()
        }
        SupabaseClientProvider.client.from("invoices")
            .update(
                mapOf(
                    "status" to Invoice.STATUS_PAID,
                    "paid_at" to paidAt,
                )
            ) {
                filter { eq("id", invoiceId) }
            }
        WebhookService.fire("invoice.paid", mapOf(
            "invoice_id" to invoice.id,
            "client_id" to (invoice.clientId ?: ""),
            "client_name" to (client?.name ?: ""),
            "amount" to invoice.amount.toString(),
            "paid_at" to paidAt,
        ))
    }

    /** Delete an invoice. */
    suspend fun deleteInvoice(invoiceId: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoInvoicesMutable = demoInvoicesMutable.filter { it.id != invoiceId }
            return
        }

        SupabaseClientProvider.client.from("invoices")
            .delete {
                filter { eq("id", invoiceId) }
            }
    }

    // ── Client CRUD ─────────────────────────────────────────────────────

    /** Create a new client. */
    suspend fun createClient(client: Client): Client {
        if (!SupabaseClientProvider.isConfigured) {
            val newClient = client.copy(id = "demo-client-${System.currentTimeMillis()}")
            demoClientsMutable = listOf(newClient) + (demoClientsMutable ?: emptyList())
            return newClient
        }

        val userId = getCurrentUserId() ?: throw IllegalStateException("Not authenticated")
        val clientWithUser = client.copy(
            id = client.id.ifBlank { UUID.randomUUID().toString() },
            userId = userId,
        )

        SupabaseClientProvider.client.from("clients")
            .insert(clientWithUser)
        WebhookService.fire("customer.created", mapOf(
            "client_id" to clientWithUser.id, "name" to clientWithUser.name,
            "address" to (clientWithUser.address ?: ""), "phone" to (clientWithUser.phone ?: ""),
            "email" to (clientWithUser.email ?: ""), "rate" to clientWithUser.rate.toString(),
        ))
        return clientWithUser
    }

    /** Update an existing client. */
    suspend fun updateClient(client: Client) {
        if (!SupabaseClientProvider.isConfigured) {
            demoClientsMutable = (demoClientsMutable ?: emptyList()).map {
                if (it.id == client.id) client else it
            }
            return
        }

        SupabaseClientProvider.client.from("clients")
            .update(client) {
                filter { eq("id", client.id) }
            }
    }

    /** Delete a client. */
    suspend fun deleteClient(clientId: String) {
        if (!SupabaseClientProvider.isConfigured) {
            demoClientsMutable = (demoClientsMutable ?: emptyList()).filter { it.id != clientId }
            return
        }

        SupabaseClientProvider.client.from("clients")
            .delete {
                filter { eq("id", clientId) }
            }
    }

    // ── Auth helper ──────────────────────────────────────────────────────

    private suspend fun getCurrentUserId(): String? {
        return try {
            SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
        } catch (_: Exception) {
            null
        }
    }

    // ── Demo Data ────────────────────────────────────────────────────────

    companion object {
        /**
         * Shared across repository instances (TodayViewModel auto-creates demo
         * invoices; InvoicesViewModel must see them).
         */
        @Volatile
        private var demoInvoicesMutable: List<Invoice> = emptyList()
    }

    @Volatile
    private var demoClientsMutable: List<Client>? = null

    private fun demoClients(): List<Client> {
        if (demoClientsMutable == null) {
            demoClientsMutable = listOf(
                Client(
                    id = "demo-client-1",
                    userId = "demo-owner",
                    name = "Smith Residence",
                    address = "123 Main St, Edmond, OK",
                    phone = "405-555-0101",
                    rate = 45.0,
                    keyCode = "1234",
                    petInstructions = "Dog is friendly, keep gate closed",
                ),
                Client(
                    id = "demo-client-2",
                    userId = "demo-owner",
                    name = "Johnson Home",
                    address = "456 Oak Ave, OKC, OK",
                    phone = "405-555-0202",
                    rate = 65.0,
                ),
                Client(
                    id = "demo-client-3",
                    userId = "demo-owner",
                    name = "Williams Estate",
                    address = "789 Pine Rd, Edmond, OK",
                    rate = 80.0,
                    keyCode = "5678",
                ),
            )
        }
        return demoClientsMutable!!
    }

    private fun demoInvoices(): List<Invoice> {
        if (demoInvoicesMutable.isEmpty()) {
            demoInvoicesMutable = listOf(
                Invoice(
                    id = "demo-inv-1",
                    userId = "demo-owner",
                    clientId = "demo-client-1",
                    amount = 45.0,
                    status = Invoice.STATUS_PAID,
                    paidAt = "2026-07-28T14:30:00Z",
                    createdAt = "2026-07-28T14:30:00Z",
                ),
                Invoice(
                    id = "demo-inv-2",
                    userId = "demo-owner",
                    clientId = "demo-client-2",
                    amount = 65.0,
                    status = Invoice.STATUS_UNPAID,
                    createdAt = "2026-07-30T10:00:00Z",
                ),
                Invoice(
                    id = "demo-inv-3",
                    userId = "demo-owner",
                    clientId = "demo-client-3",
                    amount = 80.0,
                    status = Invoice.STATUS_UNPAID,
                    createdAt = "2026-08-01T09:15:00Z",
                ),
            )
        }
        return demoInvoicesMutable
    }
}
