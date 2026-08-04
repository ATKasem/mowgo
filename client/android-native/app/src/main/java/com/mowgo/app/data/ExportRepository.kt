package com.mowgo.app.data

import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import com.mowgo.app.data.model.Job

class ExportRepository(
    private val jobRepository: JobRepository = JobRepository(),
    private val invoiceRepository: InvoiceRepository = InvoiceRepository(),
) {
    suspend fun exportClients(): List<Client> = jobRepository.loadClients()

    suspend fun exportJobs(): List<Job> = jobRepository.loadJobs().map { it.job }

    suspend fun exportInvoices(): List<Invoice> = invoiceRepository.loadInvoices()

    fun clientsCsv(clients: List<Client>): String = csv(
        listOf("ID", "User ID", "Name", "Address", "Phone", "Email", "Rate", "Cleaning Notes", "Key Code", "Alarm Code", "Pet Instructions", "Created At"),
        clients.map { client -> listOf(client.id, client.userId, client.name, client.address, client.phone, client.email, client.rate, client.cleaningNotes, client.keyCode, client.alarmCode, client.petInstructions, client.createdAt) },
    )

    fun jobsCsv(jobs: List<Job>): String = csv(
        listOf("ID", "User ID", "Client ID", "Assigned To", "Title", "Scheduled Date", "Scheduled Time", "Duration Minutes", "Status", "Notes", "Photo URL", "Route Order", "Recurrence Rule"),
        jobs.map { job -> listOf(job.id, job.userId, job.clientId, job.assignedTo, job.title, job.scheduledDate, job.scheduledTime, job.durationMinutes, job.status, job.notes, job.photoUrl, job.routeOrder, job.recurrenceRule) },
    )

    fun invoicesCsv(invoices: List<Invoice>): String = csv(
        listOf("ID", "User ID", "Client ID", "Job ID", "Amount", "Status", "Paid At", "Created At"),
        invoices.map { invoice -> listOf(invoice.id, invoice.userId, invoice.clientId, invoice.jobId, invoice.amount, invoice.status, invoice.paidAt, invoice.createdAt) },
    )

    private fun csv(headers: List<String>, rows: List<List<Any?>>): String =
        "\uFEFF" + (listOf(headers.map { it as Any? }) + rows)
            .joinToString(separator = "\r\n", postfix = "\r\n") { row ->
                row.joinToString(",") { value -> escape(value?.toString().orEmpty()) }
            }

    private fun escape(value: String): String {
        var flattened = value.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
        if (flattened.trimStart().firstOrNull() in setOf('=', '+', '-', '@')) flattened = "'$flattened"
        return "\"${flattened.replace("\"", "\"\"")}\""
    }
}
