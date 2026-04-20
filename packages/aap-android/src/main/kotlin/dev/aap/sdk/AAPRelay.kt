package dev.aap.sdk

import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import okhttp3.*
import java.util.concurrent.TimeUnit

/**
 * Real-time session relay over WebSocket.
 *
 * Mirrors the JS `RelayTransport` and Swift `AAPRelay` exactly.
 * The server forwards frames opaquely — end-to-end encryption is
 * maintained; the relay never sees plaintext.
 *
 * Usage:
 * ```kotlin
 * val relay = AAPRelay(handle = "alice.android", mailboxUrl = "wss://mailbox.aap.dev")
 * relay.connect(did = identity.did)
 * relay.onReceive { frame -> ... }
 * relay.send(frameBytes)
 * ```
 */
class AAPRelay(
    private val handle:     String,
    private val mailboxUrl: String
) {
    sealed class Event {
        data class Waiting(val handle: String) : Event()
        data class Ready(val handle: String)   : Event()
        data class Closed(val by: String)      : Event()
        data class Error(val message: String)  : Event()
    }

    private var ws:             WebSocket?  = null
    private var onMessageCb:    ((ByteArray) -> Unit)? = null
    private var onEventCb:      ((Event) -> Unit)?     = null
    private var connectDeferred = CompletableDeferred<Unit>()
    private var _isReady        = false

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0,  TimeUnit.MILLISECONDS)  // no timeout on WebSocket reads
        .build()

    /** Connect to the relay. Suspends until SESSION_WAITING or SESSION_READY. */
    suspend fun connect(did: String, signature: String? = null) {
        val wsUrl  = mailboxUrl
            .replace("https://", "wss://")
            .replace("http://",  "ws://")
            .trimEnd('/')
        val encoded = java.net.URLEncoder.encode(handle, "UTF-8")
        val url     = "$wsUrl/v1/session/$encoded/ws"
        val auth    = if (signature != null) "DID $did $signature" else "DID $did"

        val request = Request.Builder()
            .url(url)
            .header("Authorization", auth)
            .build()

        connectDeferred = CompletableDeferred()

        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleFrame(text.toByteArray())
            }

            override fun onMessage(webSocket: WebSocket, bytes: okio.ByteString) {
                handleFrame(bytes.toByteArray())
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connectDeferred.completeExceptionally(AAPError.HandshakeFailed(t.message ?: "WebSocket failure"))
                onEventCb?.invoke(Event.Error(t.message ?: "unknown"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isReady = false
                onEventCb?.invoke(Event.Closed(reason))
            }
        })

        withTimeout(15_000) { connectDeferred.await() }
    }

    private fun handleFrame(data: ByteArray) {
        val text = data.toString(Charsets.UTF_8)
        try {
            val obj  = Json.parseToJsonElement(text).jsonObject
            val type = obj["type"]?.jsonPrimitive?.content
            when (type) {
                "SESSION_WAITING" -> {
                    _isReady = true
                    connectDeferred.complete(Unit)
                    onEventCb?.invoke(Event.Waiting(handle))
                    return
                }
                "SESSION_READY" -> {
                    _isReady = true
                    connectDeferred.complete(Unit)
                    onEventCb?.invoke(Event.Ready(handle))
                    return
                }
                "SESSION_CLOSED" -> {
                    _isReady = false
                    onEventCb?.invoke(Event.Closed(obj["by"]?.jsonPrimitive?.content ?: ""))
                    return
                }
                "ERROR" -> {
                    val msg = obj["error"]?.jsonPrimitive?.content ?: "unknown"
                    connectDeferred.completeExceptionally(AAPError.HandshakeFailed(msg))
                    onEventCb?.invoke(Event.Error(msg))
                    return
                }
            }
        } catch (_: Exception) { /* not a control frame */ }
        onMessageCb?.invoke(data)
    }

    fun send(data: ByteArray) {
        ws?.send(okio.ByteString.of(*data))
    }

    fun send(text: String) {
        ws?.send(text)
    }

    fun onReceive(handler: (ByteArray) -> Unit)  { onMessageCb = handler }
    fun onEvent(handler:   (Event) -> Unit)       { onEventCb   = handler }

    fun close() {
        _isReady = false
        ws?.close(1000, "done")
    }

    val isReady: Boolean get() = _isReady
}
