package com.mowgo.app

import android.os.Bundle
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

class MowGoActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
                MowGoNavHost()
            }
        }
    }
}

@Composable
fun MowGoNavHost() {
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
            MainScreen(
                onSignedOut = {
                    navController.navigate(NavRoutes.LOGIN) {
                        popUpTo("main") { inclusive = true }
                    }
                },
            )
        }
    }
}
