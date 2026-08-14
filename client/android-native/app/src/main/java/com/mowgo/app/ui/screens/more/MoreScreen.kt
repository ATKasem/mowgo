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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mowgo.app.BuildConfig
import com.mowgo.app.R
import com.mowgo.app.data.SettingsRepository
import com.mowgo.app.data.model.Profile

private enum class MoreDestination { ROOT, PROFILE, NOTIFICATIONS, APPEARANCE, BILLING, INTEGRATIONS, REFERRALS }

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
        MoreDestination.NOTIFICATIONS -> NotificationSettingsScreen(
            completion = completionAlerts,
            localRain = rainAlerts,
            profileRain = state.rainAlertsEnabled,
            leadAlerts = state.leadAlertsEnabled,
            tier = state.profile?.tier,
            back = { destination = MoreDestination.ROOT },
            setCompletion = viewModel::setCompletionAlerts,
            setLocalRain = viewModel::setRainAlerts,
            setProfileRain = viewModel::setProfileRainAlerts,
            setLeadAlerts = viewModel::setLeadAlerts,
        )
        MoreDestination.APPEARANCE -> AppearanceSettingsScreen(appearance, { destination = MoreDestination.ROOT }, viewModel::setAppearance)
        MoreDestination.BILLING -> BillingSettingsScreen(
            state = state,
            back = { destination = MoreDestination.ROOT },
            startCheckout = viewModel::startCheckout,
            grantTrial = viewModel::grantTrial,
            setBillingInterval = viewModel::setBillingInterval,
            openCustomerPortal = viewModel::openCustomerPortal,
            cancelSubscription = viewModel::cancelSubscription,
            billingUrlHandled = viewModel::billingUrlHandled,
            billingUrlFailed = viewModel::billingUrlFailed,
        )
        MoreDestination.INTEGRATIONS -> IntegrationsScreen(back = { destination = MoreDestination.ROOT })
        MoreDestination.REFERRALS -> ReferralScreen(state, { destination = MoreDestination.ROOT }, viewModel::loadReferrals)
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
        if (uri != null) viewModel.exportData("clients", uri, context)
    }
    val jobsExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) viewModel.exportData("jobs", uri, context)
    }
    val invoicesExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) viewModel.exportData("invoices", uri, context)
    }
    val leadsExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) viewModel.exportData("leads", uri, context)
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
            title = { Text(stringResource(R.string.more_sign_out_title)) },
            text = { Text(stringResource(R.string.more_sign_out_body)) },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; viewModel.signOut(onSignedOut) }) { Text(stringResource(R.string.more_sign_out_title), color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text(stringResource(R.string.action_cancel)) } },
        )
    }
    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.more_title), style = MaterialTheme.typography.titleLarge) }) }) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Trial-first no-card flow: active trial or trial-ended banner.
                val profile = state.profile
                if (profile != null && profile.hasActiveTrial) {
                    Card(
                        Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.12f),
                        ),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(
                                stringResource(
                                    R.string.trial_active_banner,
                                    profile.trialDaysLeft ?: 1,
                                    profile.trialPlanLabel ?: "Plan",
                                ),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                stringResource(R.string.trial_active_subscribe),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                } else if (profile != null && profile.hasUsedTrial && (profile.tier?.lowercase() == "free")) {
                    Card(
                        Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.12f),
                        ),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(
                                stringResource(R.string.trial_ended_title),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.error,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                stringResource(R.string.trial_ended_body),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                ProfileCard(state.profile)
                if (state.isOffline || state.pendingSyncCount > 0) {
                    SyncStatusCard(isOffline = state.isOffline, pendingSyncCount = state.pendingSyncCount)
                }
                SectionLabel(stringResource(R.string.more_business_section))
                Card {
                    SettingsRow(Icons.Default.Storefront, stringResource(R.string.more_business_profile), state.profile?.businessName?.takeIf { it.isNotBlank() } ?: stringResource(R.string.more_business_profile_default_subtitle)) { navigate(MoreDestination.PROFILE) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Notifications, stringResource(R.string.more_notifications), stringResource(R.string.more_notifications_subtitle)) { navigate(MoreDestination.NOTIFICATIONS) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.Contrast, stringResource(R.string.more_appearance), appearance.replaceFirstChar { it.titlecase() }) { navigate(MoreDestination.APPEARANCE) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.CreditCard, stringResource(R.string.more_billing), tierLabel(state.profile?.tier)) { navigate(MoreDestination.BILLING) }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    SettingsRow(Icons.Default.CardGiftcard, stringResource(R.string.more_referrals), stringResource(R.string.more_referrals_subtitle)) { navigate(MoreDestination.REFERRALS) }
                    if (state.profile?.tier == "solo" || state.profile?.tier == "crew" || state.profile?.tier == "premium") {
                        HorizontalDivider(Modifier.padding(start = 56.dp))
                        SettingsRow(Icons.Default.Link, stringResource(R.string.more_integrations), stringResource(R.string.more_integrations_subtitle)) { navigate(MoreDestination.INTEGRATIONS) }
                    }
                }
                SectionLabel(stringResource(R.string.more_export_section))
                Card {
                    ExportRow(Icons.Default.People, stringResource(R.string.more_export_clients), state.exportLoadingAction == "clients", state.exportLoadingAction == null) { clientsExport.launch("mowgo-clients.csv") }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    ExportRow(Icons.Default.Work, stringResource(R.string.more_export_jobs), state.exportLoadingAction == "jobs", state.exportLoadingAction == null) { jobsExport.launch("mowgo-jobs.csv") }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    ExportRow(Icons.Default.ReceiptLong, stringResource(R.string.more_export_invoices), state.exportLoadingAction == "invoices", state.exportLoadingAction == null) { invoicesExport.launch("mowgo-invoices.csv") }
                    HorizontalDivider(Modifier.padding(start = 56.dp))
                    ExportRow(Icons.Default.Campaign, "Export Leads", state.exportLoadingAction == "leads", state.exportLoadingAction == null) { leadsExport.launch("mowgo-leads.csv") }
                }
                SectionLabel(stringResource(R.string.more_about_section))
                Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    InfoRow(stringResource(R.string.more_version), BuildConfig.VERSION_NAME)
                    InfoRow(stringResource(R.string.more_package), BuildConfig.APPLICATION_ID)
                    InfoRow(stringResource(R.string.more_made_in), stringResource(R.string.more_made_in_value))
                } }
                Card(Modifier.fillMaxWidth().clickable(enabled = !state.isSigningOut) { confirmSignOut = true }) {
                    if (state.isSigningOut) {
                        Row(Modifier.align(Alignment.CenterHorizontally).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            Text(stringResource(R.string.more_signing_out), color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium)
                        }
                    } else {
                        Text(stringResource(R.string.more_sign_out_title), color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium, modifier = Modifier.align(Alignment.CenterHorizontally).padding(16.dp))
                    }
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)) }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReferralScreen(state: MoreUiState, back: () -> Unit, refresh: () -> Unit) {
    val context = LocalContext.current
    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.more_referrals)) }, navigationIcon = { IconButton(onClick = back) { Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.more_back_cd)) } }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.referral_heading), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            when {
                state.referralLoading -> CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                state.referralError != null -> { Text(state.referralError, color = MaterialTheme.colorScheme.error); Button(onClick = refresh) { Text(stringResource(R.string.action_retry)) } }
                state.referralStatus != null -> {
                    val status = state.referralStatus
                    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Text(status.code, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("https://mowgoapp.com?ref=${status.code}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = {
                                val clipboard = context.getSystemService(android.content.ClipboardManager::class.java)
                                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("MowGo referral code", status.code))
                                Toast.makeText(context, "Referral code copied", Toast.LENGTH_SHORT).show()
                            }) { Icon(Icons.Default.ContentCopy, contentDescription = null); Spacer(Modifier.width(8.dp)); Text("Copy") }
                            Button(onClick = {
                            val link = "https://mowgoapp.com?ref=${status.code}"
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, link) }, context.getString(R.string.referral_share_title)))
                            }) { Icon(Icons.Default.Share, contentDescription = null); Spacer(Modifier.width(8.dp)); Text(stringResource(R.string.referral_share)) }
                        }
                        Text("You've referred ${status.totalCount} people. ${status.earnedCount} have signed up.")
                        Text("Reward balance: ${status.earnedCount} free month${if (status.earnedCount == 1) "" else "s"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } }
                }
            }
        }
    }
}

