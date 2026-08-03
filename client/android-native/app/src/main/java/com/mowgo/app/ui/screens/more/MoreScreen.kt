package com.mowgo.app.ui.screens.more

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.BuildConfig
import com.mowgo.app.data.SettingsRepository
import com.mowgo.app.data.model.Profile

private enum class MoreDestination { ROOT, PROFILE, NOTIFICATIONS, APPEARANCE, BILLING }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    onSignedOut: () -> Unit = {},
    onOpenChat: () -> Unit = {},
) {
    val context = LocalContext.current
    val factory = remember(context) {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                MoreViewModel(SettingsRepository(context.applicationContext)) as T
        }
    }
    val viewModel: MoreViewModel = viewModel(factory = factory)
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val appearance by viewModel.appearanceMode.collectAsStateWithLifecycle(initialValue = "system")
    val completionAlerts by viewModel.jobCompletionAlerts.collectAsStateWithLifecycle(initialValue = true)
    val rainAlerts by viewModel.rainDelayAlerts.collectAsStateWithLifecycle(initialValue = true)
    var destination by rememberSaveable { mutableStateOf(MoreDestination.ROOT) }

    BackHandler(enabled = destination != MoreDestination.ROOT) { destination = MoreDestination.ROOT }
    when (destination) {
        MoreDestination.ROOT -> MoreRootScreen(state, appearance, viewModel::loadProfile, { destination = it }, viewModel, onSignedOut, onOpenChat)
        MoreDestination.PROFILE -> BusinessProfileScreen(state, { destination = MoreDestination.ROOT }, viewModel::updateProfile, viewModel::dismissSaveMessage)
        MoreDestination.NOTIFICATIONS -> NotificationSettingsScreen(completionAlerts, rainAlerts, { destination = MoreDestination.ROOT }, viewModel::setCompletionAlerts, viewModel::setRainAlerts)
        MoreDestination.APPEARANCE -> AppearanceSettingsScreen(appearance, { destination = MoreDestination.ROOT }, viewModel::setAppearance)
        MoreDestination.BILLING -> BillingSettingsScreen(
            state = state,
            back = { destination = MoreDestination.ROOT },
            startCheckout = viewModel::startCheckout,
            openCustomerPortal = viewModel::openCustomerPortal,
            cancelSubscription = viewModel::cancelSubscription,
            billingUrlHandled = viewModel::billingUrlHandled,
            billingUrlFailed = viewModel::billingUrlFailed,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoreRootScreen(
    state: MoreUiState,
    appearance: String,
    refresh: () -> Unit,
    navigate: (MoreDestination) -> Unit,
    viewModel: MoreViewModel,
    onSignedOut: () -> Unit,
    onOpenChat: () -> Unit,
) {
    var confirmSignOut by remember { mutableStateOf(false) }
    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign Out") },
            text = { Text("You'll need to sign in again.") },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; viewModel.signOut(onSignedOut) }) { Text("Sign Out", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
        )
    }
    Scaffold(topBar = { TopAppBar(title = { Text("More", style = MaterialTheme.typography.titleLarge) }) }) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ProfileCard(state.profile)
                SectionLabel("Business")
                Card {
                    SettingsRow(Icons.Default.Chat, "MowGo AI", "Your lawn care business assistant", onOpenChat)
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Storefront, "Business Profile", state.profile?.businessName?.takeIf { it.isNotBlank() } ?: "Business name and phone") { navigate(MoreDestination.PROFILE) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Notifications, "Notifications", "Job completion and rain alerts") { navigate(MoreDestination.NOTIFICATIONS) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Contrast, "Appearance", appearance.replaceFirstChar { it.titlecase() }) { navigate(MoreDestination.APPEARANCE) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.CreditCard, "Billing", tierLabel(state.profile?.tier)) { navigate(MoreDestination.BILLING) }
                }
                SectionLabel("About")
                Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    InfoRow("Version", BuildConfig.VERSION_NAME)
                    InfoRow("Package", BuildConfig.APPLICATION_ID)
                    InfoRow("Made in", "OKC 🌾")
                } }
                Card(Modifier.fillMaxWidth().clickable(enabled = !state.isSigningOut) { confirmSignOut = true }) {
                    if (state.isSigningOut) {
                        Row(Modifier.align(Alignment.CenterHorizontally).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            Text("Signing out…", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium)
                        }
                    } else {
                        Text("Sign Out", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium, modifier = Modifier.align(Alignment.CenterHorizontally).padding(16.dp))
                    }
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)) }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun ProfileCard(profile: Profile?) = Card(Modifier.fillMaxWidth()) {
    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.AccountCircle, null, Modifier.size(52.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(8.dp))
        Text(profile?.businessName?.takeIf { it.isNotBlank() } ?: "MowGo", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(tierLabel(profile?.tier), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SectionLabel(text: String) = Text(text, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, start = 4.dp))

@Composable
private fun SettingsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) = ListItem(
    headlineContent = { Text(title) }, supportingContent = { Text(subtitle) },
    leadingContent = { Icon(icon, null, tint = MaterialTheme.colorScheme.primary) },
    trailingContent = { Icon(Icons.Default.ChevronRight, null) },
    modifier = Modifier.clickable(onClick = onClick),
)

@Composable
private fun InfoRow(label: String, value: String) = Row(Modifier.fillMaxWidth()) {
    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.weight(1f)); Text(value)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScaffold(title: String, back: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text(title) }, navigationIcon = { IconButton(onClick = back) { Icon(Icons.Default.ArrowBack, "Back") } }) }) { padding ->
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
    }
}

