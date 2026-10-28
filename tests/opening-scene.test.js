import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOpeningScene } from '../src/openingScene.js';
import { selectWeatherMoment } from '../src/characterExperience.js';

const clear = { loading: false, night: false, available: true, stale: false, condition: 'sun', hasSun: true };
const offer = { id: 'offer', placeId: 'sunny-place', kind: 'beer', claimable: true };
const choose = (weather = {}, offers = [], extra = {}) => selectOpeningScene({ weatherMoment: selectWeatherMoment({ ...clear, ...weather }), offers, sunnyPlaceIds: ['sunny-place'], ...extra });

test('opening has exactly the sun, no-sun and eligible Golden Hour outcomes', () => {
  assert.equal(choose().id, 'opening.sun');
  for (const [kind, character, pose] of [['beer', 'puffer', 'beer-seated'], ['cocktail', 'blue-coat', 'cocktail-seated']]) {
    const scene = choose({}, [{ ...offer, kind }]);
    assert.equal(scene.id, 'opening.golden-hour');
    assert.equal(scene.character, character);
    assert.equal(scene.pose, pose);
    assert.equal(scene.offer.id, offer.id);
  }
  for (const offers of [[{ ...offer, claimable: false }], [{ ...offer, kind: 'unknown' }], [{ ...offer, placeId: 'other-place' }]]) {
    assert.equal(choose({}, offers).id, 'opening.sun');
  }
});

test('claims never override unavailable sun and weather props reflect only known conditions', () => {
  for (const input of [{ condition: 'cloud' }, { condition: 'rain' }, { condition: 'unknown' }, { stale: true }, { available: false }, { night: true }, { hasSun: false }]) {
    const scene = choose(input, [offer]);
    assert.equal(scene.id, 'opening.no-sun');
    assert.notEqual(scene.weather, 'sun');
    assert.equal(scene.offer, undefined);
    assert.ok(!['beer-seated', 'cocktail-seated'].includes(scene.pose));
  }
  assert.equal(choose({ condition: 'cloud' }).weather, 'cloud');
  assert.equal(choose({ available: false }).weather, undefined);
  assert.equal(choose({ stale: true }).weather, undefined);
  assert.equal(choose({ night: true }).weather, 'moon');
});

test('unresolved data cannot show a positive opening', () => {
  assert.equal(choose({}, [offer], { loading: true }), null);
  assert.equal(choose({ loading: true }, [offer]), null);
});
