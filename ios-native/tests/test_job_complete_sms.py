from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]


class JobCompleteSmsTests(unittest.TestCase):
    def test_edge_function_authenticates_and_scopes_job_lookup(self) -> None:
        edge = (REPO_ROOT / "supabase/functions/send-job-complete-sms/index.ts").read_text()

        self.assertIn("supabaseAdmin.auth.getUser(token)", edge)
        self.assertIn('.from("jobs")', edge)
        self.assertIn('.eq("id", jobId)', edge)
        self.assertIn('.eq("user_id", caller.id)', edge)
        self.assertIn('.eq("status", "done")', edge)
        self.assertIn('.from("clients")', edge)
        self.assertIn('.eq("user_id", caller.id)', edge)
        self.assertIn("Your lawn service was completed today! - MowGo", edge)

    def test_ios_calls_edge_function_after_completion_webhook(self) -> None:
        data_store = (REPO_ROOT / "ios-native/MowGo/Services/DataStore.swift").read_text()
        done_case = data_store.split("case .done:", 1)[1].split("case .skipped:", 1)[0]

        webhook = done_case.index("await fireWebhookJobCompleted(updated)")
        sms = done_case.index("await fireJobCompleteSms(updated)")
        push = done_case.index("await firePushJobCompleted(updated)")
        self.assertLess(webhook, sms)
        self.assertLess(sms, push)
        self.assertIn(
            '_ = try? await sb.requestFunction("send-job-complete-sms", body: ["jobId": job.id.uuidString])',
            data_store,
        )
        self.assertEqual(data_store.count("await fireJobCompleteSms(updated)"), 2)


if __name__ == "__main__":
    unittest.main()
