//
//  MowGoUITests.swift
//  MowGoUITests
//
//  Simulator smoke tests. The app launches in demo mode (`-UITestDemoMode`,
//  debug builds only) so no backend or account is needed. Screenshots are
//  kept as test attachments; CI exports them as an artifact.
//

import XCTest

final class MowGoUITests: XCTestCase {
    private let tabs = ["Dashboard", "Today", "Clients", "Invoices", "More"]

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchDemo(darkMode: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-UITestDemoMode", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        if darkMode { app.launchArguments += ["-appearanceMode", "dark"] }
        app.launch()
        return app
    }

    private func attachScreenshot(_ app: XCUIApplication, named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func waitForTabBar(_ app: XCUIApplication) -> XCUIElement {
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 30), "Tab bar never appeared — app stuck on splash or login")
        return tabBar
    }

    /// Launches, then visits every tab and screenshots it.
    func testEveryTabRenders() throws {
        let app = launchDemo()
        let tabBar = waitForTabBar(app)
        attachScreenshot(app, named: "01-launch")

        for (index, name) in tabs.enumerated() {
            let button = tabBar.buttons[name]
            XCTAssertTrue(button.waitForExistence(timeout: 5), "Missing tab: \(name)")
            button.tap()
            XCTAssertTrue(button.isSelected, "Tab \(name) did not become selected")
            // Let the screen settle (data loads, animations) before capturing.
            _ = app.staticTexts.firstMatch.waitForExistence(timeout: 5)
            attachScreenshot(app, named: String(format: "%02d-tab-%@", index + 2, name))
        }
        XCTAssertEqual(app.state, .runningForeground, "App crashed or left the foreground")
    }

    /// Demo clients load into the Clients tab.
    func testClientsTabShowsDemoClients() throws {
        let app = launchDemo()
        waitForTabBar(app).buttons["Clients"].tap()
        let client = app.staticTexts["Smith Residence"]
        XCTAssertTrue(client.waitForExistence(timeout: 10), "Demo client 'Smith Residence' not shown")
        attachScreenshot(app, named: "10-clients-demo-data")
    }

    /// Dark mode renders every tab too.
    func testEveryTabRendersInDarkMode() throws {
        let app = launchDemo(darkMode: true)
        let tabBar = waitForTabBar(app)
        for (index, name) in tabs.enumerated() {
            tabBar.buttons[name].tap()
            _ = app.staticTexts.firstMatch.waitForExistence(timeout: 5)
            attachScreenshot(app, named: String(format: "%02d-dark-%@", index + 20, name))
        }
        XCTAssertEqual(app.state, .runningForeground)
    }
}
