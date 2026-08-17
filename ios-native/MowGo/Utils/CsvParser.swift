//
//  CsvParser.swift
//  MowGo
//
//  Pure-Swift CSV/TSV parser — RFC 4180-ish, no dependencies.
//  Handles quoted fields, commas inside quotes, newlines inside quotes,
//  escaped quotes (""), and BOM removal. Tolerant of \n, \r\n, \r endings.
//

import Foundation

/// One row-level parse error.
struct CsvParseError: Equatable {
    let rowIndex: Int  // 0-based, row 0 = header
    let message: String
}

/// Result of the tokenize pass.
struct CsvTokenized {
    let headers: [String]
    let rows: [[String]]
    let errors: [CsvParseError]
}

/// Recognised MowGo field names for column mapping.
enum CsvField: String, CaseIterable {
    case name, address, phone, email, notes

    var label: String {
        switch self {
        case .name:    return "Name"
        case .address: return "Address"
        case .phone:   return "Phone"
        case .email:   return "Email"
        case .notes:   return "Notes"
        }
    }
}

/// A parsed import row ready for preview / dedup.
struct CsvImportRow: Equatable {
    let name: String
    let address: String
    let phone: String
    let email: String
    let notes: String
}

/// Preview state after dedup against existing clients.
struct ImportPreview {
    let rows: [CsvImportRow]
    let skippedMissingName: Int
    let skippedDuplicates: Int
    let skippedExisting: Int
}

// MARK: - Parser

enum CsvParser {

    /// Tokenise raw CSV/TSV text and return header + data rows.
    /// Auto-detects tab delimiter when the header row contains a tab.
    static func tokenize(_ text: String) -> CsvTokenized {
        let source = String(text.dropFirst(text.hasPrefix("\u{FEFF}") ? 1 : 0))
        let delimiter = detectDelimiter(source)
        var rows: [[String]] = []
        var errors: [CsvParseError] = []
        var currentRow: [String] = []
        var field = ""
        var quoted = false
        var atFieldStart = true
        var i = source.startIndex

        func pushField() {
            if quoted {
                errors.append(CsvParseError(rowIndex: rows.count, message: "Unclosed quote in column \(currentRow.count + 1)"))
                quoted = false
            }
            currentRow.append(field)
            field = ""
            atFieldStart = true
        }

        func pushRow() {
            pushField()
            rows.append(currentRow)
            currentRow = []
        }

        while i < source.endIndex {
            let ch = source[i]

            if quoted {
                if ch == "\"" {
                    let next = source.index(after: i)
                    if next < source.endIndex && source[next] == "\"" {
                        field.append("\"")
                        i = source.index(after: next)
                    } else {
                        quoted = false
                        i = source.index(after: i)
                    }
                } else {
                    field.append(ch)
                    i = source.index(after: i)
                }
            } else {
                if ch == "\"" && atFieldStart {
                    quoted = true
                    i = source.index(after: i)
                } else if ch == delimiter {
                    pushField()
                    i = source.index(after: i)
                } else if ch == "\r" {
                    let next = source.index(after: i)
                    if next < source.endIndex && source[next] == "\n" {
                        i = next
                    }
                    pushRow()
                    i = source.index(after: i)
                } else if ch == "\n" {
                    pushRow()
                    i = source.index(after: i)
                } else {
                    if ch != "\"" { atFieldStart = false }
                    field.append(ch)
                    i = source.index(after: i)
                }
            }
        }

        // Flush trailing content
        if !field.isEmpty || !currentRow.isEmpty || quoted {
            pushRow()
        }

        guard !rows.isEmpty else {
            return CsvTokenized(headers: [], rows: [], errors: errors)
        }

        let headers = rows.removeFirst()
        return CsvTokenized(headers: headers, rows: rows, errors: errors)
    }

