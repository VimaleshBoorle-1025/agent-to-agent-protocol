import XCTest
@testable import AAPKit

final class AAPAgentTests: XCTestCase {

    func testKeyGeneration() {
        let (priv, pub) = generateEd25519KeyPair()
        XCTAssertEqual(priv.count, 64, "Ed25519 private key should be 32 bytes = 64 hex chars")
        XCTAssertEqual(pub.count,  64, "Ed25519 public key should be 32 bytes = 64 hex chars")
        XCTAssertNotEqual(priv, pub)
    }

    func testSignAndVerify() throws {
        let (priv, pub) = generateEd25519KeyPair()
        let data        = "hello aap".data(using: .utf8)!
        let sig         = try ed25519Sign(data, privateKeyHex: priv)
        XCTAssertTrue(ed25519Verify(data, signatureHex: sig, publicKeyHex: pub))

        // Wrong data → invalid
        let wrongData = "wrong".data(using: .utf8)!
        XCTAssertFalse(ed25519Verify(wrongData, signatureHex: sig, publicKeyHex: pub))
    }

    func testEnvelopeBuilding() throws {
        let (priv, _) = generateEd25519KeyPair()
        let envelope  = try buildEnvelope(
            actionType:    "PING",
            payload:       ["msg": .string("hello")],
            fromDID:       "did:aap:alice.test",
            toDID:         "did:aap:bob.test",
            privateKeyHex: priv
        )
        XCTAssertEqual(envelope.version, "aap/1.0")
        XCTAssertEqual(envelope.from_did, "did:aap:alice.test")
        XCTAssertEqual(envelope.to_did,   "did:aap:bob.test")
        XCTAssertFalse(envelope.message_id.isEmpty)
        XCTAssertFalse(envelope.signature.isEmpty)
    }

    func testNonceUniqueness() {
        let n1 = generateNonce()
        let n2 = generateNonce()
        XCTAssertNotEqual(n1, n2)
        XCTAssertEqual(n1.count, 64)  // 32 bytes = 64 hex chars
    }

    func testHexDataRoundtrip() {
        let original  = Data([0x00, 0xAB, 0xFF, 0x42])
        let hexStr    = original.hexString
        let recovered = Data(hexString: hexStr)
        XCTAssertEqual(original, recovered)
    }
}
