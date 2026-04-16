/**
 * aap-claude — AAP wrapper for Anthropic Claude
 *
 * Usage:
 *   import { AAPClaude } from 'aap-claude';
 *
 *   const agent = new AAPClaude({
 *     name: 'vimalesh.finance.agent',
 *     model: 'claude-opus-4-6',
 *     systemPrompt: 'You are a financial assistant...',
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *     capabilities: ['REQUEST_QUOTE', 'READ_BANK_BALANCE'],
 *   });
 *
 *   await agent.register();
 *   // ✅ Claude is now a live AAP agent
 *
 *   const session = await agent.connect('aap://demo.finance.agent');
 *   const result  = await session.send('REQUEST_QUOTE', { asset: 'BTC' });
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AAPClaudeConfig {
  name:         string;
  model?:       string;
  systemPrompt?: string;
  apiKey?:      string;
  capabilities?: string[];
  registryUrl?: string;
  maxTokens?:   number;
}

export interface AAPClaudeSession {
  connected:  boolean;
  session_key?: string;
  send(action: string, params: Record<string, unknown>): Promise<unknown>;
  disconnect(): Promise<void>;
  chat(userMessage: string): Promise<string>;
}

/**
 * AAPClaude — makes any Claude model an AAP-compliant agent.
 * Handles registration, session management, and intent compilation.
 */
export class AAPClaude {
  private config: AAPClaudeConfig;
  private anthropic: Anthropic;
  private identity?: Record<string, unknown>;
  private privateKeyHex?: string;

  constructor(config: AAPClaudeConfig) {
    this.config    = config;
    this.anthropic = new Anthropic({ apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  /**
   * Register this Claude agent with the AAP Registry.
   * Generates Ed25519 key pair, signs the registration body.
   */
  async register(): Promise<Record<string, unknown>> {
    // Lazy-import aap-sdk to avoid bundling issues
    const { AAPAgent } = await import('aap-sdk');
    const inner = new AAPAgent({
      name:         this.config.name,
      capabilities: this.config.capabilities,
      registryUrl:  this.config.registryUrl,
    });
    const identity = await inner.register();
    this.identity      = identity as unknown as Record<string, unknown>;
    this.privateKeyHex = (inner as any)._privateKeyHex ?? (inner as any).privateKeyHex;

    console.log(`✅ Claude agent registered: aap://${this.config.name}`);
    return identity as unknown as Record<string, unknown>;
  }

  /**
   * Connect to another AAP agent. Returns an AAPClaudeSession.
   */
  async connect(address: string): Promise<AAPClaudeSession> {
    const { AAPAgent } = await import('aap-sdk');
    const inner = new AAPAgent({
      name:         this.config.name,
      capabilities: this.config.capabilities,
      registryUrl:  this.config.registryUrl,
    });

    // Restore identity so we don't re-register
    if (this.identity && this.privateKeyHex) {
      (inner as any).identity       = this.identity;
      (inner as any)._privateKeyHex = this.privateKeyHex;
      (inner as any).privateKeyHex  = this.privateKeyHex;
    }

    const session = await inner.connect(address);
    const anthropic = this.anthropic;
    const config    = this.config;

    return {
      connected:   session.isConnected(),
      session_key: session.getSessionKey(),

      async send(action: string, params: Record<string, unknown>): Promise<unknown> {
        return session.send(action as any, params);
      },

      async disconnect(): Promise<void> {
        return session.disconnect();
      },

      /**
       * chat() — send a natural-language message to Claude.
       * Claude's response is parsed through the Intent Compiler before
       * being sent as a typed AAP action to the remote agent.
       */
      async chat(userMessage: string): Promise<string> {
        const response = await anthropic.messages.create({
          model:      config.model ?? 'claude-opus-4-6',
          max_tokens: config.maxTokens ?? 1024,
          system:     config.systemPrompt ?? `You are ${config.name}, an AAP-compliant AI agent.
When asked to perform an action, respond with valid JSON only.
Format: {"action_type": "ACTION_NAME", "parameters": {...}}
Valid actions: ${(config.capabilities ?? ['PING', 'REQUEST_DATA']).join(', ')}`,
          messages: [{ role: 'user', content: userMessage }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';

        // Attempt to parse Claude's response as an AAP action
        try {
          const parsed = JSON.parse(text);
          if (parsed.action_type && parsed.parameters !== undefined) {
            await session.send(parsed.action_type, parsed.parameters);
            return `Sent ${parsed.action_type} to ${address}`;
          }
        } catch {
          // Not JSON — return as plain text response
        }

        return text;
      },
    };
  }

  getIdentity() { return this.identity; }
}

export default AAPClaude;
