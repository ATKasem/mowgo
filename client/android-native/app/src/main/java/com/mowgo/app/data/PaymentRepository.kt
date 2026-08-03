package com.mowgo.app.data

import com.mowgo.app.BuildConfig
import com.mowgo.app.data.auth.AuthRepository
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

data class PaymentIntentResult(
    val clientSecret: String,
    val paymentIntentId: String,
)

class PaymentRepository(
    private val authRepository: AuthRepository = AuthRepository(),
    private val httpClient: OkHttpClient = OkHttpClient(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun createPaymentIntent(amountCents: Int, invoiceId: String): PaymentIntentResult {
        ensureConfigured()
        val response = post(
            function = "create-payment-intent",
            body = json.encodeToString(
                CreatePaymentIntentRequest.serializer(),
                CreatePaymentIntentRequest(amountCents, invoiceId = invoiceId),
            ),
        )
        val result = decode<CreatePaymentIntentResponse>(response)
        if (result.clientSecret.isBlank() || result.paymentIntentId.isBlank()) {
            throw IllegalStateException(errorFrom(response) ?: "Could not initialize payment.")
        }
        return PaymentIntentResult(result.clientSecret, result.paymentIntentId)
    }

    suspend fun confirmPayment(invoiceId: String, paymentIntentId: String) {
        ensureConfigured()
        val response = post(
            function = "confirm-payment",
            body = json.encodeToString(
                ConfirmPaymentRequest.serializer(),
                ConfirmPaymentRequest(invoiceId, paymentIntentId),
            ),
        )
        if (!decode<SuccessResponse>(response).success) {
            throw IllegalStateException(errorFrom(response) ?: "Could not confirm payment.")
        }
    }

    suspend fun createCheckoutSession(tier: String): String {
        ensureConfigured()
        val response = post(
            function = "create-checkout-session",
            body = json.encodeToString(CheckoutRequest.serializer(), CheckoutRequest(tier)),
        )
        val url = decode<UrlResponse>(response).url
        return validateStripeUrl(url, CHECKOUT_HOST)
    }

    suspend fun createCustomerPortal(): String {
        ensureConfigured()
        val response = post("create-customer-portal", EMPTY_JSON)
        val url = decode<UrlResponse>(response).url
        return validateStripeUrl(url, PORTAL_HOST)
    }

    suspend fun cancelSubscription() {
        ensureConfigured()
        val response = post("cancel-subscription", EMPTY_JSON)
        if (!decode<SuccessResponse>(response).success) {
            throw IllegalStateException(errorFrom(response) ?: "Could not cancel subscription.")
        }
    }

    private fun ensureConfigured() {
        if (!SupabaseClientProvider.isConfigured) {
            throw IllegalStateException("Stripe is not configured.")
        }
    }

    private suspend fun post(function: String, body: String): String {
        val token = authRepository.currentSession?.accessToken
            ?: throw IllegalStateException("Not authenticated")
        val request = Request.Builder()
            .url("$FUNCTION_BASE_URL$function")
            .header("Authorization", "Bearer $token")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .post(RequestBody.create(JSON_MEDIA_TYPE, body))
            .build()

        return withContext(Dispatchers.IO) {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val serverError = runCatching {
                        json.decodeFromString(ErrorResponse.serializer(), responseBody).error
                    }.getOrNull()
                    throw IllegalStateException(
                        serverError?.takeIf { it.isNotBlank() } ?: "Server error (${response.code})",
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

    private fun validateStripeUrl(url: String, allowedHost: String): String {
        val uri = runCatching { URI(url) }
            .getOrElse { throw IllegalStateException("Invalid payment URL.") }
        if (uri.scheme != "https" || uri.host != allowedHost) {
            throw IllegalStateException("Invalid payment URL.")
        }
        return url
    }

    @Serializable
    private data class CreatePaymentIntentRequest(
        val amount: Int,
        val currency: String = "usd",
        @SerialName("invoice_id") val invoiceId: String,
    )

    @Serializable
    private data class CreatePaymentIntentResponse(
        @SerialName("client_secret") val clientSecret: String = "",
        @SerialName("payment_intent_id") val paymentIntentId: String = "",
    )

    @Serializable
    private data class ConfirmPaymentRequest(
        @SerialName("invoice_id") val invoiceId: String,
        @SerialName("payment_intent_id") val paymentIntentId: String,
    )

    @Serializable private data class CheckoutRequest(val tier: String)
    @Serializable private data class UrlResponse(val url: String = "")
    @Serializable private data class SuccessResponse(val success: Boolean = false)
    @Serializable private data class ErrorResponse(val error: String? = null)

    companion object {
        private const val FUNCTION_BASE_URL =
            "https://vqgiynfrpsqddjrayczc.supabase.co/functions/v1/"
        private const val CHECKOUT_HOST = "checkout.stripe.com"
        private const val PORTAL_HOST = "billing.stripe.com"
        private const val EMPTY_JSON = "{}"
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }
}
