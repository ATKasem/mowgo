package com.mowgo.app.data

import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Lead
import com.mowgo.app.data.model.LeadPatch
import com.mowgo.app.data.model.LeadStatus
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import java.time.Instant
import java.util.UUID

class LeadRepository(private val clientRepository: InvoiceRepository = InvoiceRepository()) {
    @Volatile private var demoLeads: List<Lead>? = null

    suspend fun loadLeads(): List<Lead> {
        if (!SupabaseClientProvider.isConfigured) return demoData()
        val userId = currentUserId() ?: return emptyList()
        return SupabaseClientProvider.client.from("leads").select {
            filter { eq("user_id", userId) }
            order("created_at", Order.DESCENDING)
        }.decodeList<Lead>()
    }

    suspend fun createLead(lead: Lead): Lead {
        if (!SupabaseClientProvider.isConfigured) {
            val now = Instant.now().toString()
            val created = lead.copy(
                id = "demo-lead-${System.currentTimeMillis()}", userId = "demo-owner-001",
                status = LeadStatus.NEW.value, createdAt = now, updatedAt = now,
            )
            demoLeads = listOf(created) + (demoLeads ?: emptyList())
            return created
        }
        val userId = currentUserId() ?: throw IllegalStateException("Not authenticated")
        val created = lead.copy(
            id = lead.id.ifBlank { UUID.randomUUID().toString() }, userId = userId,
            name = lead.name.trim(), status = LeadStatus.NEW.value,
        )
        SupabaseClientProvider.client.from("leads").insert(created)
        WebhookService.fire("lead.created", mapOf(
            "lead_id" to created.id, "name" to created.name,
            "source" to created.source, "status" to created.status,
        ))
        return created
    }

    suspend fun updateLead(id: String, patch: LeadPatch): Lead {
        val stamped = patch.copy(updatedAt = Instant.now().toString())
        if (!SupabaseClientProvider.isConfigured) {
            var updated: Lead? = null
            demoLeads = (demoLeads ?: emptyList()).map { lead ->
                if (lead.id != id) lead else lead.copy(
                    name = stamped.name ?: lead.name, phone = stamped.phone ?: lead.phone,
                    email = stamped.email ?: lead.email, address = stamped.address ?: lead.address,
                    source = stamped.source ?: lead.source, notes = stamped.notes ?: lead.notes,
                    status = stamped.status ?: lead.status, clientId = stamped.clientId ?: lead.clientId,
                    updatedAt = stamped.updatedAt,
                ).also { updated = it }
            }
            return updated ?: throw IllegalArgumentException("Lead not found")
        }
        SupabaseClientProvider.client.from("leads").update(stamped) { filter { eq("id", id) } }
        return SupabaseClientProvider.client.from("leads").select {
            filter { eq("id", id) }
        }.decodeList<Lead>().firstOrNull() ?: throw IllegalStateException("Lead not found after update")
    }

    suspend fun updateLeadStatus(id: String, status: LeadStatus): Lead {
        val updated = updateLead(id, LeadPatch(status = status.value))
        WebhookService.fire("lead.status.updated", mapOf(
            "lead_id" to updated.id, "name" to updated.name, "status" to status.value,
            "client_id" to (updated.clientId ?: ""),
        ))
        return updated
    }

    suspend fun deleteLead(id: String) {
        if (!SupabaseClientProvider.isConfigured) {
            val lead = (demoLeads ?: demoData()).firstOrNull { it.id == id }
            if (lead?.status != LeadStatus.LOST.value) throw IllegalStateException("Only lost leads can be deleted")
            demoLeads = (demoLeads ?: emptyList()).filter { it.id != id }
            return
        }
        val lead = SupabaseClientProvider.client.from("leads").select {
            filter { eq("id", id) }
        }.decodeList<Lead>().firstOrNull() ?: throw IllegalArgumentException("Lead not found")
        if (lead.status != LeadStatus.LOST.value) throw IllegalStateException("Only lost leads can be deleted")
        SupabaseClientProvider.client.from("leads").delete { filter { eq("id", id) } }
    }

    suspend fun convertLeadToClient(lead: Lead): Client {
        if (LeadStatus.from(lead.status) !in setOf(LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTED)) {
            throw IllegalStateException("Only active leads can be converted")
        }
        val client = clientRepository.createClient(Client(
            name = lead.name, phone = lead.phone, email = lead.email, address = lead.address,
            cleaningNotes = lead.notes,
        ))
        try {
            val updated = updateLead(lead.id, LeadPatch(status = LeadStatus.WON.value, clientId = client.id))
            WebhookService.fire("lead.status.updated", mapOf(
                "lead_id" to updated.id, "name" to updated.name, "status" to LeadStatus.WON.value,
                "client_id" to client.id,
            ))
        } catch (error: Exception) {
            try { clientRepository.deleteClient(client.id) } catch (_: Exception) { }
            throw error
        }
        return client
    }

    private suspend fun currentUserId(): String? = try {
        SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id
    } catch (_: Exception) { null }

    private fun demoData(): List<Lead> {
        if (demoLeads == null) {
            val now = Instant.now()
            demoLeads = listOf(
                Lead("demo-lead-1", "demo-owner-001", "Sarah Mitchell", "405-555-0130", "sarah@example.com", "820 Cedar Ridge, Edmond, OK", "booking_link", "Asked about weekly mowing and spring cleanup.", "new", createdAt = now.minusSeconds(86400).toString(), updatedAt = now.minusSeconds(86400).toString()),
                Lead("demo-lead-2", "demo-owner-001", "James Carter", "405-555-0131", null, "44 NW 18th St, OKC, OK", "referral", "Referred by Bill Henderson.", "contacted", createdAt = now.minusSeconds(259200).toString(), updatedAt = now.minusSeconds(172800).toString()),
                Lead("demo-lead-3", "demo-owner-001", "Olivia Brooks", null, "olivia@example.com", "1900 Lakeview Dr, Nichols Hills, OK", "facebook", "Requested an estimate for a large corner lot.", "quoted", createdAt = now.minusSeconds(518400).toString(), updatedAt = now.minusSeconds(345600).toString()),
            )
        }
        return demoLeads ?: emptyList()
    }
}
