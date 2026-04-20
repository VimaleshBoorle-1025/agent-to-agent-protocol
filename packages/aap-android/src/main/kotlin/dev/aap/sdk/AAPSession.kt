package dev.aap.sdk

import dev.aap.sdk.crypto.*
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*

/**
 * A live encrypted session between two AAP agents.
 * Created by [AAPAgent.connectViaRelay] — do not construct directly.
 */
class AAPSession internal constructor(
    private val localIdentity: AgentIdentity,
    private val privateKeyHex: String,
    private val remoteAddress: String,
    private val relay:         AAPRelay?    = null
) {
    private var sessionKey: String?  = null
    private var _connected           = false
    private val messageHandlers      = mutableListOf<(AAPMessage) -> Unit>()

    private val json = Json { encodeDefaults = true }

    // ── Relay handshake ────────────────────────────────────────────────────────

    internal suspend fun handshakeViaRelay() {
        val r = relay ?: throw AAPError.HandshakeFailed("No relay attached")

        val nonce_a  = generateNonce()
        val initMsg  = buildJsonObject {
            put("type",      "HANDSHAKE_INIT")
            put("from_did",  localIdentity.did)
            put("nonce_a",   nonce_a)
            put("timestamp", System.currentTimeMillis())
        }
        r.send(initMsg.toString())

        withTimeout(15_000) {
            suspendCancellableCoroutine<Unit> { cont ->
                r.onReceive { data ->
                    val text = data.toString(Charsets.UTF_8)
                    try {
                        val obj  = Json.parseToJsonElement(text).jsonObject
                        val type = obj["type"]?.jsonPrimitive?.content
                        if (type == "HANDSHAKE_RESPONSE") {
                            val nonce_b = obj["nonce_b"]?.jsonPrimitive?.content ?: ""
                            sessionKey  = nonce_a + nonce_b   // simplified; real: HKDF
                            _connected  = true
                            // Re-register for data frames
                            r.onReceive { frame -> dispatchMessage(frame) }
                            cont.resume(Unit) {}
                        } else if (type == "HANDSHAKE_INIT") {
                            // We are the guest
                            val peerNonce = obj["nonce_a"]?.jsonPrimitive?.content ?: ""
                            val nonce_b   = generateNonce()
                            sessionKey    = peerNonce + nonce_b
                            _connected    = true
                            val response  = buildJsonObject {
                                put("type",    "HANDSHAKE_RESPONSE")
                                put("nonce_b", nonce_b)
                            }
                            r.send(response.toString())
                            r.onReceive { frame -> dispatchMessage(frame) }
                            cont.resume(Unit) {}
                        }
                    } catch (_: Exception) { /* ignore non-JSON */ }
                }
            }
        }
    }

    // ── Send ───────────────────────────────────────────────────────────────────

    /**
     * Send a typed action to the connected peer.
     * The payload is wrapped in a three-layer AAP envelope before sending.
     */
    suspend fun send(
        actionType: String,
        payload:    Map<String, JsonElement> = emptyMap()
    ) {
        if (!_connected) throw AAPError.HandshakeFailed("Not connected")

        val envelope = buildEnvelope(
            actionType    = actionType,
            payload       = payload,
            fromDID       = localIdentity.did,
            toDID         = remoteAddress,
            privateKeyHex = privateKeyHex
        )
        val frame = json.encodeToString(envelope)

        relay?.send(frame)
            ?: throw AAPError.SendFailed("Direct delivery not yet implemented — use relay")
    }

    // ── Receive ────────────────────────────────────────────────────────────────

    fun onMessage(handler: (AAPMessage) -> Unit) {
        messageHandlers += handler
    }

    private fun dispatchMessage(data: ByteArray) {
        try {
            val outer = Json.decodeFromString<dev.aap.sdk.crypto.OuterEnvelope>(
                data.toString(Charsets.UTF_8)
            )
            val middle = Json.decodeFromString<dev.aap.sdk.crypto.MiddleEnvelope>(outer.middle_payload)
            val inner  = Json.decodeFromString<dev.aap.sdk.crypto.InnerEnvelope>(middle.inner_payload)
            val msg    = AAPMessage(
                actionType = inner.action_type,
                fromDID    = outer.from_did,
                messageID  = outer.message_id,
                timestamp  = inner.timestamp,
                payload    = inner.payload
            )
            messageHandlers.forEach { it(msg) }
        } catch (_: Exception) { /* malformed frame — ignore */ }
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    fun disconnect() {
        relay?.close()
        _connected = false
        sessionKey = null
    }

    val isConnected: Boolean get() = _connected
}
