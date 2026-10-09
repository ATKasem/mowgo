//
//  ExportService.swift
//  MowGo
//

import Foundation

enum ExportService {
    static func csv(from clients: [Client]) -> String {
        makeCSV(
            headers: ["ID", "User ID", "Name", "Address", "Phone", "Email", "Rate", "Cleaning Notes", "Key Code", "Alarm Code", "Pet Instructions", "Tags", "Created At"],
            rows: clients.map { client in
                [client.id.uuidString, client.userId?.uuidString, client.name, client.address,
                 client.phone, client.email, String(describing: client.rate), client.cleaningNotes,
                 // Security: physical-access credentials are redacted from exports.
                 client.keyCode == nil || client.keyCode!.isEmpty ? "" : "***",
                 client.alarmCode == nil || client.alarmCode!.isEmpty ? "" : "***",
                 client.petInstructions, client.tags?.joined(separator: ", "),
                 client.createdAt]
            }
        )
    }

    static func csv(from jobs: [Job]) -> String {
        makeCSV(
            headers: ["ID", "User ID", "Client ID", "Client Name", "Assigned To", "Title", "Scheduled Date", "Scheduled Time", "Duration Minutes", "Status", "Notes", "Photo URL", "Route Order", "Recurring", "Recurrence Rule", "Created At"],
            rows: jobs.map { job in
                [job.id.uuidString, job.userId?.uuidString, job.clientId?.uuidString, job.clientName,
                 job.assignedTo?.uuidString, job.title, job.scheduledDate, job.scheduledTime,
                 job.durationMinutes.map { String($0) }, job.status.csvLabel, job.notes, job.photoUrl,
                 job.routeOrder.map { String($0) }, job.isRecurring.map { String($0) }, job.recurrenceRule,
                 job.createdAt]
            }
        )
    }

    static func csv(from invoices: [Invoice]) -> String {
        makeCSV(
            headers: ["ID", "User ID", "Client ID", "Client Name", "Job ID", "Amount", "Status", "Payment Provider", "Provider Payment ID", "Sent At", "Paid At", "Created At"],
            rows: invoices.map { invoice in
                [invoice.id.uuidString, invoice.userId?.uuidString, invoice.clientId?.uuidString,
                 invoice.clientName, invoice.jobId?.uuidString, String(describing: invoice.amount),
                 invoice.status.csvLabel, invoice.paymentProvider, invoice.providerPaymentId,
                 invoice.sentAt, invoice.paidAt, invoice.createdAt]
            }
        )
    }

    static func csv(from leads: [Lead]) -> String {
        let formatter = ISO8601DateFormatter()
        return makeCSV(
            headers: ["ID", "User ID", "Name", "Phone", "Email", "Address", "Source", "Notes", "Status", "Client ID", "Created At", "Updated At"],
            rows: leads.map { lead in
                [lead.id.uuidString, lead.userId?.uuidString, lead.name, lead.phone, lead.email,
                 lead.address, lead.source, lead.notes, lead.status, lead.clientId?.uuidString,
                 lead.createdAt.map { formatter.string(from: $0) },
                 lead.updatedAt.map { formatter.string(from: $0) }]
            }
        )
    }

    private static func makeCSV(headers: [String], rows: [[String?]]) -> String {
        "\u{FEFF}" + ([headers.map(Optional.some)] + rows)
            .map { $0.map(escaped).joined(separator: ",") }
            .joined(separator: "\r\n") + "\r\n"
    }

    private static func escaped(_ value: String?) -> String {
        var flattened = (value ?? "")
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        if let first = flattened.trimmingCharacters(in: .whitespacesAndNewlines).first, "=+-@".contains(first) {
            flattened = "'" + flattened
        }
        flattened = flattened.replacingOccurrences(of: "\"", with: "\"\"")
        return "\"\(flattened)\""
    }
}
