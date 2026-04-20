/**
 * AAP SDK — JavaScript / TypeScript
 * 3 lines to make any AI agent AAP-compliant.
 *
 * import { AAPAgent } from '@a2a_protocol/aap-sdk';
 * const agent = new AAPAgent({ name: 'vimalesh.finance' });
 * await agent.register();
 */

export { AAPAgent }        from './agent';
export { AAPSession }      from './session';
export { RelayTransport }  from './relay';
export { Capability, Action } from './constants';
export type { AAPAgentConfig, MessageHandler, AgentProfile } from './types';
export type { RelayFrame, RelayEvent }         from './relay';
