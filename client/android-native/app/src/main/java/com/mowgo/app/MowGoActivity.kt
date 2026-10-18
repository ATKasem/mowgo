package com.mowgo.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.mowgo.app.ui.navigation.NavRoutes
import com.mowgo.app.ui.screens.MainScreen
import com.mowgo.app.ui.screens.auth.LoginScreen
import com.mowgo.app.ui.screens.splash.SplashScreen
import com.mowgo.app.ui.theme.MowGoTheme
import com.mowgo.app.data.SettingsRepository
import com.mowgo.app.push.FcmService
import kotlinx.coroutines.flow.MutableStateFlow

class MowGoActivity : ComponentActivity() {
    private val settingsDeepLinkEvent = MutableStateFlow(0L)
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        enableEdgeToEdge()
        setContent {
            val settingsRepository = remember { SettingsRepository(applicationContext) }
            val appearanceMode by settingsRepository.appearanceMode.collectAsState(initial = "system")
            val systemDark = isSystemInDarkTheme()
            val darkTheme = when (appearanceMode) {
                "light" -> false
                "dark" -> true
                else -> systemDark
            }
            MowGoTheme(darkTheme = darkTheme) {
                val deepLinkEvent by settingsDeepLinkEvent.collectAsState()
                MowGoNavHost(
                    settingsDeepLinkEvent = deepLinkEvent,
                    onAuthenticated = ::registerForPushNotifications,
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data
        if (data?.scheme == "mowgo" && data.host == "settings") {
            settingsDeepLinkEvent.value = settingsDeepLinkEvent.value + 1
        }
    }

    private fun registerForPushNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        FcmService.registerCurrentToken()
    }
}

@Composable
fun MowGoNavHost(
    settingsDeepLinkEvent: Long = 0L,
    onAuthenticated: () -> Unit = {},
) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = NavRoutes.SPLASH,
        modifier = Modifier.fillMaxSize(),
    ) {
        composable(NavRoutes.SPLASH) {
            SplashScreen(
                onNavigateToLogin = {
                    navController.navigate(NavRoutes.LOGIN) {
                        popUpTo(NavRoutes.SPLASH) { inclusive = true }
                    }
                },
                onNavigateToMain = {
                    navController.navigate("main") {
                        popUpTo(NavRoutes.SPLASH) { inclusive = true }
                    }
                },
            )
        }

        composable(NavRoutes.LOGIN) {
            LoginScreen(
                onNavigateToMain = {
                    navController.navigate("main") {
                        popUpTo(NavRoutes.LOGIN) { inclusive = true }
                    }
                },
            )
        }

        composable("main") {
            LaunchedEffect(Unit) {
                onAuthenticated()
            }
            MainScreen(
                settingsDeepLinkEvent = settingsDeepLinkEvent,
                onSignedOut = {
                    navController.navigate(NavRoutes.LOGIN) {
                        popUpTo("main") { inclusive = true }
                    }
                },
            )
        }
    }
}
