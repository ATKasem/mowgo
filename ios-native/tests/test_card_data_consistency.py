from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1] / "MowGo"


def source(relative_path: str) -> str:
    return (ROOT / relative_path).read_text()


class CardDataConsistencyTests(unittest.TestCase):
    def test_client_updates_refresh_referencing_job_snapshots_in_every_path(self) -> None:
        data_store = source("Services/DataStore.swift")
        update_client = data_store.split(
            "func updateClient(_ client: Client)", 1
        )[1].split("func deleteClient", 1)[0]

        self.assertIn("private func refreshJobClientRefs", data_store)
        self.assertEqual(update_client.count("refreshJobClientRefs(for: updated.id)"), 3)

    def test_job_card_shows_pets_key_and_phone_without_inline_address(self) -> None:
        job_card = source("Views/Components/JobCardView.swift")
        data_lines = job_card.split(
            'if let notes = job.clients?.petInstructions', 1
        )[1].split("// Photo thumbnail row", 1)[0]

        self.assertIn('Text("Pets: \\(notes)")', data_lines)
        self.assertIn('Text("Key: \\(key)")', data_lines)
        self.assertIn("job.clients?.phone", data_lines)
        self.assertNotIn("job.clients?.address", data_lines)
        self.assertNotIn('Image(systemName: "mappin")', data_lines)

    def test_card_actions_remain_available(self) -> None:
        job_card = source("Views/Components/JobCardView.swift")
        client_card = source("Views/Clients/ClientsView.swift")

        self.assertIn('Image(systemName: "phone.fill")', job_card)
        self.assertIn('Image(systemName: "location.fill")', job_card)
        self.assertIn('job.status == .done ? "Undo" : "Complete"', job_card)
        self.assertIn('Button("Edit")', client_card)
        self.assertIn("client.phone", client_card)

    def test_client_details_use_job_card_vertical_layout_and_order(self) -> None:
        client_card = source("Views/Clients/ClientsView.swift")
        expanded = client_card.split("if isExpanded {", 1)[1].split(
            'Button("Edit")', 1
        )[0]

        self.assertIn("VStack(alignment: .leading, spacing: 4)", expanded)
        self.assertNotIn("stride(from:", expanded)
        self.assertNotIn("HStack(spacing: 6)", expanded)

        ordered_details = [
            "client.phone",
            "client.keyCode",
            "client.petInstructions",
            "client.address",
            "client.cleaningNotes",
        ]
        positions = [expanded.index(detail) for detail in ordered_details]
        self.assertEqual(positions, sorted(positions))
        self.assertIn('DetailRow(icon: "map", text: address)', expanded)
        self.assertIn("Button(action: { openMaps(address) })", expanded)

        detail_row = client_card.split("struct DetailRow: View", 1)[1]
        self.assertIn(".font(.system(size: 9))", detail_row)
        self.assertIn(".font(.caption2)", detail_row)


if __name__ == "__main__":
    unittest.main()
