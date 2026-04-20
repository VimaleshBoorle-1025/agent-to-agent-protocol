import Foundation

/// Real-time session relay over WebSocket.
///
/// Mirrors the JS `RelayTransport` class exactly.
/// Connect two agents across any platform — the relay server forwards
/// frames without decrypting them, preserving end-to-end encryption.
///
/// Usage:
/// ```swift
/// let relay = AAPRelay(handle: "alice.dev", mailboxURL: URL(string: "wss://mailbox.aap.dev")!)
/// try await relay.connect(did: identity.did)
/// relay.onReceive { frame in ... }
/// relay.send(data: frameData)
/// ```
@MainActor
public final class AAPRelay: NSObject, @unchecked Sendable {

    // MARK: - State

    public enum Event: Sendable {
        case waiting(handle: String)
        case ready(handle: String)
        case closed(by: String)
        case error(String)
    }

    private var task:       URLSessionWebSocketTask?
    private let handle:     String
    private let mailboxURL: URL
    private var did:        String = ""

    private var onMessageHandler: ((Data) -> Void)?
    private var onEventHandler:   ((Event) -> Void)?
    private var connectContinuation: CheckedContinuation<Void, Error>?
    private var _isReady = false

    // MARK: - Init

    public init(handle: String, mailboxURL: URL) {
        self.handle     = handle
        self.mailboxURL = mailboxURL
    }

    // MARK: - Connect

    /// Connect to the relay. Resolves when the session is WAITING or READY.
    public func connect(did: String, signature: String? = nil) async throws {
        self.did = did

        // Build WebSocket URL: replace http(s) with ws(s)
        var components        = URLComponents(url: mailboxURL, resolvingAgainstBaseURL: false)!
        components.scheme     = mailboxURL.scheme == "https" ? "wss" : "ws"
        components.path       = "/v1/session/\(handle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? handle)/ws"
        guard let wsURL = components.url else {
            throw AAPError.handshakeFailed("Invalid relay URL")
        }

        var request = URLRequest(url: wsURL)
        let auth    = signature != nil ? "DID \(did) \(signature!)" : "DID \(did)"
        request.setValue(auth, forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        task = URLSession.shared.webSocketTask(with: request)
        task?.resume()

        // Wait for SESSION_WAITING or SESSION_READY
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.connectContinuation = cont
            self.startReceiveLoop()
        }
    }

    // MARK: - Send

    public func send(data: Data) {
        guard _isReady else { return }
        task?.send(.data(data)) { _ in /* ignore send errors */ }
    }

    public func send(string: String) {
        guard _isReady else { return }
        task?.send(.string(string)) { _ in }
    }

    // MARK: - Handlers

    public func onReceive(_ handler: @escaping (Data) -> Void) {
        onMessageHandler = handler
    }

    public func onEvent(_ handler: @escaping (Event) -> Void) {
        onEventHandler = handler
    }

    // MARK: - Disconnect

    public func close() {
        _isReady = false
        task?.cancel(with: .normalClosure, reason: nil)
    }

    public var isReady: Bool { _isReady }

    // MARK: - Receive loop

    private func startReceiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                Task { @MainActor in
                    self.connectContinuation?.resume(throwing: error)
                    self.connectContinuation = nil
                }
            case .success(let message):
                let data: Data
                switch message {
                case .data(let d):   data = d
                case .string(let s): data = Data(s.utf8)
                @unknown default:    data = Data()
                }
                Task { @MainActor in
                    self.handleFrame(data)
                    self.startReceiveLoop()
                }
            }
        }
    }

    private func handleFrame(_ data: Data) {
        // Try to parse as a control frame
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let type = obj["type"] as? String {
            switch type {
            case "SESSION_WAITING":
                _isReady = true
                connectContinuation?.resume()
                connectContinuation = nil
                onEventHandler?(.waiting(handle: handle))
                return
            case "SESSION_READY":
                _isReady = true
                connectContinuation?.resume()
                connectContinuation = nil
                onEventHandler?(.ready(handle: handle))
                return
            case "SESSION_CLOSED":
                _isReady = false
                onEventHandler?(.closed(by: obj["by"] as? String ?? ""))
                return
            case "ERROR":
                let msg = obj["error"] as? String ?? "unknown"
                connectContinuation?.resume(throwing: AAPError.handshakeFailed(msg))
                connectContinuation = nil
                onEventHandler?(.error(msg))
                return
            default:
                break
            }
        }
        // Data frame — pass to consumer
        onMessageHandler?(data)
    }
}
