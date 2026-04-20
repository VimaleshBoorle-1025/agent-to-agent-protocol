package dev.aap.sdk

import dev.aap.sdk.crypto.*
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class AAPAgentTest {

    @Test
    fun `key generation produces 64-char hex strings`() {
        val (priv, pub) = generateEd25519KeyPair()
        assertEquals(64, priv.length, "Ed25519 private key: 32 bytes = 64 hex chars")
        assertEquals(64, pub.length,  "Ed25519 public key: 32 bytes = 64 hex chars")
        assertNotEquals(priv, pub)
    }

    @Test
    fun `sign and verify round-trip`() {
        val (priv, pub) = generateEd25519KeyPair()
        val data        = "hello aap android".toByteArray()
        val sig         = ed25519Sign(data, priv)
        assertTrue(ed25519Verify(data, sig, pub))
    }

    @Test
    fun `verify rejects wrong data`() {
        val (priv, pub) = generateEd25519KeyPair()
        val data        = "original".toByteArray()
        val sig         = ed25519Sign(data, priv)
        assertFalse(ed25519Verify("tampered".toByteArray(), sig, pub))
    }

    @Test
    fun `verify rejects wrong key`() {
        val (priv, _)    = generateEd25519KeyPair()
        val (_, wrongPub) = generateEd25519KeyPair()
        val data = "data".toByteArray()
        val sig  = ed25519Sign(data, priv)
        assertFalse(ed25519Verify(data, sig, wrongPub))
    }

    @Test
    fun `envelope building produces valid outer envelope`() {
        val (priv, _) = generateEd25519KeyPair()
        val envelope  = buildEnvelope(
            actionType    = "PING",
            fromDID       = "did:aap:alice.android",
            toDID         = "did:aap:bob.android",
            privateKeyHex = priv
        )
        assertEquals("aap/1.0", envelope.version)
        assertEquals("did:aap:alice.android", envelope.from_did)
        assertEquals("did:aap:bob.android",   envelope.to_did)
        assertTrue(envelope.message_id.isNotEmpty())
        assertTrue(envelope.signature.isNotEmpty())
        assertEquals(128, envelope.signature.length) // Ed25519 sig = 64 bytes = 128 hex
    }

    @Test
    fun `nonce is unique and 64 chars`() {
        val n1 = generateNonce()
        val n2 = generateNonce()
        assertEquals(64, n1.length)
        assertNotEquals(n1, n2)
    }

    @Test
    fun `hex roundtrip`() {
        val bytes     = byteArrayOf(0x00, 0xAB.toByte(), 0xFF.toByte(), 0x42)
        val hexStr    = bytes.toHex()
        val recovered = hexStr.fromHex()
        assertContentEquals(bytes, recovered)
    }
}
