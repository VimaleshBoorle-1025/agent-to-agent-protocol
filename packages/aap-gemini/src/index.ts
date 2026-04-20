/**
 * aap-gemini — AAP wrapper for Google Gemini
 *
 * Usage:
 *   import { AAPGemini } from 'aap-gemini';
 *
 *   const agent = new AAPGemini({
 *     name: 'vimalesh.research.agent',
 *     model: 'gemini-1.5-pro',
 *     apiKey: process.env.GEMINI_API_KEY,
 *     capabilities: ['REQUEST_DATA', 'PING'],
 *   });
 *
 *   await agent.register();
 *   const session = await agent.connect('aap://demo.echo.agent');
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AAPGeminiConfig {
  name:          string;
  model?:        string;
  systemPrompt?: string;
  apiKey?:       string;
  capabilities?: string[];
  registryUrl?:  string;
}

export interface AAPGeminiSession {
  connected:    boolean;
  session_key?: string;
  send(action: string, params: Record<string, unknown>): Promise<unknown>;
  disconnect(): Promise<void>;
  chat(userMessage: string): Promise<string>;
}

export class AAPGemini {
  private config: AAPGeminiConfig;
  private genAI: GoogleGenerativeAI;
  private identity?: Record<string, unknown>;
  private privateKeyHex?: string;

  constructor(config: AAPGeminiConfig) {
    this.config = config;
    this.genAI  = new GoogleGenerativeAI(config.apiKey ?? process.env.GEMINI_API_KEY ?? '');
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
    console.log(`✅ Gemini agent registered: aap://${this.config.name}`);
    return this.identity;
  }

  async connect(address: string): Promise<AAPGeminiSession> {
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
    const session  = await inner.connect(address);
    const genAI    = this.genAI;
    const config   = this.config;

    return {
      connected:   session.isConnected(),
      session_key: session.getSessionKey(),

      async send(action: string, params: Record<string, unknown>): Promise<unknown> {
        return session.send(action as any, params);
      },

      async disconnect(): Promise<void> { return session.disconnect(); },

      async chat(userMessage: string): Promise<string> {
        const model = genAI.getGenerativeModel({ model: config.model ?? 'gemini-1.5-pro' });
        const systemInstruction = config.systemPrompt ?? `You are ${config.name}, an AAP-compliant AI agent.
When asked to perform an action, respond with valid JSON only.
Format: {"action_type": "ACTION_NAME", "parameters": {...}}
Valid actions: ${(config.capabilities ?? ['PING', 'REQUEST_DATA']).join(', ')}`;

        const result = await model.generateContent(
          `${systemInstruction}\n\nUser: ${userMessage}`
        );
        const text = result.response.text();

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

export default AAPGemini;
