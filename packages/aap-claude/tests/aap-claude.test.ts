import { AAPClaude } from '../src/index';

jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: '{"action_type":"PING","parameters":{"from":"test"}}' }],
  });
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  return { __esModule: true, default: MockAnthropic };
});

jest.mock('aap-sdk', () => ({
  AAPAgent: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({ did: 'did:aap:claude-test', aap_address: 'aap://test.claude.agent', public_key_hex: 'a'.repeat(64) }),
    connect:  jest.fn().mockResolvedValue({
      isConnected:    () => true,
      getSessionKey:  () => 'session-key-hex',
      send:           jest.fn().mockResolvedValue({ status: 'delivered', message_id: 'msg-1' }),
      disconnect:     jest.fn().mockResolvedValue(undefined),
    }),
    identity: null,
  })),
}));

describe('AAPClaude', () => {
  it('registers successfully', async () => {
    const agent = new AAPClaude({ name: 'test.claude.agent', apiKey: 'sk-test' });
    const identity = await agent.register();
    expect(identity.did).toBe('did:aap:claude-test');
  });

  it('connects to remote agent', async () => {
    const agent = new AAPClaude({ name: 'test.claude.agent', apiKey: 'sk-test' });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    expect(session.connected).toBe(true);
    expect(session.session_key).toBeDefined();
  });

  it('session.send delivers a typed action', async () => {
    const agent = new AAPClaude({ name: 'test.claude.agent', apiKey: 'sk-test', capabilities: ['PING'] });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    const result  = await session.send('PING', { from: 'test' });
    expect((result as any).status).toBe('delivered');
  });

  it('chat() parses Claude response and sends typed action', async () => {
    const agent = new AAPClaude({ name: 'test.claude.agent', apiKey: 'sk-test' });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    const response = await session.chat('ping the echo agent');
    expect(response).toContain('PING');
  });
});
