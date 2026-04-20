package dev.aap.sdk

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** A registered agent's identity on the AAP network. */
@Serializable
data class AgentIdentity(
    val did:          String,
    val aapAddress:   String,
    val publicKeyHex: String,
    val name:         String
)

/** An incoming AAP message. */
@Serializable
data class AAPMessage(
    val actionType: String,
    val fromDID:    String,
    val messageID:  String,
    val timestamp:  Long,
    val payload:    Map<String, JsonElement> = emptyMap()
)

/** Configuration for AAPAgent. */
data class AAPAgentConfig(
    val name:         String,
    val capabilities: List<String> = emptyList(),
    val registryUrl:  String       = "https://registry.aap.dev"
)

/** AAP SDK errors. */
sealed class AAPError(message: String) : Exception(message) {
    class NotRegistered              : AAPError("Agent not registered. Call register() first.")
    class RegistrationFailed(m: String)  : AAPError("Registration failed: $m")
    class AgentNotFound(address: String) : AAPError("Agent not found: $address")
    class HandshakeFailed(m: String)     : AAPError("Handshake failed: $m")
    class RelayFull                  : AAPError("Session relay is full (2 peers already connected)")
    class RelayTimeout               : AAPError("Relay handshake timed out")
    class SendFailed(m: String)          : AAPError("Send failed: $m")
    class Unauthorized               : AAPError("Unauthorized")
}
