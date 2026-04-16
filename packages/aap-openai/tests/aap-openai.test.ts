import { AAPOpenAI } from '../src/index';

jest.mock('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"action_type":"PING","parameters":{}}' } }],
        }),
      },
    },
  }));
  return { __esModule: true, default: MockOpenAI };
});

jest.mock('aap-sdk', () => ({
  AAPAgent: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({ did: 'did:aap:openai-test', aap_address: 'aap://test.openai.agent', public_key_hex: 'b'.repeat(64) }),
    connect:  jest.fn().mockResolvedValue({
      isConnected:   () => true,
      getSessionKey: () => 'sk-hex',
      send:          jest.fn().mockResolvedValue({ status: 'delivered', message_id: 'msg-2' }),
      disconnect:    jest.fn().mockResolvedValue(undefined),
    }),
  })),
}));

describe('AAPOpenAI', () => {
  it('registers successfully', async () => {
    const agent = new AAPOpenAI({ name: 'test.openai.agent', apiKey: 'sk-test' });
    const identity = await agent.register();
    expect(identity.did).toBe('did:aap:openai-test');
  });

  it('connects to remote agent', async () => {
    const agent = new AAPOpenAI({ name: 'test.openai.agent', apiKey: 'sk-test' });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    expect(session.connected).toBe(true);
  });

  it('session.send delivers a typed action', async () => {
    const agent = new AAPOpenAI({ name: 'test.openai.agent', apiKey: 'sk-test' });
    await agent.register();
    const session = await agent.connect('aap://demo.echo.agent');
    const result  = await session.send('PING', {});
    expect((result as any).status).toBe('delivered');
  });

  it('chat() parses GPT response and sends typed action', async () => {
    const agent = new AAPOpenAI({ name: 'test.openai.agent', apiKey: 'sk-test' });
    await agent.register();
    const session  = await agent.connect('aap://demo.echo.agent');
    const response = await session.chat('ping the echo agent');
    expect(response).toContain('PING');
  });
});
