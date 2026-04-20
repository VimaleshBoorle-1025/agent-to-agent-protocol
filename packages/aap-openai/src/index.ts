/**
 * aap-openai — AAP wrapper for OpenAI GPT
 *
 * Usage:
 *   import { AAPOpenAI } from 'aap-openai';
 *
 *   const agent = new AAPOpenAI({
 *     name: 'vimalesh.assistant.agent',
 *     model: 'gpt-4o',
 *     apiKey: process.env.OPENAI_API_KEY,
 *     capabilities: ['REQUEST_DATA', 'PING'],
 *   });
 *
 *   await agent.register();
 *   const session = await agent.connect('aap://demo.echo.agent');
 *   const result  = await session.send('PING', {});
 */

import OpenAI from 'openai';

export interface AAPOpenAIConfig {
  name:          string;
  model?:        string;
  systemPrompt?: string;
  apiKey?:       string;
  capabilities?: string[];
  registryUrl?:  string;
  maxTokens?:    number;
}

export interface AAPOpenAISession {
  connected:    boolean;
  session_key?: string;
  send(action: string, params: Record<string, unknown>): Promise<unknown>;
  disconnect(): Promise<void>;
  chat(userMessage: string): Promise<string>;
}

export class AAPOpenAI {
  private config: AAPOpenAIConfig;
  private openai: OpenAI;
  private identity?: Record<string, unknown>;
  private privateKeyHex?: string;

  constructor(config: AAPOpenAIConfig) {
    this.config = config;
    this.openai = new OpenAI({ apiKey: config.apiKey ?? process.env.OPENAI_API_KEY });
  }

  async register(): Promise<Record<string, unknown>> {
    const { AAPAgent } = await import('@a2a_protocol/aap-sdk');
    const inner = new AAPAgent({
      name:         this.config.name,
      capabilities: this.config.capabilities,
      registryUrl:  this.config.registryUrl,
    });
    const identity = await inner.register();
    this.identity      = identity as unknown as Record<string, unknown>;
    this.privateKeyHex = (inner as any)._privateKeyHex ?? (inner as any).privateKeyHex;
    console.log(`✅ OpenAI agent registered: aap://${this.config.name}`);
    return this.identity;
  }

  async connect(address: string): Promise<AAPOpenAISession> {
    const { AAPAgent } = await import('@a2a_protocol/aap-sdk');
    const inner = new AAPAgent({
      name:         this.config.name,
      capabilities: this.config.capabilities,
      registryUrl:  this.config.registryUrl,
    });
    if (this.identity && this.privateKeyHex) {
      (inner as any).identity       = this.identity;
      (inner as any)._privateKeyHex = this.privateKeyHex;
      (inner as any).privateKeyHex  = this.privateKeyHex;
    }
    const session = await inner.connect(address);
    const openai  = this.openai;
    const config  = this.config;

    return {
      connected:   session.isConnected(),
      session_key: session.getSessionKey(),

      async send(action: string, params: Record<string, unknown>): Promise<unknown> {
        return session.send(action as any, params);
      },

      async disconnect(): Promise<void> { return session.disconnect(); },

      async chat(userMessage: string): Promise<string> {
        const completion = await openai.chat.completions.create({
          model:      config.model ?? 'gpt-4o',
          max_tokens: config.maxTokens ?? 1024,
          messages: [
            {
              role: 'system',
              content: config.systemPrompt ?? `You are ${config.name}, an AAP-compliant AI agent.
When asked to perform an action, respond with valid JSON only.
Format: {"action_type": "ACTION_NAME", "parameters": {...}}
Valid actions: ${(config.capabilities ?? ['PING', 'REQUEST_DATA']).join(', ')}`,
            },
            { role: 'user', content: userMessage },
          ],
        });

        const text = completion.choices[0]?.message?.content ?? '';
        try {
          const parsed = JSON.parse(text);
          if (parsed.action_type && parsed.parameters !== undefined) {
            await session.send(parsed.action_type, parsed.parameters);
            return `Sent ${parsed.action_type} to ${address}`;
          }
        } catch {}
        return text;
      },
    };
  }

  getIdentity() { return this.identity; }
}

export default AAPOpenAI;
