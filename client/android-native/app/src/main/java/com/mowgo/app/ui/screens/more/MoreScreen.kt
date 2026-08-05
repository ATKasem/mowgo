package com.mowgo.app.ui.screens.more

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.BuildConfig
import com.mowgo.app.data.SettingsRepository
import com.mowgo.app.data.model.Profile

private enum class MoreDestination { ROOT, PROFILE, NOTIFICATIONS, APPEARANCE, BILLING, INTEGRATIONS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    openBillingEvent: Long = 0L,
    onSignedOut: () -> Unit = {},
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

    LaunchedEffect(openBillingEvent) {
        if (openBillingEvent > 0L) destination = MoreDestination.BILLING
    }
    LifecycleResumeEffect(Unit) {
        viewModel.onResume()
        onPauseOrDispose { }
    }

    BackHandler(enabled = destination != MoreDestination.ROOT) { destination = MoreDestination.ROOT }
    when (destination) {
        MoreDestination.ROOT -> MoreRootScreen(state, appearance, viewModel::loadProfile, { destination = it }, viewModel, onSignedOut)
        MoreDestination.PROFILE -> BusinessProfileScreen(state, { destination = MoreDestination.ROOT }, viewModel::updateProfile, viewModel::dismissSaveMessage)
        MoreDestination.NOTIFICATIONS -> NotificationSettingsScreen(completionAlerts, rainAlerts, { destination = MoreDestination.ROOT }, viewModel::setCompletionAlerts, viewModel::setRainAlerts)
        MoreDestination.APPEARANCE -> AppearanceSettingsScreen(appearance, { destination = MoreDestination.ROOT }, viewModel::setAppearance)
        MoreDestination.BILLING -> BillingSettingsScreen(
            state = state,
            back = { destination = MoreDestination.ROOT },
            startCheckout = viewModel::startCheckout,
            setBillingInterval = viewModel::setBillingInterval,
            openCustomerPortal = viewModel::openCustomerPortal,
            cancelSubscription = viewModel::cancelSubscription,
            billingUrlHandled = viewModel::billingUrlHandled,
            billingUrlFailed = viewModel::billingUrlFailed,
        )
        MoreDestination.INTEGRATIONS -> IntegrationsScreen(back = { destination = MoreDestination.ROOT })
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
) {
    val context = LocalContext.current
    var confirmSignOut by remember { mutableStateOf(false) }
    val clientsExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) viewModel.exportData("clients", uri, context.contentResolver)
    }
    val jobsExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) viewModel.exportData("jobs", uri, context.contentResolver)
    }
    val invoicesExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) viewModel.exportData("invoices", uri, context.contentResolver)
    }
    LaunchedEffect(state.exportMessage, state.exportError) {
        val message = state.exportMessage ?: state.exportError
        if (message != null) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            viewModel.dismissExportResult()
        }
    }
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
                    SettingsRow(Icons.Default.Storefront, "Business Profile", state.profile?.businessName?.takeIf { it.isNotBlank() } ?: "Business name and phone") { navigate(MoreDestination.PROFILE) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Notifications, "Notifications", "Job completion and rain alerts") { navigate(MoreDestination.NOTIFICATIONS) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Contrast, "Appearance", appearance.replaceFirstChar { it.titlecase() }) { navigate(MoreDestination.APPEARANCE) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.CreditCard, "Billing", tierLabel(state.profile?.tier)) { navigate(MoreDestination.BILLING) }
                    if (state.profile?.tier == "solo" || state.profile?.tier == "crew" || state.profile?.tier == "premium") {
                        HorizontalDivider(Modifier.padding(start = 56.dp))
                        SettingsRow(Icons.Default.Link, "Integrations", "Zapier, Make, n8n webhooks") { navigate(MoreDestination.INTEGRATIONS) }
                    }
                }
                SectionLabel("Export data")
                Card {
                    ExportRow(Icons.Default.People, "Export Clients", state.exportLoadingAction == "clients", state.exportLoadingAction == null) { clientsExport.launch("mowgo-clients.csv") }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    ExportRow(Icons.Default.Work, "Export Jobs", state.exportLoadingAction == "jobs", state.exportLoadingAction == null) { jobsExport.launch("mowgo-jobs.csv") }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    ExportRow(Icons.Default.ReceiptLong, "Export Invoices", state.exportLoadingAction == "invoices", state.exportLoadingAction == null) { invoicesExport.launch("mowgo-invoices.csv") }
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
private fun ExportRow(icon: ImageVector, title: String, loading: Boolean, enabled: Boolean, onClick: () -> Unit) = ListItem(
    headlineContent = { Text(title) },
    leadingContent = { Icon(icon, null, tint = MaterialTheme.colorScheme.primary) },
    trailingContent = {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        else Icon(Icons.Default.FileDownload, null)
    },
    modifier = Modifier.clickable(enabled = enabled, onClick = onClick),
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
private fun BusinessProfileScreen(state: MoreUiState, back: () -> Unit, save: (String, String, String, String, String, String) -> Unit, dismissMessage: () -> Unit) {
    val context = LocalContext.current
    var name by remember(state.profile) { mutableStateOf(state.profile?.businessName ?: "") }
    var phone by remember(state.profile) { mutableStateOf(state.profile?.phone ?: "") }
    var email by remember(state.profile) { mutableStateOf(state.profile?.email ?: "") }
    var venmo by remember(state.profile) { mutableStateOf(state.profile?.venmoHandle ?: "") }
    var cashapp by remember(state.profile) { mutableStateOf(state.profile?.cashappHandle ?: "") }
    var zelle by remember(state.profile) { mutableStateOf(state.profile?.zelleHandle ?: "") }
    LaunchedEffect(state.saveMessage) { state.saveMessage?.let { Toast.makeText(context, it, Toast.LENGTH_SHORT).show(); dismissMessage() } }
    DetailScaffold("Business Profile", back) {
        OutlinedTextField(name, { name = it }, label = { Text("Business name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(phone, { phone = it }, label = { Text("Phone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, enabled = false, modifier = Modifier.fillMaxWidth())
        HorizontalDivider()
        Text("How clients pay you", style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(zelle, { zelle = it }, label = { Text("Zelle (phone or email)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(venmo, { venmo = it }, label = { Text("Venmo (@handle)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(cashapp, { cashapp = it }, label = { Text("Cash App (\$handle)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Text("These go in your invoice texts. Zelle is listed first — clients usually pay the first option they see.", style = MaterialTheme.typography.bodySmall, color = MowGoColors.TextSecondaryDark)
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = { if (name.isNotBlank()) save(name.trim(), phone.trim(), email.trim(), venmo.trim(), cashapp.trim(), zelle.trim()) }, enabled = name.isNotBlank() && !state.isSaving, modifier = Modifier.fillMaxWidth()) {
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
    startCheckout: (String, String) -> Unit,
    setBillingInterval: (String) -> Unit,
    openCustomerPortal: () -> Unit,
    cancelSubscription: () -> Unit,
    billingUrlHandled: () -> Unit,
    billingUrlFailed: () -> Unit,
) {
    val context = LocalContext.current
    val tier = state.profile?.tier?.lowercase() ?: "free"
    val billingInterval = state.billingInterval
    val description = when (tier) {
        "solo" -> "Unlimited clients & jobs"
        "crew" -> "Everything in Solo · Unlimited clients · Team"
        "premium" -> "Everything in Crew"
        else -> "5 clients · Rain delay · Invoicing"
    }
    val isPaid = tier == "solo" || tier == "crew" || tier == "premium"
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
            Text(planName(tier), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
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
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("month" to "Month", "year" to "Annual").forEachIndexed { index, option ->
                SegmentedButton(
                    selected = billingInterval == option.first,
                    onClick = { setBillingInterval(option.first) },
                    shape = SegmentedButtonDefaults.itemShape(index, 2),
                    label = { Text(option.second) },
                )
            }
        }
        if (billingInterval == "year") {
            Text(
                "2 months free",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
        }
        BillingPlanCard(
            name = "Free",
            features = listOf("5 clients · Rain delay · Invoicing"),
            tier = "free",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
        )
        BillingPlanCard(
            name = "Solo",
            features = listOf("Unlimited clients & jobs"),
            tier = "solo",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
        )
        BillingPlanCard(
            name = "Crew",
            features = listOf("Everything in Solo · Unlimited clients · Team"),
            tier = "crew",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
        )
        BillingPlanCard(
            name = "Premium",
            features = listOf(
                "Everything in Crew",
                "Priority concierge setup — clients imported + first 30 days pre-scheduled in 48h",
                "Seasonal packs: spring pricing benchmarks, route templates",
                "Priority text-first support",
            ),
            tier = "premium",
            currentTier = tier,
            billingInterval = billingInterval,
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
    features: List<String>,
    tier: String,
    currentTier: String,
    billingInterval: String,
    loadingAction: String?,
    subscribe: (String, String) -> Unit,
) {
    val order = mapOf("free" to 0, "solo" to 1, "crew" to 2, "premium" to 3)
    val isCurrent = tier == currentTier
    val canUpgrade = (order[tier] ?: 0) > (order[currentTier] ?: 0)
    val isAnnual = billingInterval == "year"
    val price = when (tier) {
        "solo" -> if (isAnnual) "$390/yr" else "$39/mo"
        "crew" -> if (isAnnual) "$790/yr" else "$79/mo"
        "premium" -> if (isAnnual) "$1,990/yr" else "$199/mo"
        else -> "$0/mo"
    }
    val savings = when {
        !isAnnual -> null
        tier == "solo" -> "Save $78"
        tier == "crew" -> "Save $158"
        tier == "premium" -> "Save $398"
        else -> null
    }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(price, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    savings?.let {
                        Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
                if (isCurrent) {
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
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
                        Text(
                            "Billing interval changes via Manage Billing",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            features.forEach { feature ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(8.dp))
                    Text(feature, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (canUpgrade) {
                val action = "checkout:$tier"
                Button(
                    onClick = { subscribe(tier, billingInterval) },
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

private fun tierLabel(tier: String?, billingInterval: String = "month"): String = when (tier) {
    "solo" -> if (billingInterval == "year") "Solo · $390/yr" else "Solo · $39/mo"
    "crew" -> if (billingInterval == "year") "Crew · $790/yr" else "Crew · $79/mo"
    "premium" -> if (billingInterval == "year") "Premium · $1,990/yr" else "Premium · $199/mo"
    else -> "Free Plan"
}

/** Cadence-neutral plan name for the Current Plan card — the user's actual
 *  billing interval is not stored in the profile, so never claim one. */
private fun planName(tier: String?): String = when (tier) {
    "solo" -> "Solo Plan"
    "crew" -> "Crew Plan"
    "premium" -> "Premium Plan"
    else -> "Free Plan"
}
