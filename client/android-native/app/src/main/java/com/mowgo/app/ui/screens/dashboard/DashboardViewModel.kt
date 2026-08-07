package com.mowgo.app.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.InvoiceRepository
import com.mowgo.app.data.JobRepository
import com.mowgo.app.data.ProfileRepository
import com.mowgo.app.data.TeamRepository
import com.mowgo.app.data.model.Client
import com.mowgo.app.data.model.Invoice
import com.mowgo.app.data.model.Job
import com.mowgo.app.data.model.JobWithClient
import com.mowgo.app.data.model.Profile
import com.mowgo.app.data.model.UserProfile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Error(val message: String) : DashboardUiState
    data class Loaded(
        val today: String,
        val jobs: List<JobWithClient>,
        val clients: List<Client>,
        val invoices: List<Invoice>,
        val profile: Profile?,
        val teamMembers: List<UserProfile>,
        val todayJobs: List<JobWithClient>,
        val todayDoneCount: Int,
        val todayRevenue: Double,
        val outstanding: Double,
        val weeklyJobs: List<JobWithClient>,
        val weeklyDoneCount: Int,
        val weeklyRevenue: Double,
        val activeClients: Int,
        val recurringClients: Int,
        val isOwner: Boolean,
        val teamProgress: List<TeamProgressRow>,
        val isRefreshing: Boolean = false,
        val isInviting: Boolean = false,
        val inviteError: String? = null,
        val removeError: String? = null,
        val actionMessage: String? = null,
    ) : DashboardUiState
}

data class TeamProgressRow(
    val id: String,
    val label: String,
    val done: Int,
    val inProgress: Int,
    val total: Int,
    val isUnassigned: Boolean = false,
)

class DashboardViewModel : ViewModel() {
    private val jobRepository = JobRepository()
    private val invoiceRepository = InvoiceRepository()
    private val profileRepository = ProfileRepository()
    private val teamRepository = TeamRepository()

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()
    private var loadGeneration = 0

    init {
        loadData()
    }

    fun refresh() = loadData(isRefresh = true)

    fun retry() = loadData()

    fun inviteMember(email: String, onSuccess: () -> Unit = {}) {
        val loaded = _uiState.value as? DashboardUiState.Loaded ?: return
        if (loaded.isInviting) return
        _uiState.value = loaded.copy(isInviting = true, inviteError = null)
        viewModelScope.launch {
            try {
                teamRepository.inviteTeamMember(email)
                val members = teamRepository.loadTeamMembers()
                val current = _uiState.value as? DashboardUiState.Loaded
                if (current != null) {
                    _uiState.value = buildLoadedState(
                        jobs = current.jobs,
                        clients = current.clients,
                        invoices = current.invoices,
                        profile = current.profile,
                        teamMembers = members,
                        actionMessage = "Crew member invited",
                    )
                    onSuccess()
                }
            } catch (e: Exception) {
                val current = _uiState.value as? DashboardUiState.Loaded
                if (current != null) {
                    _uiState.value = current.copy(
                        isInviting = false,
                        inviteError = e.message ?: "Could not invite crew member",
                    )
                }
            }
        }
    }

    fun removeMember(member: UserProfile) {
        val loaded = _uiState.value as? DashboardUiState.Loaded ?: return
        _uiState.value = loaded.copy(removeError = null)
        viewModelScope.launch {
            try {
                teamRepository.removeTeamMember(member)
                loadData(isRefresh = true)
            } catch (e: Exception) {
                val current = _uiState.value as? DashboardUiState.Loaded
                if (current != null) {
                    _uiState.value = current.copy(
                        isRefreshing = false,
                        removeError = e.message ?: "Could not remove crew member",
                    )
                }
            }
        }
    }

