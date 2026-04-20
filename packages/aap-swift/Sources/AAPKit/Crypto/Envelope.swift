import Foundation
import Crypto

// MARK: - Key generation

/// Generate an Ed25519 key pair. Returns (privateKeyHex, publicKeyHex).
public func generateEd25519KeyPair() -> (privateKeyHex: String, publicKeyHex: String) {
    let privateKey = Curve25519.Signing.PrivateKey()
    let pubHex  = privateKey.publicKey.rawRepresentation.hexString
    let privHex = privateKey.rawRepresentation.hexString
    return (privHex, pubHex)
}

/// Sign data with an Ed25519 private key. Returns hex-encoded signature.
public func ed25519Sign(_ data: Data, privateKeyHex: String) throws -> String {
    guard let privBytes = Data(hexString: privateKeyHex) else {
        throw AAPError.invalidPublicKey
    }
    let key = try Curve25519.Signing.PrivateKey(rawRepresentation: privBytes)
    let sig = try key.signature(for: data)
    return sig.hexString
}

/// Verify an Ed25519 signature. Returns true if valid.
public func ed25519Verify(_ data: Data, signatureHex: String, publicKeyHex: String) -> Bool {
    guard
        let pubBytes = Data(hexString: publicKeyHex),
        let sigBytes = Data(hexString: signatureHex),
        let pubKey   = try? Curve25519.Signing.PublicKey(rawRepresentation: pubBytes)
    else { return false }
    return pubKey.isValidSignature(sigBytes, for: data)
}

// MARK: - Nonce

public func generateNonce() -> String {
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, 32, &bytes)
    return Data(bytes).hexString
}

// MARK: - Envelope builders
// These must produce JSON with the same key ordering as the JS @aap/crypto package
// so that cross-platform sessions share the same envelope format.

public struct InnerEnvelope: Codable {
    public let message_id:  String
    public let action_type: String
    public let timestamp:   Int64
    public let payload:     [String: AAPValue]

    public init(actionType: String, payload: [String: AAPValue]) {
        self.message_id  = UUID().uuidString.lowercased()
        self.action_type = actionType
        self.timestamp   = Int64(Date().timeIntervalSince1970 * 1000)
        self.payload     = payload
    }
}

public struct MiddleEnvelope: Codable {
    public let version:       String
    public let action_type:   String
    public let from_did:      String
    public let inner_payload: String   // JSON string of InnerEnvelope
    public let signature:     String
    public let nonce:         String
}

public struct OuterEnvelope: Codable {
    public let version:        String
    public let message_id:     String
    public let from_did:       String
    public let to_did:         String
    public let middle_payload: String  // JSON string of MiddleEnvelope
    public let signature:      String
    public let timestamp:      Int64
    public let nonce:          String
}

/// Build a complete three-layer AAP envelope ready to send.
public func buildEnvelope(
    actionType:        String,
    payload:           [String: AAPValue],
    fromDID:           String,
    toDID:             String,
    privateKeyHex:     String
) throws -> OuterEnvelope {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys  // matches JS JSON.stringify key ordering

    // Inner
    let inner     = InnerEnvelope(actionType: actionType, payload: payload)
    let innerJSON = String(data: try encoder.encode(inner), encoding: .utf8)!

    // Middle — sign the inner JSON
    let innerData  = innerJSON.data(using: .utf8)!
    let middleSig  = try ed25519Sign(innerData, privateKeyHex: privateKeyHex)
    let middle     = MiddleEnvelope(
        version:       "aap/1.0",
        action_type:   actionType,
        from_did:      fromDID,
        inner_payload: innerJSON,
        signature:     middleSig,
        nonce:         generateNonce()
    )
    let middleJSON = String(data: try encoder.encode(middle), encoding: .utf8)!

    // Outer — sign the middle JSON
    let middleData = middleJSON.data(using: .utf8)!
    let outerSig   = try ed25519Sign(middleData, privateKeyHex: privateKeyHex)
    let outer      = OuterEnvelope(
        version:        "aap/1.0",
        message_id:     inner.message_id,
        from_did:       fromDID,
        to_did:         toDID,
        middle_payload: middleJSON,
        signature:      outerSig,
        timestamp:      inner.timestamp,
        nonce:          generateNonce()
    )
    return outer
}

// MARK: - Data hex helpers

extension Data {
    var hexString: String {
        map { String(format: "%02x", $0) }.joined()
    }

    init?(hexString: String) {
        let hex = hexString
        guard hex.count % 2 == 0 else { return nil }
        var data = Data(capacity: hex.count / 2)
        var idx  = hex.startIndex
        while idx < hex.endIndex {
            let next = hex.index(idx, offsetBy: 2)
            guard let byte = UInt8(hex[idx..<next], radix: 16) else { return nil }
            data.append(byte)
            idx = next
        }
        self = data
    }
}
