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
import com.mowgo.app.ui.theme.MowGoColors

@Composable
fun SplashScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToMain: () -> Unit,
) {
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        // Fade in
        alpha.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 500, easing = FastOutSlowInEasing),
        )
        // Hold
        kotlinx.coroutines.delay(800L)
        // Determine destination (for now always go to login — auth check comes in Batch 2)
        onNavigateToLogin()
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
        }
    }
}