    fun createJob(
        title: String,
        clientId: String,
        scheduledDate: String,
        scheduledTime: String?,
        notes: String?,
        routeOrder: Int?,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            try {
                jobRepository.createJob(
                    Job(
                        title = title,
                        clientId = clientId,
                        scheduledDate = scheduledDate,
                        scheduledTime = scheduledTime,
                        notes = notes,
                        routeOrder = routeOrder,
                        status = Job.STATUS_SCHEDULED,
                    )
                )
                onSuccess()
                loadData(isRefresh = true)
            } catch (e: Exception) {
                setActionError(e.message ?: "Could not create job")
            }
        }
    }

    fun createClient(
        name: String,
        address: String?,
        phone: String?,
        rate: Double,
        keyCode: String?,
        petInstructions: String?,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            try {
                invoiceRepository.createClient(
                    Client(
                        name = name,
                        address = address,
                        phone = phone,
                        rate = rate,
                        keyCode = keyCode,
                        petInstructions = petInstructions,
                    )
                )
                onSuccess()
                loadData(isRefresh = true)
            } catch (e: Exception) {
                setActionError(e.message ?: "Could not create client")
            }
        }
    }

    fun dismissInviteError() = updateLoaded { it.copy(inviteError = null) }
    fun dismissRemoveError() = updateLoaded { it.copy(removeError = null) }
    fun dismissActionMessage() = updateLoaded { it.copy(actionMessage = null) }

    private fun loadData(isRefresh: Boolean = false) {
        val generation = ++loadGeneration
        if (isRefresh) updateLoaded { it.copy(isRefreshing = true) }
        else _uiState.value = DashboardUiState.Loading

        viewModelScope.launch {
            try {
                val jobs = jobRepository.loadJobs()
                val clients = jobRepository.loadClients()
                val invoices = invoiceRepository.loadInvoices()
                val profile = profileRepository.loadProfile()
                val teamMembers = teamRepository.loadTeamMembers()
                if (generation == loadGeneration) {
                    _uiState.value = buildLoadedState(jobs, clients, invoices, profile, teamMembers)
                }
            } catch (e: Exception) {
                if (generation == loadGeneration) {
                    val current = _uiState.value as? DashboardUiState.Loaded
                    _uiState.value = if (current != null) {
                        current.copy(
                            isRefreshing = false,
                            actionMessage = e.message ?: "Failed to load dashboard",
                        )
                    } else {
                        DashboardUiState.Error(e.message ?: "Failed to load dashboard")
                    }
                }
            }
        }
    }

    private fun buildLoadedState(
        jobs: List<JobWithClient>,
        clients: List<Client>,
        invoices: List<Invoice>,
        profile: Profile?,
        teamMembers: List<UserProfile>,
        actionMessage: String? = null,
    ): DashboardUiState.Loaded {
        val todayDate = LocalDate.now()
        val today = todayDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val weekStart = localDate(-6)
        val monthStart = localDate(-29)
        val todayJobs = jobs.filter { it.scheduledDate == today }
        val todayDone = todayJobs.filter { it.status == Job.STATUS_DONE }
        val weeklyJobs = jobs.filter { it.scheduledDate >= weekStart && it.scheduledDate <= today }
        val weeklyDone = weeklyJobs.filter { it.status == Job.STATUS_DONE }

        val rows = teamMembers.mapNotNull { member ->
            val assignedJobs = todayJobs.filter { it.assignedTo == member.id }
            if (assignedJobs.isEmpty()) null else TeamProgressRow(
                id = member.id,
                label = member.businessName?.ifBlank { null } ?: "Crew",
                done = assignedJobs.count { it.status == Job.STATUS_DONE },
                inProgress = assignedJobs.count { it.status == Job.STATUS_IN_PROGRESS },
                total = assignedJobs.size,
            )
        }.toMutableList()
        val unassigned = todayJobs.filter { it.assignedTo == null }
        if (unassigned.isNotEmpty()) {
            rows += TeamProgressRow(
                id = "unassigned",
                label = "Unassigned",
                done = unassigned.count { it.status == Job.STATUS_DONE },
                inProgress = unassigned.count { it.status == Job.STATUS_IN_PROGRESS },
                total = unassigned.size,
                isUnassigned = true,
            )
        }

        return DashboardUiState.Loaded(
            today = today,
            jobs = jobs,
            clients = clients,
            invoices = invoices,
            profile = profile,
            teamMembers = teamMembers,
            todayJobs = todayJobs,
            todayDoneCount = todayDone.size,
            todayRevenue = todayDone.sumOf { it.clientRate },
            outstanding = invoices.filter { it.status == Invoice.STATUS_UNPAID }.sumOf { it.amount },
            weeklyJobs = weeklyJobs,
            weeklyDoneCount = weeklyDone.size,
            weeklyRevenue = weeklyDone.sumOf { it.clientRate },
            activeClients = jobs
                .filter { it.clientId.isNotEmpty() && it.scheduledDate >= monthStart && it.scheduledDate <= today }
                .map { it.clientId }
                .distinct()
                .size,
            recurringClients = jobs
                .filter {
                    it.clientId.isNotEmpty() && it.recurrenceRule != null &&
                        it.recurrenceRule != "none" && it.scheduledDate >= today
                }
                .map { it.clientId }
                .distinct()
                .size,
            isOwner = profile?.role == null || profile?.role == "owner",
            teamProgress = rows,
            actionMessage = actionMessage,
        )
    }

    private fun localDate(offsetDays: Long): String = LocalDate.now()
        .plusDays(offsetDays)
        .format(DateTimeFormatter.ISO_LOCAL_DATE)

    private fun setActionError(message: String) = updateLoaded { it.copy(actionMessage = message) }

    private fun updateLoaded(transform: (DashboardUiState.Loaded) -> DashboardUiState.Loaded) {
        val current = _uiState.value as? DashboardUiState.Loaded ?: return
        _uiState.value = transform(current)
    }
}
