package com.mowgo.app.data

import com.mowgo.app.data.auth.AuthRepository
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import java.net.URI

/** Which card flows are live (false until a payment provider is implemented). */
data class PaymentsConfig(val subscriptions: Boolean, val invoicePayments: Boolean)

/** No payment provider is live yet (server answered `payments_unavailable`). */
class PaymentsComingSoonException : IllegalStateException("Card payments are coming soon.")

/**
 * Card payments through MowGo's payment provider. The server picks the
 * provider (functions/api/payments/*); the app only opens the provider's
 * hosted pages, so no card data touches the app and no payment SDK is
 * bundled.
 */
class PaymentRepository(
    private val authRepository: AuthRepository = AuthRepository(),
    private val httpClient: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Hosted page where the business's customer pays this invoice. The same
     * link can be shared with the customer. The invoice is marked paid by the
     * provider's webhook, never by the app.
     */
    suspend fun invoicePaymentLink(invoiceId: String): String {
        val response = post(
            "invoice-link",
            json.encodeToString(InvoiceLinkRequest.serializer(), InvoiceLinkRequest(invoiceId)),
        )
        return httpsUrl(decode<UrlResponse>(response).url)
    }

    suspend fun createCheckoutSession(tier: String, interval: String = "month"): String {
        val response = post(
            "subscription-checkout",
            json.encodeToString(CheckoutRequest.serializer(), CheckoutRequest(tier, interval)),
        )
        return httpsUrl(decode<UrlResponse>(response).url)
    }

    suspend fun createCustomerPortal(): String {
        val response = post("billing-portal", PLATFORM_JSON)
        return httpsUrl(decode<UrlResponse>(response).url)
    }

    /** Public: whether card payments are live. Any failure reads as "not available". */
    suspend fun paymentsConfig(): PaymentsConfig = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url("${PAYMENTS_BASE_URL}config").get().build()
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@use PaymentsConfig(false, false)
                val body = json.decodeFromString(ConfigResponse.serializer(), response.body?.string().orEmpty())
                PaymentsConfig(body.subscriptions, body.invoicePayments)
            }
        }.getOrDefault(PaymentsConfig(false, false))
    }

    /**
     * Hosted page where the business applies for / finishes its own merchant
     * account, so invoice card payments settle to the business.
     */
    suspend fun merchantOnboardingUrl(): String {
        val response = post("merchant-onboarding", PLATFORM_JSON)
        return httpsUrl(decode<UrlResponse>(response).url)
    }

    /**
     * "none", "pending", "active", "restricted" or "disabled". Read straight
     * from merchant_accounts (RLS: own row only); the provider webhook keeps it
     * current.
     */
    suspend fun merchantStatus(): String {
        val userId = SupabaseClientProvider.auth.currentSessionOrNull()?.user?.id ?: return "none"
        val rows = SupabaseClientProvider.client.from("merchant_accounts").select {
            filter { eq("user_id", userId) }
        }.decodeList<MerchantRow>()
        return rows.firstOrNull()?.status ?: "none"
    }

    suspend fun cancelSubscription() {
        val response = post("cancel-subscription", PLATFORM_JSON)
        if (!decode<SuccessResponse>(response).success) {
            throw IllegalStateException(errorFrom(response) ?: "Could not cancel subscription.")
        }
    }

    private suspend fun post(path: String, body: String): String {
        val token = authRepository.currentSession?.accessToken
            ?: throw IllegalStateException("Not authenticated")
        val request = Request.Builder()
            .url("$PAYMENTS_BASE_URL$path")
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
            .post(RequestBody.create(JSON_MEDIA_TYPE, body))
            .build()

        return withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val error = runCatching {
                        json.decodeFromString(ErrorResponse.serializer(), responseBody)
                    }.getOrNull()
                    if (error?.code == "payments_unavailable") throw PaymentsComingSoonException()
                    if (response.code in 500..599) {
                        throw IllegalStateException("Payment service is temporarily unavailable. Please try again in a moment.")
                    }
                    throw IllegalStateException(
                        error?.error?.takeIf { it.isNotBlank() } ?: "Server error (${response.code})",
                    )
                }
                responseBody
            }
        }
    }

    private inline fun <reified T> decode(body: String): T = runCatching {
        json.decodeFromString<T>(body)
    }.getOrElse { throw IllegalStateException("Invalid response from payment service.") }

    private fun errorFrom(body: String): String? = runCatching {
        json.decodeFromString(ErrorResponse.serializer(), body).error
    }.getOrNull()?.takeIf { it.isNotBlank() }

    /** The server already checked the host belongs to the provider; still require https. */
    private fun httpsUrl(url: String): String {
        val uri = runCatching { URI(url) }
            .getOrElse { throw IllegalStateException("Invalid payment URL.") }
        if (uri.scheme != "https" || uri.host.isNullOrBlank()) {
            throw IllegalStateException("Invalid payment URL.")
        }
        return url
    }

    @Serializable private data class InvoiceLinkRequest(@SerialName("invoice_id") val invoiceId: String)

    @Serializable
    private data class CheckoutRequest(
        val plan: String,
        val interval: String = "month",
        val platform: String = "android",
    )

    @Serializable private data class UrlResponse(val url: String = "")
    @Serializable private data class ConfigResponse(val subscriptions: Boolean = false, val invoicePayments: Boolean = false)
    @Serializable private data class MerchantRow(val status: String = "none")
    @Serializable private data class SuccessResponse(val success: Boolean = false)
    @Serializable private data class ErrorResponse(val error: String? = null, val code: String? = null)

    companion object {
        private const val PAYMENTS_BASE_URL = "https://mowgoapp.com/api/payments/"
        private const val PLATFORM_JSON = """{"platform":"android"}"""
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }
}
