import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, recordLoop, buyGear, gearCost, finishGig, parseSave, advance, VENUES, incomePerSecond } from '../src/engine.js';

test('recording 16 loops creates a track and rewards the player', () => {
  const state = freshState();
  for (let i = 0; i < 16; i++) recordLoop(state);
  assert.equal(state.tracks, 1);
  assert.equal(state.loops, 0);
  assert.equal(state.fans, 5);
  assert.equal(state.cash, 252);
});

test('gear upgrades spend the current price and increase income', () => {
  const state = freshState();
  const before = incomePerSecond(state);
  assert.equal(buyGear(state, 'decks'), true);
  assert.equal(state.cash, 60);
  assert.equal(state.gear.decks, 1);
  assert.ok(incomePerSecond(state) > before);
  assert.equal(buyGear(state, 'decks'), false);
  assert.equal(gearCost(state, 'unknown'), Infinity);
});

test('gig results update the player and history', () => {
  const state = freshState();
  const result = finishGig(state, VENUES[0].id, 1, 1000);
  assert.equal(result.fee, 224);
  assert.equal(result.fans, 29);
  assert.equal(state.shows, 1);
  assert.equal(state.history[0].venue, 'bedroom');
});

test('offline progress is capped and malformed saves are rejected', () => {
  const state = freshState(1_000);
  const expected = incomePerSecond(state) * 8 * 60 * 60;
  const earned = advance(state, 100 * 60 * 60);
  assert.equal(earned, expected);
  assert.throws(() => parseSave({ version: 99 }));
  const loaded = parseSave({ version: 1, cash: 42, fans: 10, gear: { decks: 1 }, savedAt: 500 });
  assert.equal(loaded.cash, 42);
  assert.equal(loaded.gear.decks, 1);
});
