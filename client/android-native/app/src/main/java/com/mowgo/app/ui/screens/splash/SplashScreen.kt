package com.mowgo.app.ui.screens.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import com.mowgo.app.data.auth.AuthRepository
import com.mowgo.app.ui.theme.MowGoColors
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

@Composable
fun SplashScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToMain: () -> Unit,
    authRepository: AuthRepository = remember { AuthRepository() },
) {
    val alpha = remember { Animatable(0f) }
    var isCheckingSession by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        // Fade in
        alpha.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 500, easing = FastOutSlowInEasing),
        )
        // Hold
        kotlinx.coroutines.delay(800L)

        // Restore an existing session if one was persisted by EncryptedSessionManager.
        // The Auth plugin auto-loads/refreshes from the session manager on client init and
        // starts at SessionStatus.Initializing until that resolves.
        isCheckingSession = true
        val isAuthenticated = try {
            withTimeoutOrNull(5_000L) {
                authRepository.sessionState.first { it !is SessionStatus.Initializing }
            } is SessionStatus.Authenticated
        } catch (e: Exception) {
            false
        }

        if (isAuthenticated) {
            onNavigateToMain()
        } else {
            onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MowGoColors.BackgroundDark),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.alpha(alpha.value),
        ) {
            Icon(
                painter = androidx.compose.ui.res.painterResource(com.mowgo.app.R.drawable.ic_leaf),
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MowGoColors.DeepGreenDark,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "MowGo",
                style = MaterialTheme.typography.headlineLarge,
                color = MowGoColors.TextPrimaryDark,
            )
            if (isCheckingSession) {
                Spacer(modifier = Modifier.height(24.dp))
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MowGoColors.DeepGreenDark,
                    strokeWidth = 2.dp,
                )
            }
        }
    }
}
