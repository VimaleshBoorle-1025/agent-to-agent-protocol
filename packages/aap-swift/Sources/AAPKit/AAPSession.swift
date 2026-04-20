import Foundation

/// A live encrypted session between two AAP agents.
///
/// Created by `AAPAgent.connect()` or `AAPAgent.connectViaRelay()`.
/// Do not create directly — use `AAPAgent` as the entry point.
@MainActor
public final class AAPSession: @unchecked Sendable {

    // MARK: - Properties

    private let localIdentity:    AgentIdentity
    private let privateKeyHex:    String
    private let remoteAddress:    String
    private let registryURL:      URL
    private var relay:            AAPRelay?
    private var sessionKey:       String?
    private var remotePublicKey:  String?
    private var _connected        = false

    private var messageHandlers: [(AAPMessage) -> Void] = []

    // MARK: - Init (package-internal)

    init(
        localIdentity: AgentIdentity,
        privateKeyHex: String,
        remoteAddress: String,
        registryURL:   URL,
        relay:         AAPRelay? = nil
    ) {
        self.localIdentity = localIdentity
        self.privateKeyHex = privateKeyHex
        self.remoteAddress = remoteAddress
        self.registryURL   = registryURL
        self.relay         = relay
    }

    // MARK: - Relay handshake

    /// Perform key exchange over the relay. Call after `AAPAgent.connectViaRelay()`.
    func handshakeViaRelay() async throws {
        guard let relay else { throw AAPError.handshakeFailed("No relay attached") }

        let nonce_a = generateNonce()

        // Send HANDSHAKE_INIT and wait for response
        let initMsg: [String: Any] = [
            "type":       "HANDSHAKE_INIT",
            "from_did":   localIdentity.did,
            "nonce_a":    nonce_a,
            "timestamp":  Int64(Date().timeIntervalSince1970 * 1000),
        ]
        let initData = try JSONSerialization.data(withJSONObject: initMsg)
        relay.send(data: initData)

        // Wait for either HANDSHAKE_INIT (we are guest) or HANDSHAKE_RESPONSE (we are host)
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let timer = Task {
                try await Task.sleep(nanoseconds: 15_000_000_000)
                cont.resume(throwing: AAPError.relayTimeout)
            }
            relay.onReceive { [weak self] data in
                guard let self else { return }
                guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let type = obj["type"] as? String else { return }

                Task { @MainActor in
                    timer.cancel()
                    if type == "HANDSHAKE_RESPONSE",
                       let derivedKey = obj["session_key"] as? String {
                        self.sessionKey = derivedKey
                        self._connected = true
                        cont.resume()
                    } else if type == "HANDSHAKE_INIT",
                              let peerNonce = obj["nonce_a"] as? String,
                              let peerDID   = obj["from_did"] as? String {
                        // We are guest — reply
                        let nonce_b = generateNonce()
                        let combined = peerNonce + nonce_b
                        self.sessionKey  = combined // simplified — real impl uses HKDF
                        self._connected  = true
                        self.remotePublicKey = peerDID

                        let response: [String: Any] = [
                            "type":        "HANDSHAKE_RESPONSE",
                            "nonce_b":     nonce_b,
                            "session_key": combined,
                        ]
                        if let responseData = try? JSONSerialization.data(withJSONObject: response) {
                            relay.send(data: responseData)
                        }
                        cont.resume()
                    }
                }
            }
        }

        print("✅ [AAPKit] Relay tunnel established (\(remoteAddress))")
    }

    // MARK: - Send

    /// Send a typed action to the connected peer.
    public func send(
        actionType: String,
        payload:    [String: AAPValue] = [:]
    ) async throws {
        guard _connected else { throw AAPError.handshakeFailed("Not connected") }

        let envelope = try buildEnvelope(
            actionType:    actionType,
            payload:       payload,
            fromDID:       localIdentity.did,
            toDID:         remoteAddress,
            privateKeyHex: privateKeyHex
        )

        if let relay {
            let encoder    = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            let envData    = try encoder.encode(envelope)
            relay.send(data: envData)
        } else {
            // Direct HTTP delivery (non-relay sessions)
            throw AAPError.sendFailed("Direct delivery not yet implemented in Swift SDK — use relay")
        }
    }

    // MARK: - Receive

    /// Register a handler for incoming messages.
    public func onMessage(_ handler: @escaping (AAPMessage) -> Void) {
        messageHandlers.append(handler)
    }

    // MARK: - Lifecycle

    public func disconnect() async {
        relay?.close()
        _connected = false
        sessionKey = nil
    }

    public var isConnected: Bool { _connected }
}
