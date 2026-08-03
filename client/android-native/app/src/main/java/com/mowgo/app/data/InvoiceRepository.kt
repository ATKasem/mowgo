package com.mowgo.app.data

import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Repository for Invoice and extended Client operations.
 * Uses Supabase PostgREST when configured, in-memory demo data otherwise.
 */
class InvoiceRepository {

    // ── Invoice CRUD ────────────────────────────────────────────────────

    /** Load all invoices for the current user. */
    suspend fun loadInvoices(): List<Invoice> {
        if (!SupabaseClientProvider.isConfigured) return demoInvoices()

        val client = SupabaseClientProvider.client
        val userId = getCurrentUserId() ?: return emptyList()

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

        SupabaseClientProvider.client.from("invoices")
            .update(
                mapOf(
                    "status" to Invoice.STATUS_PAID,
                    "paid_at" to Instant.now().toString(),
                )
            ) {
                filter { eq("id", invoiceId) }
            }
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
    suspend fun createClient(client: Client) {
        if (!SupabaseClientProvider.isConfigured) {
            val newClient = client.copy(id = "demo-client-${System.currentTimeMillis()}")
            demoClientsMutable = listOf(newClient) + (demoClientsMutable ?: emptyList())
            return
        }

        val userId = getCurrentUserId() ?: throw IllegalStateException("Not authenticated")
        val clientWithUser = client.copy(userId = userId)

        SupabaseClientProvider.client.from("clients")
            .insert(clientWithUser)
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

    @Volatile
    private var demoInvoicesMutable: List<Invoice> = emptyList()

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
