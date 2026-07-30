from pathlib import Path
import unittest


TODAY_VIEW = (
    Path(__file__).resolve().parents[1]
    / "MowGo"
    / "Views"
    / "Today"
    / "TodayView.swift"
)


class CalendarModeTests(unittest.TestCase):
    def test_week_and_month_modes_share_the_day_cell_grid(self) -> None:
        source = TODAY_VIEW.read_text()

        self.assertIn("private enum CalendarMode: String, CaseIterable", source)
        self.assertIn("@State private var calendarMode: CalendarMode = .week", source)
        self.assertIn("private var weekDays: [DayCell]", source)
        self.assertIn("private var displayedDays: [DayCell]", source)
        self.assertIn("calendarMode == .week ? weekDays : monthDays", source)
        self.assertIn("ForEach(displayedDays) { cell in", source)
        self.assertIn("private func dayCell(_ cell: DayCell)", source)

    def test_calendar_exposes_an_accessible_mode_switch(self) -> None:
        source = TODAY_VIEW.read_text()

        self.assertIn('Picker("Calendar view", selection: $calendarMode)', source)
        self.assertIn(".pickerStyle(.segmented)", source)
        self.assertIn('.accessibilityLabel("Calendar view")', source)


if __name__ == "__main__":
    unittest.main()
