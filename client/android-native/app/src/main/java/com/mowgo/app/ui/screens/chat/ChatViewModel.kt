package com.mowgo.app.ui.screens.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mowgo.app.data.ChatMessageDto
import com.mowgo.app.data.ChatRepository
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
)

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val lastUserText: String? = null,
)

class ChatViewModel(
    private val repository: ChatRepository = ChatRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()
    private var currentSendJob: Job? = null
    private var sendGeneration = 0

    fun send(text: String) {
        val trimmedText = text.trim()
        if (trimmedText.isEmpty() || _uiState.value.isLoading) return

        currentSendJob?.cancel()
        val generation = ++sendGeneration
        val userMessage = ChatMessage(role = ROLE_USER, content = trimmedText)
        _uiState.update { state ->
            state.copy(
                messages = (state.messages + userMessage).takeLast(MAX_MESSAGES),
                isLoading = true,
                error = null,
                lastUserText = trimmedText,
            )
        }
        val history = listOf(ChatMessageDto("system", ChatRepository.SYSTEM_PROMPT)) +
            _uiState.value.messages.takeLast(20).map { ChatMessageDto(it.role, it.content) }

        currentSendJob = viewModelScope.launch {
            try {
                val reply = repository.send(history)
                if (generation == sendGeneration) appendAssistant(reply)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (generation == sendGeneration) {
                    _uiState.update { state ->
                        state.copy(
                            messages = (state.messages + ChatMessage(
                                role = ROLE_ASSISTANT,
                                content = CONNECTION_ERROR_MESSAGE,
                            )).takeLast(MAX_MESSAGES),
                            error = error.message ?: "Connection error",
                        )
                    }
                }
            } finally {
                if (generation == sendGeneration) {
                    _uiState.update { it.copy(isLoading = false) }
                    currentSendJob = null
                }
            }
        }
    }

    fun retry() {
        val state = _uiState.value
        val retryText = state.lastUserText ?: return
        if (state.isLoading || state.messages.lastOrNull()?.content != CONNECTION_ERROR_MESSAGE) return
        _uiState.update { current ->
            val withoutError = current.messages.dropLast(1)
            val withoutFailedAttempt = if (withoutError.lastOrNull()?.role == ROLE_USER) {
                withoutError.dropLast(1)
            } else {
                withoutError
            }
            current.copy(messages = withoutFailedAttempt, error = null)
        }
        send(retryText)
    }

    fun clearChat() {
        sendGeneration++
        currentSendJob?.cancel()
        currentSendJob = null
        _uiState.value = ChatUiState()
    }

    private fun appendAssistant(content: String) {
        _uiState.update { state ->
            state.copy(
                messages = (state.messages + ChatMessage(
                    role = ROLE_ASSISTANT,
                    content = content,
                )).takeLast(MAX_MESSAGES),
            )
        }
    }

    companion object {
        const val CONNECTION_ERROR_MESSAGE = "⚠️ Connection error. Please try again."
        private const val ROLE_USER = "user"
        private const val ROLE_ASSISTANT = "assistant"
        private const val MAX_MESSAGES = 100
    }
}
