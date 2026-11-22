import { decay, flash, initialLamps, type LampConfig, type LampState } from './lamps';
import type { Channel } from './types';

export type Action = { readonly type: 'flash'; readonly channel: Channel } | { readonly type: 'wait' };

export interface ProtoState {
  readonly turn: number;
  readonly lamps: LampState;
  readonly flashes: Readonly<Record<Channel, number>>;
}

export function initialState(): ProtoState {
  return { turn: 0, lamps: initialLamps(), flashes: { red: 0, cyan: 0 } };
}

/** One turn (§7.1), stage-1 subset: resolve action, then decay. */
export function step(s: ProtoState, action: Action, cfg: LampConfig): ProtoState {
  let lamps = s.lamps;
  let flashes = s.flashes;
  if (action.type === 'flash') {
    lamps = flash(lamps, action.channel, cfg);
    flashes = { ...flashes, [action.channel]: flashes[action.channel] + 1 };
  }
  return { turn: s.turn + 1, lamps: decay(lamps), flashes };
}
