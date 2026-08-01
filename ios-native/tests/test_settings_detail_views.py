from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1] / "MowGo"


class SettingsDetailViewsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.settings = (ROOT / "Views/Settings/SettingsView.swift").read_text()

    def test_all_settings_detail_views_live_in_settings_file(self) -> None:
        for view in (
            "BusinessProfileSettingsView",
            "NotificationSettingsView",
            "AppearanceSettingsView",
            "BillingSettingsView",
        ):
            self.assertIn(f"private struct {view}: View", self.settings)

    def test_detail_views_receive_explicit_bindings_and_closures(self) -> None:
        expected_contracts = (
            "@Binding var businessName: String",
            "@Binding var phone: String",
            "let onSave: () async -> Void",
            "@Binding var jobCompletionAlerts: Bool",
            "@Binding var rainDelayAlerts: Bool",
            "@Binding var appearance: AppearancePreference",
            "let onManageSubscription: () -> Void",
            "let onCancelSubscription: () -> Void",
            "let onViewPlans: () -> Void",
        )
        for contract in expected_contracts:
            self.assertIn(contract, self.settings)

    def test_settings_root_navigates_to_all_detail_views(self) -> None:
        for title in ("Business Profile", "Notifications", "Appearance", "Billing"):
            self.assertIn(f'NavigationLink(value: SettingsDestination.', self.settings)
            self.assertIn(f'"{title}"', self.settings)


if __name__ == "__main__":
    unittest.main()
