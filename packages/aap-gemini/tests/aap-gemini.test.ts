import { AAPGemini } from '../src/index';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => '{"action_type":"REQUEST_DATA","parameters":{"key":"val"}}' },
      }),
    }),
  })),
}));

jest.mock('aap-sdk', () => ({
  AAPAgent: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({ did: 'did:aap:gemini-test', aap_address: 'aap://test.gemini.agent', public_key_hex: 'c'.repeat(64) }),
    connect:  jest.fn().mockResolvedValue({
      isConnected:   () => true,
      getSessionKey: () => 'gk-hex',
      send:          jest.fn().mockResolvedValue({ status: 'delivered', message_id: 'msg-3' }),
      disconnect:    jest.fn().mockResolvedValue(undefined),
    }),
  })),
}));

describe('AAPGemini', () => {
  it('registers successfully', async () => {
    const agent    = new AAPGemini({ name: 'test.gemini.agent', apiKey: 'test-key' });
    const identity = await agent.register();
    expect(identity.did).toBe('did:aap:gemini-test');
  });

  it('connects to remote agent', async () => {
    const agent = new AAPGemini({ name: 'test.gemini.agent', apiKey: 'test-key' });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    expect(session.connected).toBe(true);
  });

  it('session.send delivers a typed action', async () => {
    const agent = new AAPGemini({ name: 'test.gemini.agent', apiKey: 'test-key' });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    const result  = await session.send('REQUEST_DATA', { key: 'val' });
    expect((result as any).status).toBe('delivered');
  });

  it('chat() parses Gemini response and sends typed action', async () => {
    const agent = new AAPGemini({ name: 'test.gemini.agent', apiKey: 'test-key' });
    await agent.register();
    const session  = await agent.connect('aap://demo.echo.agent');
    const response = await session.chat('request data from echo agent');
    expect(response).toContain('REQUEST_DATA');
  });
});
