"""Python SDK — TDD Tests"""
import pytest
import json
import respx
import httpx
from unittest.mock import AsyncMock, patch

from aap import AAPAgent, Action


# ─── Key Generation ──────────────────────────────────────────────────────────

class TestKeyGeneration:
    def test_generate_key_pair_returns_hex_strings(self):
        agent = AAPAgent(name="test.agent.one")
        pub, priv = agent._generate_key_pair()
        assert len(pub) == 64   # 32 bytes = 64 hex chars
        assert len(priv) == 32  # 32 raw bytes
        assert all(c in "0123456789abcdef" for c in pub)

    def test_two_agents_get_different_key_pairs(self):
        a1 = AAPAgent(name="test.agent.two")
        a2 = AAPAgent(name="test.agent.three")
        pub1, _ = a1._generate_key_pair()
        pub2, _ = a2._generate_key_pair()
        assert pub1 != pub2

    def test_sign_produces_hex_string(self):
        agent = AAPAgent(name="test.agent.four")
        _, priv = agent._generate_key_pair()
        agent._private_key_bytes = priv
        sig = agent._sign(b"hello aap")
        assert isinstance(sig, str)
        assert len(sig) > 0
        assert all(c in "0123456789abcdef" for c in sig)


# ─── Register ────────────────────────────────────────────────────────────────

class TestRegister:
    @pytest.mark.asyncio
    @respx.mock
    async def test_register_sends_correct_payload(self):
        route = respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(201, json={
                "did": "did:aap:abc123",
                "aap_address": "aap://test.finance.agent",
                "created_at": "2026-04-15T00:00:00Z",
            })
        )

        agent = AAPAgent(name="test.finance.agent", registry_url="https://registry.aap.dev")
        identity = await agent.register()

        assert route.called
        assert identity["did"] == "did:aap:abc123"
        assert identity["aap_address"] == "aap://test.finance.agent"

        # Verify the request body has all required fields
        request_body = json.loads(route.calls[0].request.content)
        assert request_body["aap_address"] == "aap://test.finance.agent"
        assert "public_key_hex" in request_body
        assert "signature" in request_body
        assert "nonce" in request_body
        assert "timestamp" in request_body

    @pytest.mark.asyncio
    @respx.mock
    async def test_register_raises_on_failure(self):
        respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(409, json={"error": "ADDRESS_TAKEN"})
        )
        agent = AAPAgent(name="taken.agent.name", registry_url="https://registry.aap.dev")
        with pytest.raises(httpx.HTTPStatusError):
            await agent.register()

    @pytest.mark.asyncio
    @respx.mock
    async def test_register_stores_identity(self):
        respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(201, json={
                "did": "did:aap:xyz",
                "aap_address": "aap://my.test.agent",
            })
        )
        agent = AAPAgent(name="my.test.agent", registry_url="https://registry.aap.dev")
        await agent.register()

        assert agent.get_identity() is not None
        assert agent.get_identity()["did"] == "did:aap:xyz"
        assert "public_key_hex" in agent.get_identity()


# ─── Session ─────────────────────────────────────────────────────────────────

class TestSession:
    @pytest.mark.asyncio
    @respx.mock
    async def test_connect_performs_lookup(self):
        respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(201, json={"did": "did:aap:alice", "aap_address": "aap://alice.test.agent"})
        )
        respx.get("https://registry.aap.dev/v1/lookup/aap%3A%2F%2Fdemo.echo.agent").mock(
            return_value=httpx.Response(200, json={
                "id": "did:aap:demo123",
                "aapAddress": "aap://demo.echo.agent",
                "verificationMethod": [{"publicKeyHex": "a" * 64}],
                "service": [{"serviceEndpoint": "http://localhost:9999"}],
            })
        )

        agent = AAPAgent(name="alice.test.agent", registry_url="https://registry.aap.dev")
        await agent.register()

        session = await agent.connect("aap://demo.echo.agent")
        assert session.connected is True
        assert session.session_key is not None

    @pytest.mark.asyncio
    @respx.mock
    async def test_send_returns_message_id(self):
        respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(201, json={"did": "did:aap:bob", "aap_address": "aap://bob.test.agent"})
        )
        respx.get("https://registry.aap.dev/v1/lookup/aap%3A%2F%2Fdemo.echo.agent").mock(
            return_value=httpx.Response(200, json={
                "id": "did:aap:demo123",
                "verificationMethod": [{"publicKeyHex": "b" * 64}],
                "service": [],
            })
        )

        agent = AAPAgent(name="bob.test.agent", registry_url="https://registry.aap.dev")
        await agent.register()
        session = await agent.connect("aap://demo.echo.agent")

        result = await session.send(Action.PING, {"from_did": "did:aap:bob"})
        assert "message_id" in result
        assert result["status"] == "delivered"

    @pytest.mark.asyncio
    @respx.mock
    async def test_connect_raises_when_agent_not_found(self):
        respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(201, json={"did": "did:aap:carol", "aap_address": "aap://carol.test.agent"})
        )
        respx.get(respx.pattern.M(url__contains="does.not.exist")).mock(
            return_value=httpx.Response(404, json={"error": "Agent not found"})
        )

        agent = AAPAgent(name="carol.test.agent", registry_url="https://registry.aap.dev")
        await agent.register()

        with pytest.raises(httpx.HTTPStatusError):
            await agent.connect("aap://does.not.exist")


# ─── Capability Manifest ─────────────────────────────────────────────────────

class TestCapabilityManifest:
    @pytest.mark.asyncio
    @respx.mock
    async def test_manifest_contains_configured_capabilities(self):
        from aap import Capability
        respx.post("https://registry.aap.dev/v1/register").mock(
            return_value=httpx.Response(201, json={"did": "did:aap:dave", "aap_address": "aap://dave.test.agent"})
        )

        agent = AAPAgent(
            name="dave.test.agent",
            capabilities=[Capability.REQUEST_QUOTE, Capability.READ_BANK_BALANCE],
            registry_url="https://registry.aap.dev",
        )
        await agent.register()

        manifest = agent.get_capability_manifest()
        assert "REQUEST_QUOTE" in manifest["allowed_actions"]
        assert "READ_BANK_BALANCE" in manifest["allowed_actions"]
        assert "expires_at" in manifest
        assert manifest["agent_did"] == "did:aap:dave"
