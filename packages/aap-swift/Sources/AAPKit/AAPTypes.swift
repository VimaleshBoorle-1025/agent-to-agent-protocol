import Foundation

// MARK: - Core types

/// A registered agent's identity on the AAP network.
public struct AgentIdentity: Codable, Sendable {
    public let did:          String
    public let aapAddress:   String
    public let publicKeyHex: String
    public let name:         String
}

/// An incoming AAP message decoded from an outer envelope.
public struct AAPMessage: Codable, Sendable {
    public let actionType:  String
    public let fromDID:     String
    public let messageID:   String
    public let timestamp:   Int64
    public let payload:     [String: AAPValue]
}

/// A type-erased JSON value (needed because Swift Codable doesn't natively
/// handle heterogeneous dictionaries).
public enum AAPValue: Codable, Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AAPValue])
    case dict([String: AAPValue])
    case null

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil()                           { self = .null;   return }
        if let v = try? c.decode(Bool.self)        { self = .bool(v); return }
        if let v = try? c.decode(Int.self)         { self = .int(v);  return }
        if let v = try? c.decode(Double.self)      { self = .double(v); return }
        if let v = try? c.decode(String.self)      { self = .string(v); return }
        if let v = try? c.decode([AAPValue].self)  { self = .array(v);  return }
        if let v = try? c.decode([String: AAPValue].self) { self = .dict(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unknown JSON value")
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null:         try c.encodeNil()
        case .bool(let v):  try c.encode(v)
        case .int(let v):   try c.encode(v)
        case .double(let v):try c.encode(v)
        case .string(let v):try c.encode(v)
        case .array(let v): try c.encode(v)
        case .dict(let v):  try c.encode(v)
        }
    }
}

/// Configuration for creating an AAPAgent.
public struct AAPAgentConfig: Sendable {
    public let name:         String
    public let capabilities: [String]
    public let registryURL:  URL

    public init(
        name:         String,
        capabilities: [String] = [],
        registryURL:  URL      = URL(string: "https://registry.aap.dev")!
    ) {
        self.name         = name
        self.capabilities = capabilities
        self.registryURL  = registryURL
    }
}

// MARK: - Errors

public enum AAPError: Error, LocalizedError {
    case notRegistered
    case registrationFailed(String)
    case agentNotFound(String)
    case handshakeFailed(String)
    case relayFull
    case relayTimeout
    case sendFailed(String)
    case invalidPublicKey
    case unauthorized

    public var errorDescription: String? {
        switch self {
        case .notRegistered:           return "Agent not registered. Call register() first."
        case .registrationFailed(let m): return "Registration failed: \(m)"
        case .agentNotFound(let a):    return "Agent not found: \(a)"
        case .handshakeFailed(let m):  return "Handshake failed: \(m)"
        case .relayFull:               return "Session relay is full (already has 2 peers)"
        case .relayTimeout:            return "Relay handshake timed out"
        case .sendFailed(let m):       return "Send failed: \(m)"
        case .invalidPublicKey:        return "Invalid or missing public key"
        case .unauthorized:            return "Unauthorized — check your DID"
        }
    }
}
