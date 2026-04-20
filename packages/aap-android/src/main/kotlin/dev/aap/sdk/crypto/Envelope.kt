package dev.aap.sdk.crypto

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.security.SecureRandom
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

private val rng = SecureRandom()

// ── Key generation ─────────────────────────────────────────────────────────────

/**
 * Generate an Ed25519 key pair.
 * Returns Pair(privateKeyHex, publicKeyHex).
 */
fun generateEd25519KeyPair(): Pair<String, String> {
    val privKey = Ed25519PrivateKeyParameters(rng)
    val pubKey  = privKey.generatePublicKey()
    return privKey.encoded.toHex() to pubKey.encoded.toHex()
}

/** Sign [data] with an Ed25519 private key. Returns hex-encoded signature. */
fun ed25519Sign(data: ByteArray, privateKeyHex: String): String {
    val privBytes = privateKeyHex.fromHex()
    val privKey   = Ed25519PrivateKeyParameters(privBytes, 0)
    val signer    = Ed25519Signer()
    signer.init(true, privKey)
    signer.update(data, 0, data.size)
    return signer.generateSignature().toHex()
}

/** Verify an Ed25519 signature. Returns true if valid. */
fun ed25519Verify(data: ByteArray, signatureHex: String, publicKeyHex: String): Boolean {
    return try {
        val pubBytes = publicKeyHex.fromHex()
        val sigBytes = signatureHex.fromHex()
        val pubKey   = Ed25519PublicKeyParameters(pubBytes, 0)
        val verifier = Ed25519Signer()
        verifier.init(false, pubKey)
        verifier.update(data, 0, data.size)
        verifier.verifySignature(sigBytes)
    } catch (_: Exception) { false }
}

// ── Nonce ──────────────────────────────────────────────────────────────────────

fun generateNonce(): String {
    val bytes = ByteArray(32)
    rng.nextBytes(bytes)
    return bytes.toHex()
}

// ── Envelope types ─────────────────────────────────────────────────────────────

@Serializable
data class InnerEnvelope(
    val message_id:  String,
    val action_type: String,
    val timestamp:   Long,
    val payload:     Map<String, JsonElement> = emptyMap()
)

@Serializable
data class MiddleEnvelope(
    val version:       String,
    val action_type:   String,
    val from_did:      String,
    val inner_payload: String,   // JSON string of InnerEnvelope
    val signature:     String,
    val nonce:         String
)

@Serializable
data class OuterEnvelope(
    val version:        String,
    val message_id:     String,
    val from_did:       String,
    val to_did:         String,
    val middle_payload: String,  // JSON string of MiddleEnvelope
    val signature:      String,
    val timestamp:      Long,
    val nonce:          String
)

private val json = Json { encodeDefaults = true }

/**
 * Build a three-layer AAP envelope matching the JS @aap/crypto format.
 * The JSON key ordering uses kotlinx.serialization field order which
 * mirrors the JS SDK's key ordering — required for cross-platform
 * signature verification.
 */
fun buildEnvelope(
    actionType:    String,
    payload:       Map<String, JsonElement> = emptyMap(),
    fromDID:       String,
    toDID:         String,
    privateKeyHex: String
): OuterEnvelope {
    val msgId     = java.util.UUID.randomUUID().toString()
    val timestamp = System.currentTimeMillis()

    // Inner
    val inner     = InnerEnvelope(msgId, actionType, timestamp, payload)
    val innerJSON = json.encodeToString(inner)

    // Middle — sign inner JSON
    val middleSig = ed25519Sign(innerJSON.toByteArray(), privateKeyHex)
    val middle    = MiddleEnvelope("aap/1.0", actionType, fromDID, innerJSON, middleSig, generateNonce())
    val middleJSON = json.encodeToString(middle)

    // Outer — sign middle JSON
    val outerSig = ed25519Sign(middleJSON.toByteArray(), privateKeyHex)
    return OuterEnvelope("aap/1.0", msgId, fromDID, toDID, middleJSON, outerSig, timestamp, generateNonce())
}

// ── Hex helpers ────────────────────────────────────────────────────────────────

fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

fun String.fromHex(): ByteArray {
    require(length % 2 == 0) { "Hex string must have even length" }
    return ByteArray(length / 2) { i ->
        substring(i * 2, i * 2 + 2).toInt(16).toByte()
    }
}
