import secrets
import httpx
from typing import Optional, Callable, Awaitable
from .constants import DEFAULT_REGISTRY_URL
from .session import AAPSession


class AAPAgent:
    """
    AAP Agent — the main entry point for the Python SDK.

    Usage:
        agent = AAPAgent(name='vimalesh.finance', capabilities=[Capability.REQUEST_QUOTE])
        await agent.register()
        session = await agent.connect('aap://demo.echo')
        result  = await session.send(Action.PING, {})
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
        self._private_key_hex: Optional[str] = None

    async def register(self) -> dict:
        """
        Register this agent with the AAP Registry.
        Generates a key pair and publishes the aap:// address.
        """
        self._public_key_hex, self._private_key_hex = self._generate_key_pair()
        aap_address = f"aap://{self.name}"
        endpoint_url = f"https://agent.{self.name.replace('.', '-')}.local"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.registry_url}/v1/register",
                json={
                    "aap_address": aap_address,
                    "public_key_hex": self._public_key_hex,
                    "endpoint_url": endpoint_url,
                    "capabilities": [str(c) for c in self.capabilities],
                    "owner_type": "human",
                    "signature": "placeholder",  # TODO: Dilithium3 signature
                },
            )
            response.raise_for_status()
            data = response.json()

        self.identity = {**data, "public_key_hex": self._public_key_hex}
        print(f"✅ Registered: {aap_address}")
        print(f"   DID: {self.identity['did']}")
        return self.identity

    async def connect(self, address: str) -> "AAPSession":
        """Connect to another agent. Performs the AAP handshake."""
        if not self.identity:
            raise RuntimeError("Agent not registered. Call register() first.")
        session = AAPSession(self.identity, address, self.registry_url)
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

    def get_identity(self) -> Optional[dict]:
        return self.identity

    def _generate_key_pair(self) -> tuple[str, str]:
        # Placeholder. Production: use pyca/cryptography Dilithium3 or Ed25519.
        pub = "ed25519_pub_" + secrets.token_hex(32)
        prv = "ed25519_prv_" + secrets.token_hex(32)
        return pub, prv