    /// Auto-detect column header → MowGo field mapping.
    static func detectColumnMapping(headers: [String]) -> [String: CsvField] {
        var map: [String: CsvField] = [:]
        let aliases: [CsvField: [String]] = [
            .name:    ["name", "client name", "client_name", "customer name", "customer", "contact", "contact name", "full name"],
            .address: ["address", "street", "street address", "location", "service address"],
            .phone:   ["phone", "phone number", "phone_number", "mobile", "cell", "telephone"],
            .email:   ["email", "e-mail", "email address"],
            .notes:   ["notes", "note", "comments", "comment", "memo", "description"],
        ]

        for header in headers {
            let lower = header.lowercased().trimmingCharacters(in: .whitespaces)
            for (field, aliases) in aliases {
                if aliases.contains(lower) {
                    map[header] = field
                    break
                }
            }
        }
        return map
    }

    /// Build import rows from tokenised data using the column mapping.
    /// Dedupes within the CSV (by name+address / name+phone) and against existing clients.
    static func buildImportRows(
        rows: [[String]],
        columnMap: [String: CsvField],
        headers: [String],
        existingClients: [Client]
    ) -> ImportPreview {
        // Build existing lookup keys
        let existingKeys = buildExistingKeys(clients: existingClients)
        var seenNameAddress = Set<String>()
        var seenNamePhone = Set<String>()
        var skippedMissingName = 0
        var skippedDuplicates = 0
        var skippedExisting = 0
        var result: [CsvImportRow] = []

        // Build a reverse lookup once: CsvField → column index, so the per-row
        // closure is O(1) per field instead of O(map entries) via first(where:).
        let reverseMap: [CsvField: Int] = columnMap.reduce(into: [:]) { result, mapping in
            if let index = headers.firstIndex(of: mapping.key) {
                result[mapping.value] = index
            }
        }

        for row in rows {
            let get: (CsvField) -> String = { field in
                guard let idx = reverseMap[field], idx < row.count
                else { return "" }
                return row[idx].trimmingCharacters(in: .whitespaces)
            }
            let name = get(.name)
            guard !name.isEmpty else { skippedMissingName += 1; continue }

            let address = get(.address)
            let phone = get(.phone)
            let email = get(.email)
            let notes = get(.notes)

            let nameKey = name.lowercased()
            let key1 = address.isEmpty ? "" : "\(nameKey)|\(address.lowercased())"
            let key2 = phone.isEmpty ? "" : "\(nameKey)|\(phone.components(separatedBy: CharacterSet.decimalDigits.inverted).joined())"

            // Check existing
            if (!key1.isEmpty && existingKeys.nameAddress.contains(key1)) ||
               (!key2.isEmpty && existingKeys.namePhone.contains(key2)) {
                skippedExisting += 1; continue
            }
            // Check intra-CSV duplicates
            if (!key1.isEmpty && seenNameAddress.contains(key1)) ||
               (!key2.isEmpty && seenNamePhone.contains(key2)) {
                skippedDuplicates += 1; continue
            }
            if !key1.isEmpty { seenNameAddress.insert(key1) }
            if !key2.isEmpty { seenNamePhone.insert(key2) }

            result.append(CsvImportRow(name: name, address: address, phone: phone, email: email, notes: notes))
        }

        return ImportPreview(
            rows: result,
            skippedMissingName: skippedMissingName,
            skippedDuplicates: skippedDuplicates,
            skippedExisting: skippedExisting
        )
    }

    // MARK: - Helpers

    private static func detectDelimiter(_ text: String) -> Character {
        // Check first line for tabs
        if let firstNewline = text.firstIndex(where: { $0 == "\n" || $0 == "\r" }) {
            let firstLine = text[text.startIndex..<firstNewline]
            if firstLine.contains("\t") { return "\t" }
        }
        return ","
    }

    private struct ExistingKeys {
        let nameAddress: Set<String>
        let namePhone: Set<String>
    }

    private static func buildExistingKeys(clients: [Client]) -> ExistingKeys {
        var nameAddress = Set<String>()
        var namePhone = Set<String>()
        for client in clients {
            let name = (client.name).trimmingCharacters(in: .whitespaces).lowercased()
            guard !name.isEmpty else { continue }
            if let addr = client.address, !addr.isEmpty {
                nameAddress.insert("\(name)|\(addr.lowercased())")
            }
            if let phone = client.phone, !phone.isEmpty {
                namePhone.insert("\(name)|\(phone.components(separatedBy: CharacterSet.decimalDigits.inverted).joined())")
            }
        }
        return ExistingKeys(nameAddress: nameAddress, namePhone: namePhone)
    }
}
