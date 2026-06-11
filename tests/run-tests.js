const assert = require('node:assert/strict');
const logic = require('../game-logic');
const appConfig = require('../app-config');

const rankIndex = {
  '2':0, '3':1, '4':2, '5':3, '6':4, '7':5, '8':6,
  '9':7, T:8, J:9, Q:10, K:11, A:12
};
const suitIndex = {c:0, d:1, h:2, s:3};
const card = (rank, suit) => suitIndex[suit] * 13 + rankIndex[rank];

function test(name, fn){
  try{
    fn();
    console.log(`ok - ${name}`);
  }catch(err){
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('hand evaluator classifies a royal flush', () => {
  const hand = [
    card('A', 'c'), card('K', 'c'),
    card('Q', 'c'), card('J', 'c'), card('T', 'c'),
    card('2', 'd'), card('3', 'h')
  ];
  assert.equal(logic.handEval(hand).cls, 'royal_flush');
});

test('app config exposes game metadata and normalizes saved session summaries', () => {
  assert.equal(appConfig.appVersion, '3.1');
  assert.equal(appConfig.cacheVersion, 'v3.1');
  assert.equal(appConfig.appName, 'Golden Table Games');
  assert.equal(appConfig.currentGameId, 'heads-up-hold-em');
  assert.ok(appConfig.games[appConfig.currentGameId]);
  assert.equal(appConfig.games[appConfig.currentGameId].version, '2.9');
  assert.equal(appConfig.games['video-poker-jacks-or-better'].version, '0.3');
  assert.equal(appConfig.games['video-poker-jacks-or-better'].status, 'beta');
  assert.equal(appConfig.games['video-poker-deuces-wild'].version, '0.3');
  assert.equal(appConfig.games['video-poker-deuces-wild'].status, 'beta');

  const summary = appConfig.normalizeSessionSummary({player:'Ada', profit:25});
  assert.equal(summary.gameId, 'heads-up-hold-em');
  assert.equal(summary.schemaVersion, 2);
  assert.equal(summary.gamePlayer, 'heads-up-hold-em::Ada');
  assert.equal(summary.profit, 25);

  const vpSummary = appConfig.normalizeSessionSummary({player:'Ada'}, 'video-poker-jacks-or-better');
  assert.equal(vpSummary.gameId, 'video-poker-jacks-or-better');
  assert.equal(vpSummary.schemaVersion, 1);
  assert.equal(vpSummary.gamePlayer, 'video-poker-jacks-or-better::Ada');

  const dwSummary = appConfig.normalizeSessionSummary({player:'Ada'}, 'video-poker-deuces-wild');
  assert.equal(dwSummary.gameId, 'video-poker-deuces-wild');
  assert.equal(dwSummary.schemaVersion, 1);
  assert.equal(dwSummary.gamePlayer, 'video-poker-deuces-wild::Ada');
});

test('settlement pays winning straight odds while ante pushes against non-qualifying dealer', () => {
  const result = logic.settleHand({
    player:[card('K', 'c'), card('Q', 'd')],
    dealer:[card('4', 'h'), card('5', 's')],
    board:[card('9', 'c'), card('T', 'd'), card('J', 'h'), card('2', 's'), card('3', 'c')],
    wagers:{Ante:10, Blind:10, Play:30, Trips:0, Pocket:0},
    actions:{preflop:'raise3', flop:null, river:null},
    anteValue:10
  });

  assert.equal(result.outcome, 'win');
  assert.equal(result.dealerQual, false);
  assert.deepEqual(result.returns, {Ante:10, Blind:20, Play:60, tripsPay:0, pocketPay:0});
  assert.equal(result.playerNet, 90);
  assert.equal(result.profit, 40);
});

test('settlement pays bad beat odds when player loses with a flush', () => {
  const result = logic.settleHand({
    player:[card('A', 'c'), card('K', 'c')],
    dealer:[card('9', 'd'), card('9', 'h')],
    board:[card('9', 'c'), card('3', 'h'), card('3', 'd'), card('2', 'c'), card('5', 'c')],
    wagers:{Ante:10, Blind:10, Play:10, Trips:0, Pocket:0},
    actions:{preflop:'check', flop:'check', river:'call1'},
    anteValue:10
  });

  assert.equal(result.outcome, 'loss');
  assert.equal(result.pClass, 'flush');
  assert.equal(result.dClass, 'full_house');
  assert.deepEqual(result.returns, {Ante:0, Blind:50, Play:0, tripsPay:0, pocketPay:0});
  assert.equal(result.playerNet, 50);
  assert.equal(result.profit, 20);
});

test('fold settlement still pays pocket bonus and loses ante/odds', () => {
  const result = logic.settleFold({
    player:[card('A', 'c'), card('A', 'd')],
    dealer:[card('K', 'h'), card('Q', 's')],
    board:[card('2', 'c'), card('5', 'd'), card('8', 'h'), card('T', 's'), card('3', 'c')],
    wagers:{Ante:10, Blind:10, Play:0, Trips:0, Pocket:5},
    actions:{preflop:'check', flop:'check', river:'fold'},
    anteValue:10
  });

  assert.equal(result.playerNet, 130);
  assert.equal(result.profit, 105);
  assert.equal(result.returns.pocketPay, 130);
  assert.equal(result.breakdown.ante, -10);
  assert.equal(result.breakdown.blind, -10);
});

test('preflop strategy raises any ace and checks pocket deuces', () => {
  assert.equal(logic.recommendWoO({
    player:[card('A', 'c'), card('2', 'd')],
    board:[card('4', 'c'), card('7', 'd'), card('9', 'h'), card('J', 's'), card('3', 'c')],
    ante:10
  }).preflop, 'raise3');

  assert.equal(logic.recommendWoO({
    player:[card('2', 'c'), card('2', 'd')],
    board:[card('4', 'c'), card('7', 'd'), card('9', 'h'), card('J', 's'), card('3', 'c')],
    ante:10
  }).preflop, 'check');
});

test('preflop check advice explains the missed threshold', () => {
  const advice = logic.computeAdvice({
    stage:'preflop',
    player:[card('K', 'c'), card('4', 'd')],
    board:[],
    playMult:0
  });

  assert.equal(advice.action, 'Check');
  assert.match(advice.why, /K threshold/);
  assert.match(advice.why, /K suited 5\+ or K offsuit 7\+/);
});

test('flop strategy raises hidden pair but not pocket deuces', () => {
  assert.equal(logic.recommendWoO({
    player:[card('4', 'c'), card('8', 'd')],
    board:[card('4', 'h'), card('7', 'd'), card('9', 's'), card('J', 's'), card('3', 'c')],
    ante:10
  }).flop, 'raise2');

  assert.equal(logic.recommendWoO({
    player:[card('2', 'c'), card('2', 'd')],
    board:[card('4', 'h'), card('7', 'd'), card('9', 's'), card('J', 's'), card('3', 'c')],
    ante:10
  }).flop, 'check');
});

console.log('All tests passed.');