@Composable
private fun ProfileCard(profile: Profile?) = Card(Modifier.fillMaxWidth()) {
    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.AccountCircle, null, Modifier.size(52.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(8.dp))
        Text(profile?.businessName?.takeIf { it.isNotBlank() } ?: stringResource(R.string.more_default_business_name), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(tierLabel(profile?.tier), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SyncStatusCard(isOffline: Boolean, pendingSyncCount: Int) {
    val subtitle = when {
        isOffline && pendingSyncCount > 0 -> stringResource(R.string.more_sync_offline_pending, pendingSyncCount)
        isOffline -> stringResource(R.string.more_sync_offline)
        else -> stringResource(R.string.more_sync_syncing, pendingSyncCount)
    }
    Card(Modifier.fillMaxWidth()) {
        ListItem(
            headlineContent = { Text(stringResource(R.string.more_sync_status_title)) },
            supportingContent = { Text(subtitle) },
            leadingContent = {
                Icon(
                    if (isOffline) Icons.Default.CloudOff else Icons.Default.Sync,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                )
            },
        )
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
    Scaffold(topBar = { TopAppBar(title = { Text(title) }, navigationIcon = { IconButton(onClick = back) { Icon(Icons.Default.ArrowBack, stringResource(R.string.more_back_cd)) } }) }) { padding ->
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
    DetailScaffold(stringResource(R.string.more_business_profile), back) {
        OutlinedTextField(name, { name = it }, label = { Text(stringResource(R.string.more_business_name_label)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(phone, { phone = it }, label = { Text(stringResource(R.string.label_phone)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(email, { email = it }, label = { Text(stringResource(R.string.label_email)) }, singleLine = true, enabled = false, modifier = Modifier.fillMaxWidth())
        HorizontalDivider()
        Text(stringResource(R.string.more_payment_methods_header), style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(zelle, { zelle = it }, label = { Text(stringResource(R.string.more_zelle_label)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(venmo, { venmo = it }, label = { Text(stringResource(R.string.more_venmo_label)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(cashapp, { cashapp = it }, label = { Text(stringResource(R.string.more_cashapp_label)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Text(stringResource(R.string.more_payment_note), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = { if (name.isNotBlank()) save(name.trim(), phone.trim(), email.trim(), venmo.trim(), cashapp.trim(), zelle.trim()) }, enabled = name.isNotBlank() && !state.isSaving, modifier = Modifier.fillMaxWidth()) {
            if (state.isSaving) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(stringResource(R.string.more_save_changes))
        }
    }
}

@Composable
private fun NotificationSettingsScreen(
    completion: Boolean,
    localRain: Boolean,
    profileRain: Boolean,
    leadAlerts: Boolean,
    tier: String?,
    back: () -> Unit,
    setCompletion: (Boolean) -> Unit,
    setLocalRain: (Boolean) -> Unit,
    setProfileRain: (Boolean) -> Unit,
    setLeadAlerts: (Boolean) -> Unit,
) {
    DetailScaffold(stringResource(R.string.more_notifications), back) {
        Card { SettingsSwitchRow(stringResource(R.string.more_notif_completion_title), stringResource(R.string.more_notif_completion_subtitle), completion, setCompletion) }
        Card {
            SettingsSwitchRow(
                stringResource(R.string.more_notif_rain_title),
                stringResource(R.string.more_notif_rain_subtitle),
                localRain && profileRain,
            ) { enabled ->
                setLocalRain(enabled)
                setProfileRain(enabled)
            }
        }
        if (tier?.lowercase() in setOf("solo", "crew", "premium")) {
            Card { SettingsSwitchRow("Lead alerts", "When a new lead comes in", leadAlerts, setLeadAlerts) }
        }
    }
}

@Composable
private fun SettingsSwitchRow(title: String, subtitle: String, checked: Boolean, changed: (Boolean) -> Unit) = ListItem(
    headlineContent = { Text(title) }, supportingContent = { Text(subtitle) }, trailingContent = { Switch(checked, changed) },
)

@Composable
private fun AppearanceSettingsScreen(mode: String, back: () -> Unit, select: (String) -> Unit) {
    DetailScaffold(stringResource(R.string.more_appearance), back) {
        val systemLabel = stringResource(R.string.more_appearance_system)
        val lightLabel = stringResource(R.string.more_appearance_light)
        val darkLabel = stringResource(R.string.more_appearance_dark)
        val selectedCd = stringResource(R.string.more_selected_cd)
        Card { Column { listOf("system" to systemLabel, "light" to lightLabel, "dark" to darkLabel).forEachIndexed { index, option ->
            ListItem(
                headlineContent = { Text(option.second) },
                trailingContent = { if (mode == option.first) Icon(Icons.Default.Check, selectedCd, tint = MaterialTheme.colorScheme.primary) },
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
    grantTrial: (String) -> Unit,
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
        "solo" -> stringResource(R.string.more_plan_solo_features)
        "crew" -> stringResource(R.string.more_plan_crew_features)
        "premium" -> stringResource(R.string.more_plan_premium_feature1)
        else -> stringResource(R.string.more_plan_free_features)
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
            title = { Text(stringResource(R.string.more_cancel_subscription_title)) },
            text = { Text(stringResource(R.string.more_cancel_subscription_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCancelConfirmation = false
                        cancelSubscription()
                    },
                    enabled = state.billingLoadingAction == null,
                ) { Text(stringResource(R.string.more_cancel_subscription_title), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showCancelConfirmation = false }) { Text(stringResource(R.string.more_keep_plan)) }
            },
        )
    }

    DetailScaffold(stringResource(R.string.more_billing), back) {
        Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.more_current_plan), color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                when (tier) {
                    "solo" -> stringResource(R.string.more_plan_name_solo)
                    "crew" -> stringResource(R.string.more_plan_name_crew)
                    "premium" -> stringResource(R.string.more_plan_name_premium)
                    else -> stringResource(R.string.more_plan_name_free)
                },
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
            )
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
                        Text(stringResource(R.string.more_cancel_subscription_title))
                    }
                }
            }
        } }

        SectionLabel(stringResource(R.string.more_plans_section))
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            val monthLabel = stringResource(R.string.more_month)
            val annualLabel = stringResource(R.string.more_annual)
            listOf("year" to annualLabel, "month" to monthLabel).forEachIndexed { index, option ->
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
                stringResource(R.string.more_two_months_free),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
        }

        // Trial-first no-card flow: countdown or trial-ended banner in plans section.
        val profile = state.profile
        if (profile != null && profile.hasActiveTrial) {
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.12f),
                ),
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(
                        stringResource(
                            R.string.trial_active_banner,
                            profile.trialDaysLeft ?: 1,
                            profile.trialPlanLabel ?: "Plan",
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        stringResource(R.string.trial_active_subscribe),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else if (profile != null && profile.hasUsedTrial && tier == "free") {
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.12f),
                ),
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(
                        stringResource(R.string.trial_ended_title),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        stringResource(R.string.trial_ended_body),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        val hasUsedTrial = profile?.hasUsedTrial == true
        val trialJustGranted = state.trialJustGranted
        BillingPlanCard(
            name = stringResource(R.string.more_plan_free_name),
            features = listOf(stringResource(R.string.more_plan_free_features)),
            tier = "free",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
            hasUsedTrial = hasUsedTrial,
            trialJustGranted = trialJustGranted,
            grantTrial = grantTrial,
        )
        BillingPlanCard(
            name = stringResource(R.string.more_plan_solo_name),
            features = listOf(stringResource(R.string.more_plan_solo_features)),
            tier = "solo",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
            hasUsedTrial = hasUsedTrial,
            trialJustGranted = trialJustGranted,
            grantTrial = grantTrial,
        )
        BillingPlanCard(
            name = stringResource(R.string.more_plan_crew_name),
            features = listOf(stringResource(R.string.more_plan_crew_features)),
            tier = "crew",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
            hasUsedTrial = hasUsedTrial,
            trialJustGranted = trialJustGranted,
            grantTrial = grantTrial,
        )
        BillingPlanCard(
            name = stringResource(R.string.more_plan_premium_name),
            features = listOf(
                stringResource(R.string.more_plan_premium_feature1),
                stringResource(R.string.more_plan_premium_feature2),
                stringResource(R.string.more_plan_premium_feature3),
                stringResource(R.string.more_plan_premium_feature4),
            ),
            tier = "premium",
            currentTier = tier,
            billingInterval = billingInterval,
            loadingAction = state.billingLoadingAction,
            subscribe = startCheckout,
            hasUsedTrial = hasUsedTrial,
            trialJustGranted = trialJustGranted,
            grantTrial = grantTrial,
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
                        Text(stringResource(R.string.more_manage_billing), fontWeight = FontWeight.Medium)
                        Text(stringResource(R.string.more_manage_billing_subtitle), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    hasUsedTrial: Boolean = false,
    trialJustGranted: Boolean = false,
    grantTrial: (String) -> Unit = {},
) {
    val order = mapOf("free" to 0, "solo" to 1, "crew" to 2, "premium" to 3)
    val isCurrent = tier == currentTier
    val canUpgrade = (order[tier] ?: 0) > (order[currentTier] ?: 0)
    val isAnnual = billingInterval == "year"
    val priceRes = if (isAnnual) R.string.more_price_per_year else R.string.more_price_per_month
    val price = when (tier) {
        "solo" -> stringResource(priceRes, if (isAnnual) "$390" else "$39")
        "crew" -> stringResource(priceRes, if (isAnnual) "$790" else "$79")
        "premium" -> stringResource(priceRes, if (isAnnual) "$1,990" else "$199")
        else -> stringResource(R.string.more_price_per_month, "$0")
    }
    val savings = when {
        !isAnnual -> null
        tier == "solo" -> stringResource(R.string.more_savings_format, "$78")
        tier == "crew" -> stringResource(R.string.more_savings_format, "$158")
        tier == "premium" -> stringResource(R.string.more_savings_format, "$398")
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
                                stringResource(R.string.more_current_badge),
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            )
                        }
                        Text(
                            stringResource(R.string.more_billing_interval_note),
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
                // Trial-first no-card flow: a FREE user without an active trial
                // starts the 14-day trial (no card). Users in/after a trial go
                // straight to checkout (Stripe trial skipped — see edge function).
                val isTrialStart = currentTier == "free" && !hasUsedTrial && !trialJustGranted
                val action = if (isTrialStart) "trial:$tier" else "checkout:$tier"
                Button(
                    onClick = {
                        if (isTrialStart) grantTrial(tier) else subscribe(tier, billingInterval)
                    },
                    enabled = loadingAction == null,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (loadingAction == action) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text(
                            if (isTrialStart) stringResource(R.string.trial_start_button)
                            else if (currentTier == "free") stringResource(R.string.more_subscribe)
                            else stringResource(R.string.more_upgrade),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun tierLabel(tier: String?, billingInterval: String = "month"): String {
    val isAnnual = billingInterval == "year"
    val priceRes = if (isAnnual) R.string.more_price_per_year else R.string.more_price_per_month
    return when (tier) {
        "solo" -> stringResource(R.string.more_plan_solo_name) + " · " + stringResource(priceRes, if (isAnnual) "$390" else "$39")
        "crew" -> stringResource(R.string.more_plan_crew_name) + " · " + stringResource(priceRes, if (isAnnual) "$790" else "$79")
        "premium" -> stringResource(R.string.more_plan_premium_name) + " · " + stringResource(priceRes, if (isAnnual) "$1,990" else "$199")
        else -> stringResource(R.string.more_plan_name_free)
    }
}