@Composable
private fun BusinessProfileScreen(state: MoreUiState, back: () -> Unit, save: (String, String, String) -> Unit, dismissMessage: () -> Unit) {
    val context = LocalContext.current
    var name by remember(state.profile) { mutableStateOf(state.profile?.businessName ?: "") }
    var phone by remember(state.profile) { mutableStateOf(state.profile?.phone ?: "") }
    var email by remember(state.profile) { mutableStateOf(state.profile?.email ?: "") }
    LaunchedEffect(state.saveMessage) { state.saveMessage?.let { Toast.makeText(context, it, Toast.LENGTH_SHORT).show(); dismissMessage() } }
    DetailScaffold("Business Profile", back) {
        OutlinedTextField(name, { name = it }, label = { Text("Business name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(phone, { phone = it }, label = { Text("Phone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, enabled = false, modifier = Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = { if (name.isNotBlank()) save(name.trim(), phone.trim(), email.trim()) }, enabled = name.isNotBlank() && !state.isSaving, modifier = Modifier.fillMaxWidth()) {
            if (state.isSaving) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Save Changes")
        }
    }
}

@Composable
private fun NotificationSettingsScreen(completion: Boolean, rain: Boolean, back: () -> Unit, setCompletion: (Boolean) -> Unit, setRain: (Boolean) -> Unit) {
    DetailScaffold("Notifications", back) {
        Card { SettingsSwitchRow("Job completion alerts", "When a job is marked complete", completion, setCompletion) }
        Card { SettingsSwitchRow("Rain delay alerts", "When rain may affect tomorrow's jobs", rain, setRain) }
    }
}

@Composable
private fun SettingsSwitchRow(title: String, subtitle: String, checked: Boolean, changed: (Boolean) -> Unit) = ListItem(
    headlineContent = { Text(title) }, supportingContent = { Text(subtitle) }, trailingContent = { Switch(checked, changed) },
)

@Composable
private fun AppearanceSettingsScreen(mode: String, back: () -> Unit, select: (String) -> Unit) {
    DetailScaffold("Appearance", back) {
        Card { Column { listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEachIndexed { index, option ->
            ListItem(
                headlineContent = { Text(option.second) },
                trailingContent = { if (mode == option.first) Icon(Icons.Default.Check, "Selected", tint = MaterialTheme.colorScheme.primary) },
                modifier = Modifier.clickable { select(option.first) },
            )
            if (index < 2) HorizontalDivider(Modifier.padding(start = 16.dp))
        } } }
    }
}

@Composable
private fun BillingSettingsScreen(
    state: MoreUiState,
    back: () -> Unit,
    startCheckout: (String) -> Unit,
    openCustomerPortal: () -> Unit,
    cancelSubscription: () -> Unit,
    billingUrlHandled: () -> Unit,
    billingUrlFailed: () -> Unit,
) {
    val context = LocalContext.current
    val tier = state.profile?.tier?.lowercase() ?: "free"
    val price = when (tier) { "solo" -> "$39/mo"; "crew" -> "$79/mo"; else -> "$0/mo" }
    val description = when (tier) { "solo" -> "15 clients · AI assistant"; "crew" -> "Unlimited · Team · Priority"; else -> "5 clients · Basic features" }
    val isPaid = tier == "solo" || tier == "crew"
    var showCancelConfirmation by remember { mutableStateOf(false) }

    LaunchedEffect(state.pendingBillingUrl) {
        val url = state.pendingBillingUrl
        if (url != null) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            if (context !is Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val opened = runCatching { context.startActivity(intent) }.isSuccess
            if (opened) billingUrlHandled() else billingUrlFailed()
        }
    }

    if (showCancelConfirmation) {
        AlertDialog(
            onDismissRequest = { showCancelConfirmation = false },
            title = { Text("Cancel Subscription") },
            text = { Text("Cancel your current subscription? Your plan access may change at the end of the billing period.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCancelConfirmation = false
                        cancelSubscription()
                    },
                    enabled = state.billingLoadingAction == null,
                ) { Text("Cancel Subscription", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showCancelConfirmation = false }) { Text("Keep Plan") }
            },
        )
    }

    DetailScaffold("Billing", back) {
        Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Current Plan", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(tierLabel(tier), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(price, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (isPaid) {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { showCancelConfirmation = true },
                    enabled = state.billingLoadingAction == null,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    if (state.billingLoadingAction == "cancel") {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Cancel Subscription")
                    }
                }
            }
        } }

        SectionLabel("Plans")
        BillingPlanCard(
            name = "Free",
            price = "$0/mo",
            feature = "5 clients · Basic features",
            tier = "free",
            currentTier = tier,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
        )
        BillingPlanCard(
            name = "Solo",
            price = "$39/mo",
            feature = "15 clients · AI assistant",
            tier = "solo",
            currentTier = tier,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
        )
        BillingPlanCard(
            name = "Crew",
            price = "$79/mo",
            feature = "Unlimited · Team · Priority",
            tier = "crew",
            currentTier = tier,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
        )

        if (isPaid) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = state.billingLoadingAction == null) { openCustomerPortal() },
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.CreditCard, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Manage Billing", fontWeight = FontWeight.Medium)
                        Text("Payment methods and invoices", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (state.billingLoadingAction == "portal") {
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.ChevronRight, null)
                    }
                }
            }
        }

        state.billingError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        state.billingMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun BillingPlanCard(
    name: String,
    price: String,
    feature: String,
    tier: String,
    currentTier: String,
    loadingAction: String?,
    subscribe: (String) -> Unit,
) {
    val order = mapOf("free" to 0, "solo" to 1, "crew" to 2)
    val isCurrent = tier == currentTier
    val canUpgrade = (order[tier] ?: 0) > (order[currentTier] ?: 0)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(price, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                if (isCurrent) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        shape = MaterialTheme.shapes.small,
                    ) {
                        Text(
                            "Current",
                            color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CheckCircle, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(feature, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (canUpgrade) {
                val action = "checkout:$tier"
                Button(
                    onClick = { subscribe(tier) },
                    enabled = loadingAction == null,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (loadingAction == action) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text(if (currentTier == "free") "Subscribe" else "Upgrade")
                    }
                }
            }
        }
    }
}

private fun tierLabel(tier: String?): String = when (tier) {
    "solo" -> "Solo · $39/mo"
    "crew" -> "Crew · $79/mo"
    else -> "Free Plan"
}
