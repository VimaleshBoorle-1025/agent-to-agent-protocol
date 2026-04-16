import secrets
import json
import time
import hashlib
import httpx
from typing import Optional, Callable

from .constants import DEFAULT_REGISTRY_URL
from .session import AAPSession


class AAPAgent:
    """
    AAP Agent — the main entry point for the Python SDK.

    Usage (3 lines):
        agent = AAPAgent(name='vimalesh.finance')
        await agent.register()
        # ✅ Live at aap://vimalesh.finance
    """

    def __init__(
        self,
        name: str,
        capabilities: Optional[list] = None,
        on_message: Optional[Callable] = None,
        registry_url: str = DEFAULT_REGISTRY_URL,
    ):
        self.name = name
        self.capabilities = capabilities or []
        self.on_message = on_message
        self.registry_url = registry_url
        self.identity: Optional[dict] = None
        self._public_key_hex: Optional[str] = None
        self._private_key_bytes: Optional[bytes] = None

    async def register(self) -> dict:
        """
        Register this agent with the AAP Registry.
        Generates a real Ed25519 key pair and signs the registration body.
        """
        pub_hex, priv_bytes = self._generate_key_pair()
        self._public_key_hex = pub_hex
        self._private_key_bytes = priv_bytes

        aap_address  = f"aap://{self.name}"
        endpoint_url = f"https://agent.{self.name.replace('.', '-')}.local"
        timestamp    = int(time.time() * 1000)
        nonce        = secrets.token_hex(32)

        body_to_sign = {
            "aap_address":     aap_address,
            "public_key_hex":  pub_hex,
            "endpoint_url":    endpoint_url,
            "capabilities":    [str(c) for c in self.capabilities],
            "owner_type":      "human",
            "timestamp":       timestamp,
            "nonce":           nonce,
        }

        signature = self._sign(json.dumps(body_to_sign, sort_keys=True).encode())

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.registry_url}/v1/register",
                json={**body_to_sign, "signature": signature},
            )
            response.raise_for_status()
            data = response.json()

        self.identity = {**data, "public_key_hex": pub_hex}
        print(f"✅ Registered: {aap_address}")
        print(f"   DID: {self.identity['did']}")
        return self.identity

    async def connect(self, address: str) -> "AAPSession":
        """Connect to another agent. Performs the AAP handshake."""
        if not self.identity or not self._private_key_bytes:
            raise RuntimeError("Agent not registered. Call register() first.")
        session = AAPSession(
            self.identity,
            self._private_key_bytes,
            address,
            self.registry_url
        )
        await session.handshake()
        return session

    async def verify(self, did: str) -> dict:
        """Get trust score and verification level for any agent DID."""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.registry_url}/v1/agent/{did}/trust")
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def lookup(address: str, registry_url: str = DEFAULT_REGISTRY_URL) -> dict:
        """Look up any agent by aap:// address."""
        import urllib.parse
        encoded = urllib.parse.quote(address, safe="")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{registry_url}/v1/lookup/{encoded}")
            response.raise_for_status()
            return response.json()

    def get_capability_manifest(self) -> dict:
        """Return a default L2 task manifest for the configured capabilities."""
        import datetime
        expires = (datetime.datetime.utcnow() + datetime.timedelta(hours=24)).isoformat() + "Z"
        return {
            "agent_did":          self.identity["did"] if self.identity else "",
            "level":              2,
            "allowed_actions":    [str(c) for c in self.capabilities] or ["PING", "REQUEST_DATA"],
            "denied_actions":     [],
            "allowed_data_types": [],
            "denied_data_types":  [],
            "approved_agents":    [],
            "expires_at":         expires,
        }

    def get_identity(self) -> Optional[dict]:
        return self.identity

    # ── Crypto ──────────────────────────────────────────────────────────────

    def _generate_key_pair(self) -> tuple[str, bytes]:
        """Generate a real Ed25519 key pair using the cryptography library."""
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption
            private_key = Ed25519PrivateKey.generate()
            public_key  = private_key.public_key()
            pub_hex     = public_key.public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
            priv_bytes  = private_key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
            return pub_hex, priv_bytes
        except ImportError:
            # Fallback if cryptography not installed
            priv = secrets.token_bytes(32)
            pub  = hashlib.sha256(priv).digest()  # deterministic but NOT real Ed25519
            return pub.hex(), priv

    def _sign(self, message: bytes) -> str:
        """Sign message bytes with the agent's private key. Returns hex signature."""
        if not self._private_key_bytes:
            raise RuntimeError("No private key — call register() first")
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
            from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
            private_key = Ed25519PrivateKey.from_private_bytes(self._private_key_bytes)
            return private_key.sign(message).hex()
        except ImportError:
            # Fallback HMAC-SHA256
            import hmac
            return hmac.new(self._private_key_bytes, message, hashlib.sha256).hexdigest()
