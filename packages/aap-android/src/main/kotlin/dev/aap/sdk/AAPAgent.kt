package dev.aap.sdk

import dev.aap.sdk.crypto.*
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Main entry point for the AAP Android / JVM SDK.
 *
 * ```kotlin
 * val agent = AAPAgent(AAPAgentConfig(name = "alice.android"))
 *
 * // Register on the network
 * val identity = agent.register()
 *
 * // Real-time relay session — works across Android, iOS, CLI, web
 * val session = agent.connectViaRelay(
 *     handle     = "alice.android",
 *     mailboxUrl = "wss://mailbox.aap.dev"
 * )
 * session.send("REQUEST_DATA", mapOf("query" to JsonPrimitive("hello")))
 * ```
 */
class AAPAgent(private val config: AAPAgentConfig) {

    private var identity:     AgentIdentity? = null
    private var privateKeyHex: String?       = null

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30,    TimeUnit.SECONDS)
        .build()

    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    private val JSON_MEDIA = "application/json".toMediaType()

    // ── Register ───────────────────────────────────────────────────────────────

    /** Generate keys and register this agent with the AAP Registry. */
    suspend fun register(): AgentIdentity = withContext(Dispatchers.IO) {
        val (priv, pub) = generateEd25519KeyPair()
        privateKeyHex   = priv

        val aapAddress = "aap://${config.name}"
        val timestamp  = System.currentTimeMillis()
        val nonce      = generateNonce()

        val bodyObj = buildJsonObject {
            put("aap_address",    aapAddress)
            put("public_key_hex", pub)
            put("endpoint_url",   "https://agent.${config.name.replace(".", "-")}.local")
            put("capabilities",   buildJsonArray { config.capabilities.forEach { add(it) } })
            put("owner_type",     "human")
            put("timestamp",      timestamp)
            put("nonce",          nonce)
        }

        val bodyData = bodyObj.toString().toByteArray()
        val sig      = ed25519Sign(bodyData, priv)

        val withSig  = buildJsonObject {
            bodyObj.forEach { k, v -> put(k, v) }
            put("signature", sig)
        }

        val request = Request.Builder()
            .url("${config.registryUrl}/v1/register")
            .post(withSig.toString().toRequestBody(JSON_MEDIA))
            .build()

        val response = http.newCall(request).execute()
        val body     = response.body?.string() ?: ""

        if (!response.isSuccessful) {
            throw AAPError.RegistrationFailed(body)
        }

        val parsed   = Json.parseToJsonElement(body).jsonObject
        val id       = AgentIdentity(
            did          = parsed["did"]?.jsonPrimitive?.content ?: "did:aap:${config.name}",
            aapAddress   = parsed["aap_address"]?.jsonPrimitive?.content ?: aapAddress,
            publicKeyHex = pub,
            name         = config.name
        )
        identity = id
        println("✅ [AAPAndroid] Registered: $aapAddress  DID: ${id.did}")
        id
    }

    // ── Connect via relay ──────────────────────────────────────────────────────

    /**
     * Connect to another agent (or wait for a peer) via the real-time relay.
     *
     * Both sides call [connectViaRelay] with the same [handle].
     * Works across Android, iOS, web browser, Node.js CLI — any platform
     * that supports the AAP relay protocol.
     *
     * @param handle     aap:// address or bare handle to rendezvous on
     * @param mailboxUrl WebSocket URL of the AAP mailbox server
     */
    suspend fun connectViaRelay(handle: String, mailboxUrl: String): AAPSession {
        val id   = identity    ?: throw AAPError.NotRegistered()
        val priv = privateKeyHex ?: throw AAPError.NotRegistered()

        val relay = AAPRelay(handle = handle, mailboxUrl = mailboxUrl)
        relay.connect(did = id.did)

        val session = AAPSession(
            localIdentity = id,
            privateKeyHex = priv,
            remoteAddress = handle,
            relay         = relay
        )
        session.handshakeViaRelay()
        return session
    }

    // ── Lookup ─────────────────────────────────────────────────────────────────

    /** Look up any agent by aap:// address. */
    suspend fun lookup(address: String): JsonObject = withContext(Dispatchers.IO) {
        val encoded  = java.net.URLEncoder.encode(address, "UTF-8")
        val request  = Request.Builder()
            .url("${config.registryUrl}/v1/lookup/$encoded")
            .build()
        val response = http.newCall(request).execute()
        val body     = response.body?.string() ?: "{}"
        Json.parseToJsonElement(body).jsonObject
    }

    val currentIdentity: AgentIdentity? get() = identity
}
