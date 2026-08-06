package com.mowgo.app.ui.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.mowgo.app.ui.navigation.BottomNavItem
import com.mowgo.app.ui.navigation.NavRoutes
import com.mowgo.app.ui.screens.today.TodayScreen
import com.mowgo.app.ui.screens.jobs.JobsScreen
import com.mowgo.app.ui.screens.clients.ClientsScreen
import com.mowgo.app.ui.screens.invoices.InvoicesScreen
import com.mowgo.app.ui.screens.more.MoreScreen
import com.mowgo.app.ui.screens.dashboard.DashboardScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    settingsDeepLinkEvent: Long = 0L,
    onSignedOut: () -> Unit = {},
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    var viewPlansEvent by rememberSaveable { mutableStateOf(0L) }

    LaunchedEffect(settingsDeepLinkEvent) {
        if (settingsDeepLinkEvent > 0L) {
            navController.navigate(NavRoutes.MORE) {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ) {
                BottomNavItem.entries.forEach { item ->
                    val selected = currentRoute == item.route
                    val label = stringResource(item.labelRes)
                    NavigationBarItem(
                        icon = {
                            Icon(
                                imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                contentDescription = label,
                            )
                        },
                        label = {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelSmall,
                            )
                        },
                        selected = selected,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            indicatorColor = MaterialTheme.colorScheme.surface,
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = NavRoutes.DASHBOARD,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(NavRoutes.DASHBOARD) {
                DashboardScreen(
                    onNavigateToTab = { route ->
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(NavRoutes.TODAY) { TodayScreen() }
            composable(NavRoutes.JOBS) { JobsScreen() }
            composable(NavRoutes.CLIENTS) {
                ClientsScreen(
                    onViewPlans = {
                        viewPlansEvent += 1
                        navController.navigate(NavRoutes.MORE) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(NavRoutes.INVOICES) { InvoicesScreen() }
            composable(NavRoutes.MORE) {
                MoreScreen(
                    openBillingEvent = settingsDeepLinkEvent + viewPlansEvent,
                    onSignedOut = onSignedOut,
                )
            }
        }
    }
}
