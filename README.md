# AAP — Agent Authentication Protocol

> The universal communication standard for AI agents.
> Any agent — Claude, ChatGPT, Gemini, or any custom agent — can find, verify, and securely communicate with any other agent using AAP.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol Version](https://img.shields.io/badge/protocol-v1.0-green.svg)]()
[![Status](https://img.shields.io/badge/status-in%20development-orange.svg)]()

---

## The Problem

AI agents are proliferating but exist in complete isolation. There is no standard way for:

- Agent A to **find** Agent B on the internet
- Agent A to **cryptographically verify** that Agent B is who it claims to be
- Two agents to **establish a secure, encrypted** communication channel
- A human to **authorize** sensitive actions their agent takes on their behalf
- Agent actions to be **immutably audited** for accountability

```
TCP/IP: any computer  talks to any computer.
HTTP:   any app       talks to any app.
AAP:    any agent     talks to any agent.
```

---

## Architecture

```
Any AI Agent  (Claude / ChatGPT / Gemini / Custom)
     │
AAP SDK  ──────────────  3-line integration for any developer
     │
Intent Compiler  ──────  AI isolation + capability enforcement
     │
AAP Protocol Engine  ──  Identity · Handshake · Encryption
     │
AAP Infrastructure  ───  Registry · Mailbox · Audit · Trust
     │
HTTPS / TLS 1.3  ──────  Transport (existing, unchanged)
```

## Monorepo Structure

```
packages/
├── registry-server/      # Global agent directory (Node.js + Fastify + PostgreSQL)
├── mailbox-server/       # Async message queue for offline delivery
├── audit-server/         # Immutable append-only action log
├── identity-service/     # Cryptographic certificate issuance
├── intent-compiler/      # Security boundary between AI brain and protocol
├── sdk-js/               # TypeScript SDK — npm install aap-sdk
├── sdk-python/           # Python SDK  — pip install aap-sdk
└── cli/                  # Developer CLI — aap register, aap connect, aap send
docs/                     # Protocol specification and architecture docs
db/migrations/            # PostgreSQL schema migrations
.github/workflows/        # CI/CD + Claude Code integration
```

## Quick Start

**JavaScript / TypeScript**
```bash
npm install aap-sdk
```
```ts
import { AAPAgent } from 'aap-sdk';

const agent = new AAPAgent({ name: 'vimalesh.finance' });
await agent.register();
// ✅ Live at aap://vimalesh.finance

const session = await agent.connect('aap://demo.echo');
const result  = await session.send('REQUEST_DATA', { query: 'hello' });
```

**Python**
```bash
pip install aap-sdk
```
```python
from aap import AAPAgent, Action

agent = AAPAgent(name='vimalesh.finance')
await agent.register()

session = await agent.connect('aap://demo.echo')
result  = await session.send(Action.REQUEST_DATA, {'query': 'hello'})
```

**CLI**
```bash
npm install -g aap-cli

aap register --name vimalesh.dev
aap connect aap://demo.echo
aap send aap://demo.echo '{"action_type":"PING"}'
```

## Protocol Highlights

| Feature | Detail |
|---|---|
| Agent addressing | `aap://[owner].[type].[capability]` |
| Signatures | CRYSTALS-Dilithium3 (post-quantum, NIST standard) |
| Key exchange | CRYSTALS-Kyber768 (post-quantum KEM) |
| Message format | Three-envelope encryption (outer / middle / inner) |
| Replay protection | 256-bit nonce + 30-second timestamp window |
| Offline delivery | Encrypted mailbox queue (7-day retention) |
| Audit trail | Cryptographic append-only chain, IPFS-replicated |
| AI isolation | Intent Compiler — deterministic, never manipulable |

## Implementation Roadmap

| Week | Milestone |
|---|---|
| 1 | Registry server + DID generation + phone verification |
| 2 | Dilithium3 handshake + Kyber768 key exchange + encrypted tunnel |
| 3 | Mailbox service + offline delivery + WebSocket stream |
| 4 | Intent Compiler + capability manifest enforcement |
| 5 | CLI tool + JS SDK + npm publish |
| 6 | Python SDK + open source launch |
| Month 2 | Platform wrappers: aap-claude, aap-openai, aap-gemini |
| Month 3 | Audit chain + human authorization service |
| Month 4 | Managed hosting launch + Stripe billing |

## License

MIT — The protocol is free and open source forever.
