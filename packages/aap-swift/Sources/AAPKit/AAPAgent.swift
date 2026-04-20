import Foundation
import Crypto

/// Main entry point for the AAP Swift SDK.
///
/// ```swift
/// import AAPKit
///
/// let agent = AAPAgent(config: AAPAgentConfig(name: "alice.ios"))
/// let identity = try await agent.register()
///
/// // Real-time relay session (iOS ↔ CLI ↔ Android ↔ web)
/// let session = try await agent.connectViaRelay(
///     handle: "alice.ios",
///     mailboxURL: URL(string: "wss://mailbox.aap.dev")!
/// )
/// try await session.send(actionType: "REQUEST_DATA", payload: ["query": .string("hello")])
/// ```
@MainActor
public final class AAPAgent: @unchecked Sendable {

    // MARK: - State

    private let config:      AAPAgentConfig
    private var identity:    AgentIdentity?
    private var privateKey:  String?   // hex-encoded Ed25519 private key

    // MARK: - Init

    public init(config: AAPAgentConfig) {
        self.config = config
    }

    /// Convenience initialiser — just pass the agent name.
    public convenience init(name: String, capabilities: [String] = []) {
        self.init(config: AAPAgentConfig(name: name, capabilities: capabilities))
    }

    // MARK: - Register

    /// Generate keys and register this agent with the AAP Registry.
    @discardableResult
    public func register() async throws -> AgentIdentity {
        let (privHex, pubHex) = generateEd25519KeyPair()
        self.privateKey = privHex

        let aapAddress = "aap://\(config.name)"
        let timestamp  = Int64(Date().timeIntervalSince1970 * 1000)
        let nonce      = generateNonce()

        // Build body for signing (keys must match JS SDK ordering)
        let bodyDict: [String: Any] = [
            "aap_address":    aapAddress,
            "public_key_hex": pubHex,
            "endpoint_url":   "https://agent.\(config.name.replacingOccurrences(of: ".", with: "-")).local",
            "capabilities":   config.capabilities,
            "owner_type":     "human",
            "timestamp":      timestamp,
            "nonce":          nonce,
        ]

        // Sort keys so signature matches what the registry expects
        let sortedBody  = bodyDict.sorted { $0.key < $1.key }
        let bodyForSign = Dictionary(uniqueKeysWithValues: sortedBody)
        let bodyData    = try JSONSerialization.data(
            withJSONObject: bodyForSign,
            options: [.sortedKeys]
        )
        let signature   = try ed25519Sign(bodyData, privateKeyHex: privHex)

        // POST to registry
        var bodyWithSig = bodyForSign
        bodyWithSig["signature"] = signature

        var request        = URLRequest(url: config.registryURL.appendingPathComponent("v1/register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody   = try JSONSerialization.data(withJSONObject: bodyWithSig, options: .sortedKeys)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 201 else {
            let msg = String(data: data, encoding: .utf8) ?? "unknown"
            throw AAPError.registrationFailed(msg)
        }

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let id   = AgentIdentity(
            did:          json["did"]         as? String ?? "did:aap:\(config.name)",
            aapAddress:   json["aap_address"] as? String ?? aapAddress,
            publicKeyHex: pubHex,
            name:         config.name
        )
        self.identity = id
        print("✅ [AAPKit] Registered: \(aapAddress)  DID: \(id.did)")
        return id
    }

    // MARK: - Connect via relay

    /// Connect to another agent (or wait for a peer) via the real-time relay.
    ///
    /// Both sides call `connectViaRelay` with the same `handle`.
    /// The first caller becomes the host (SESSION_WAITING), the second becomes
    /// the guest (SESSION_READY broadcasts to both). Works across iOS, Android,
    /// web, CLI — any platform that supports the relay protocol.
    public func connectViaRelay(
        handle:     String,
        mailboxURL: URL
    ) async throws -> AAPSession {
        guard let identity, let privateKey else { throw AAPError.notRegistered }

        let relay = AAPRelay(handle: handle, mailboxURL: mailboxURL)
        try await relay.connect(did: identity.did)

        let session = AAPSession(
            localIdentity: identity,
            privateKeyHex: privateKey,
            remoteAddress: handle,
            registryURL:   config.registryURL,
            relay:         relay
        )
        try await session.handshakeViaRelay()
        return session
    }

    // MARK: - Lookup

    /// Look up any agent by aap:// address.
    public static func lookup(
        address:     String,
        registryURL: URL = URL(string: "https://registry.aap.dev")!
    ) async throws -> [String: Any] {
        let encoded  = address.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? address
        let url      = registryURL.appendingPathComponent("v1/lookup/\(encoded)")
        let (data, _) = try await URLSession.shared.data(from: url)
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    public var currentIdentity: AgentIdentity? { identity }
}
