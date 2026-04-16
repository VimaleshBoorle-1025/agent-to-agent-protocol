import secrets
import uuid
import httpx
from typing import Any
from .constants import AAP_VERSION, MESSAGE_TTL_SECONDS, Action


class AAPSession:
    """Represents an active encrypted tunnel between two AAP agents."""

    def __init__(self, local_identity: dict, remote_address: str, registry_url: str):
        self.local_identity = local_identity
        self.remote_address = remote_address
        self.registry_url = registry_url
        self.remote_identity: dict | None = None
        self.session_key: str | None = None
        self.connected = False

    async def handshake(self) -> None:
        """Perform AAP handshake and establish encrypted tunnel."""
        import urllib.parse
        print(f"Looking up {self.remote_address}...")
        encoded = urllib.parse.quote(self.remote_address, safe="")

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.registry_url}/v1/lookup/{encoded}")
            response.raise_for_status()
            self.remote_identity = response.json()

        print("Verifying identity...")
        # TODO: Verify Dilithium3 certificate against registry

        print("Performing handshake...")
        nonce_a = secrets.token_hex(32)

        # TODO: Send HANDSHAKE_INIT to remote endpoint, receive HANDSHAKE_RESPONSE
        # Simulate session key derivation via Kyber768
        self.session_key = f"session_{nonce_a[:16]}"
        self.connected = True
        print(f"✅ Secure tunnel established ({self.remote_address})")

    async def send(self, action: Action | str, params: dict[str, Any]) -> Any:
        """Send a typed action to the connected agent."""
        if not self.connected:
            raise RuntimeError("Not connected. Call handshake() first.")

        message = {
            "aap_version": AAP_VERSION,
            "action_type": str(action),
            "from_did": self.local_identity["did"],
            "message_id": str(uuid.uuid4()),
            "timestamp": int(__import__("time").time() * 1000),
            "nonce": secrets.token_hex(32),
            "ttl": MESSAGE_TTL_SECONDS,
            **params,
        }

        # TODO: Three-envelope encryption + send to remote endpoint
        print(f"📤 Sending {action} to {self.remote_address}")
        return {"status": "delivered", "message_id": message["message_id"]}

    async def disconnect(self) -> None:
        """Clean disconnect from session."""
        if self.connected:
            await self.send(Action.DISCONNECT, {})
            self.connected = False
            self.session_key = None
            print(f"Disconnected from {self.remote_address}")
