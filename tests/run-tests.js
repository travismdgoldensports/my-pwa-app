const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const logic = require('../game-logic');
const appConfig = require('../app-config');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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
  assert.equal(appConfig.appVersion, '4.21');
  assert.equal(appConfig.cacheVersion, 'v4.21');
  assert.equal(appConfig.appName, 'Golden Table Games');
  assert.equal(appConfig.currentGameId, 'heads-up-hold-em');
  assert.ok(appConfig.games[appConfig.currentGameId]);
  assert.equal(appConfig.games[appConfig.currentGameId].version, '2.11');
  assert.equal(appConfig.games['video-poker-jacks-or-better'].version, '0.5');
  assert.equal(appConfig.games['video-poker-jacks-or-better'].status, 'beta');
  assert.equal(appConfig.games.blackjack.version, '1.21');
  assert.equal(appConfig.games.blackjack.status, undefined);
  assert.equal(appConfig.storage.local.playerGameSettings, 'huhe.playerGameSettings');
  assert.equal(appConfig.games['video-poker-deuces-wild'].version, '0.5');
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

test('lobby consolidates video poker variants behind one selector', () => {
  assert.match(indexSource, /id="videoPokerLobbyVariant"/);
  assert.match(indexSource, /option value="video-poker-jacks-or-better"/);
  assert.match(indexSource, /option value="video-poker-deuces-wild"/);
  assert.match(indexSource, /function selectedVideoPokerGameId\(\)/);
  assert.doesNotMatch(indexSource, /id="(?:vp|dw)Lobby(?:Play|Rules|Strategy|Version)"/);
});

test('runtime scripts are cache-busted to prevent mixed app versions', () => {
  const escapedVersion = appConfig.appVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(indexSource, new RegExp(`app-config\\.js\\?v=${escapedVersion}`));
  assert.match(indexSource, new RegExp(`game-logic\\.js\\?v=${escapedVersion}`));
  assert.match(indexSource, new RegExp(`app\\.js\\?v=${escapedVersion}`));
  const workerSource = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  assert.match(workerSource, /NETWORK_FIRST_ASSETS/);
  assert.match(workerSource, /game-logic\.js/);
});

test('inline application scripts parse successfully', () => {
  const scripts = Array.from(indexSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g), match=>match[1]).filter(source=>source.trim());
  scripts.forEach(source=>assert.doesNotThrow(()=>new Function(source)));
});

test('blackjack offers each supported physical shoe size', () => {
  const select = indexSource.match(/<select id="bjDecks"[\s\S]*?<\/select>/)?.[0] || '';
  for(const decks of [1, 2, 4, 6, 8]){
    assert.match(select, new RegExp(`<option value="${decks}">${decks}<\\/option>`));
  }
  assert.match(indexSource, /\[1,2,4,6,8\]\.includes\(selectedDecks\)/);
});

test('blackjack offers 3:2 and 6:5 natural payout rules', () => {
  const select = indexSource.match(/<select id="bjBlackjackPayout"[\s\S]*?<\/select>/)?.[0] || '';
  assert.match(select, /<option value="3:2">3:2<\/option>/);
  assert.match(select, /<option value="6:5">6:5<\/option>/);
});

test('blackjack wins animate matching payout chips from dealer to player', () => {
  assert.match(indexSource, /function bjAnimateWinPayout\(amount\)/);
  assert.match(indexSource, /function bjBreakdownChips\(amount\)/);
  assert.match(indexSource, /const parts = bjBreakdownChips\(amount\)/);
  assert.match(indexSource, /bjAnimateChips\(bjEls\.potDealer, bjEls\.potPlayer, winnings\)/);
  assert.match(indexSource, /bjAnimateWinPayout\(net\)/);
  assert.match(indexSource, /bjAnimateWinPayout\(totalNet\)/);
});

test('player stats queries use the selected game so blackjack sessions remain visible', () => {
  assert.match(indexSource, /async function getSessions\(player, gameId=CURRENT_GAME_ID\)/);
  assert.match(indexSource, /openStatsModal\(playerOverride, selectedGameId\)/);
  assert.match(indexSource, /deletePlayer\(selected, selectedGameId\)/);
  assert.match(indexSource, /\(row\.gameId \|\| CURRENT_GAME_ID\) === gameId/);
});

test('blackjack player stats use relevant round, profit, wager, and decision metrics', () => {
  assert.match(indexSource, /const isBlackjackStats = gameId === 'blackjack'/);
  assert.match(indexSource, /Total Profit[\s\S]*?Total Rounds[\s\S]*?Round Record \(W-L-P\)[\s\S]*?Amount Wagered[\s\S]*?Strategy Accuracy/);
  assert.match(indexSource, /\$\{totalFollowed\}\/\$\{totalDecisions\}/);
  assert.match(indexSource, /Avg Profit \/ Round/);
  assert.match(indexSource, /Return on Wagers/);
});

test('game and wager settings persist per player and per game', () => {
  assert.match(indexSource, /const PLAYER_GAME_SETTING_FIELDS = \{/);
  assert.match(indexSource, /function savePlayerGameSettings\(gameId, playerName=activeSettingsPlayer\(\)\)/);
  assert.match(indexSource, /function restorePlayerGameSettings\(gameId, playerName\)/);
  assert.match(indexSource, /savePlayerGameSettings\(vpGame\(\)\.id\)/);
  assert.match(indexSource, /savePlayerGameSettings\(BLACKJACK_GAME_ID\)/);
  assert.match(indexSource, /restorePlayerGameSettings\(selectedGameId, name\);[\s\S]*?window\.activateGame\(selectedGameId\)/);
});

test('mobile game setup appears before play and moves below after session start', () => {
  assert.match(indexSource, /\.vp-panel\{order:0;\}/);
  assert.match(indexSource, /\.bj-panel\{order:0;\}/);
  assert.match(indexSource, /\.vp-screen\.session-started \.vp-panel\{order:2;\}/);
  assert.match(indexSource, /\.bj-screen\.session-started \.bj-panel\{order:2;\}/);
  assert.match(indexSource, /classList\.toggle\('session-started', vp\.started\)/);
  assert.match(indexSource, /classList\.toggle\('session-started', bj\.started\)/);
});

test('lobby artwork keeps card ranks and suits contained and uses the simplified brand emblem', () => {
  assert.match(indexSource, /class="brand-emblem"/);
  assert.doesNotMatch(indexSource, /class="brand-chip"/);
  assert.match(indexSource, /class="lobby-card-rank">10<\/span><span class="lobby-card-suit">♠/);
  assert.match(indexSource, /\.lobby-mini-card\{[^}]*overflow:hidden;/);
});

test('blackjack totals handle soft hands and multiple aces', () => {
  assert.deepEqual(logic.blackjackTotal([card('A','c'), card('6','d')]), {total:17, soft:true});
  assert.deepEqual(logic.blackjackTotal([card('A','c'), card('A','d'), card('9','h')]), {total:21, soft:true});
  assert.deepEqual(logic.blackjackTotal([card('A','c'), card('A','d'), card('9','h'), card('K','s')]), {total:21, soft:false});
  assert.equal(logic.blackjackTotal([card('K','c'), card('Q','d'), card('2','h')]).total, 22);
});

test('blackjack recognizes naturals but not a split-hand 21', () => {
  assert.equal(logic.blackjackIsNatural({cards:[card('A','c'), card('K','d')], split:false}), true);
  assert.equal(logic.blackjackIsNatural({cards:[card('A','c'), card('K','d')], split:true}), false);
  assert.equal(logic.blackjackIsNatural({cards:[card('7','c'), card('7','d'), card('7','h')], split:false}), false);
});

test('blackjack wager eligibility enforces bankroll and table rules', () => {
  const pair = {cards:[card('8','c'), card('8','d')], bet:20, split:false, splitAces:false, doubled:false};
  assert.equal(logic.blackjackCanPlaceBet(19, 20), false);
  assert.equal(logic.blackjackCanPlaceBet(20, 20), true);
  assert.equal(logic.blackjackCanPlaceBet(100, 0), false);
  assert.equal(logic.blackjackCanSplit(pair, 3, 20), true);
  assert.equal(logic.blackjackCanSplit(pair, 4, 20), false);
  assert.equal(logic.blackjackCanSplit(pair, 3, 19), false);
  assert.equal(logic.blackjackCanDouble(pair, 20, {das:true}), true);
  assert.equal(logic.blackjackCanDouble({...pair, split:true}, 20, {das:false}), false);
  assert.equal(logic.blackjackCanDouble({...pair, split:true, splitAces:true}, 20, {das:true}), false);
  assert.equal(logic.blackjackCanSurrender(pair, {surrender:true}), true);
  assert.equal(logic.blackjackCanSurrender({...pair, split:true}, {surrender:true}), false);
});

test('blackjack dealer logic respects S17 and H17', () => {
  const soft17 = [card('A','c'), card('6','d')];
  assert.equal(logic.blackjackShouldDealerHit(soft17, {soft17:'stand'}), false);
  assert.equal(logic.blackjackShouldDealerHit(soft17, {soft17:'hit'}), true);
  assert.equal(logic.blackjackShouldDealerHit([card('T','c'), card('6','d')], {soft17:'hit'}), true);
  assert.equal(logic.blackjackShouldDealerHit([card('T','c'), card('7','d')], {soft17:'hit'}), false);
});

test('blackjack dealer outcome probabilities use visible composition and American peek', () => {
  const up = card('A','s');
  const visible = [up, card('8','c'), card('8','d')];
  const rules = {decks:6, soft17:'hit'};
  const peeked = logic.blackjackDealerOutcomeProbabilities({dealerUpCard:up, visibleCards:visible, rules, peeked:true});
  const unpeeked = logic.blackjackDealerOutcomeProbabilities({dealerUpCard:up, visibleCards:visible, rules, peeked:false});
  assert.ok(Math.abs(Object.values(peeked).reduce((sum,value)=>sum+value,0) - 1) < 1e-12);
  assert.ok(peeked.bust > 0 && peeked[17] > 0 && peeked[21] > 0);
  assert.ok(peeked[21] < unpeeked[21]);
  const oneEight = logic.blackjackDealerOutcomeProbabilities({dealerUpCard:up, visibleCards:visible.slice(0,2), rules, peeked:true});
  assert.notEqual(peeked[18], oneEight[18]);
});

test('blackjack initial-decision EV lookup covers compositions and exact supported rules', () => {
  const rules = {decks:6, soft17:'hit', das:true, surrender:true, blackjackPayout:'3:2'};
  const eights = {cards:[card('8','c'),card('8','d')], split:false};
  const pairEv = logic.blackjackInitialDecisionEv(eights,card('T','s'),rules);
  assert.deepEqual(pairEv, {stand:-0.536853, hit:-0.535361, double:-1.070722, split:-0.475385, surrender:-0.5});
  const noDas = logic.blackjackInitialDecisionEv(eights,card('T','s'),{...rules,das:false});
  assert.equal(noDas.split,-0.486276);
  const mixed = logic.blackjackInitialDecisionEv({cards:[card('A','c'),card('2','d')],split:false},card('A','s'),rules);
  assert.deepEqual(mixed, {stand:-0.597220, hit:-0.100433, double:-0.584256, surrender:-0.5});
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('T','s'),{...rules,decks:3}),null);
  assert.equal(logic.blackjackInitialDecisionEv({...eights,split:true},card('T','s'),rules),null);
  const s17 = {...rules,soft17:'stand'};
  assert.equal(logic.blackjackInitialEvSupported(s17),true);
  const s17Pair = logic.blackjackInitialDecisionEv(eights,card('6','s'),s17);
  assert.deepEqual(s17Pair, {stand:-0.157495, hit:-0.425486, double:-0.850971, split:0.405899, surrender:-0.5});
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...s17,das:false}).split,0.292983);
  const eightDeckS17 = {...s17,decks:8};
  assert.equal(logic.blackjackInitialEvSupported(eightDeckS17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),eightDeckS17), {
    stand:-0.156536, hit:-0.426855, double:-0.853711, split:0.406860, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...eightDeckS17,das:false}).split,0.294064);
  const eightDeckH17 = {...rules,decks:8};
  assert.equal(logic.blackjackInitialEvSupported(eightDeckH17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),eightDeckH17), {
    stand:-0.123902, hit:-0.438879, double:-0.877758, split:0.374948, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...eightDeckH17,das:false}).split,0.261636);
  const fourDeckS17 = {...s17,decks:4};
  assert.equal(logic.blackjackInitialEvSupported(fourDeckS17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),fourDeckS17), {
    stand:-0.159434, hit:-0.422727, double:-0.845454, split:0.403949, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...fourDeckS17,das:false}).split,0.290792);
  const fourDeckH17 = {...rules,decks:4};
  assert.equal(logic.blackjackInitialEvSupported(fourDeckH17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),fourDeckH17), {
    stand:-0.126803, hit:-0.434843, double:-0.869686, split:0.371721, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...fourDeckH17,das:false}).split,0.257753);
  const twoDeckS17 = {...s17,decks:2};
  assert.equal(logic.blackjackInitialEvSupported(twoDeckS17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),twoDeckS17), {
    stand:-0.165417, hit:-0.414294, double:-0.828588, split:0.397872, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...twoDeckS17,das:false}).split,0.283990);
  const twoDeckH17 = {...rules,decks:2};
  assert.equal(logic.blackjackInitialEvSupported(twoDeckH17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),twoDeckH17), {
    stand:-0.132803, hit:-0.426598, double:-0.853196, split:0.365032, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...twoDeckH17,das:false}).split,0.249727);
  const oneDeckS17 = {...s17,decks:1};
  assert.equal(logic.blackjackInitialEvSupported(oneDeckS17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),oneDeckS17), {
    stand:-0.178171, hit:-0.396692, double:-0.793384, split:0.385156, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...oneDeckS17,das:false}).split,0.269350);
  const oneDeckH17 = {...rules,decks:1};
  assert.equal(logic.blackjackInitialEvSupported(oneDeckH17),true);
  assert.deepEqual(logic.blackjackInitialDecisionEv(eights,card('6','s'),oneDeckH17), {
    stand:-0.145647, hit:-0.409377, double:-0.818754, split:0.350700, surrender:-0.5
  });
  assert.equal(logic.blackjackInitialDecisionEv(eights,card('6','s'),{...oneDeckH17,das:false}).split,0.232605);
});

test('blackjack coaching UI exposes dealer probabilities and live EV controls', () => {
  assert.match(indexSource, /\.bj-table\{[^}]*border-radius:14px 14px 50% 50% \/ 14px 14px 22% 22%/);
  assert.match(indexSource, /id="bjShowDealerProbabilities"/);
  assert.match(indexSource, /id="bjShowActionEv"/);
  assert.match(indexSource, /id="bjDealerProbabilities"/);
  assert.match(indexSource, /const chartMax = Math\.max\([^;]+\) \* 1\.05/);
  assert.match(indexSource, /const barPercent=Math\.min\(100,\(value\/chartMax\)\*100\)\.toFixed\(1\)/);
  assert.match(indexSource, /class="bj-dealer-probability-bar" style="--bj-probability:\$\{barPercent\}%"/);
  assert.match(indexSource, /\.bj-dealer-probability-bar::before\{[^}]*width:var\(--bj-probability,0%\)/);
  assert.match(indexSource, /Uses this round's face-up cards only/);
  assert.match(indexSource, /Calculated from this round's face-up cards and current rules/);
  assert.match(indexSource, /new Worker\('blackjack-ev-worker\.js\?v=/);
  assert.match(indexSource, /const immediate = HUHELogic\.blackjackInitialDecisionEv/);
  assert.match(indexSource, /bj\.evWorker\.addEventListener\('error'/);
  assert.match(indexSource, /bjRunEvFallback/);
  assert.match(indexSource, /},10000\)/);
  assert.match(indexSource, /function bjInvalidateActionEvs\(\)/);
  assert.match(indexSource, /bjTrackDecision\(finalAction\);\s*bjInvalidateActionEvs\(\);\s*if\(finalAction === 'hit'\)/);
  assert.match(indexSource, /blackjackCanPlaceBet[\s\S]*?bjInvalidateActionEvs\(\);\s*bjHideResultFlash\(\)/);
  assert.match(indexSource, /const laterDecision = !!\(hand\.split \|\| hand\.cards\.length > 2\)/);
  assert.match(indexSource, /laterDecision[\s\S]*?HUHELogic\.blackjackActionEvs\(request\.input\)/);
});

test('blackjack live EV engine matches supplied compositions and supports later decisions', () => {
  const rules = {decks:6, soft17:'hit', das:true, surrender:true, blackjackPayout:'3:2'};
  const evaluate = (cards,dealer,extra={}) => {
    const hand = {cards, status:'active', split:false, splitAces:false, doubled:false, ...extra};
    return logic.blackjackActionEvs({hand,dealerUpCard:dealer,visibleCards:[dealer,...cards],rules,handCount:1,peeked:true});
  };
  const pair = evaluate([card('8','c'),card('8','d')],card('T','s'));
  assert.ok(Math.abs(pair.stand - (-0.536853)) < 0.000001);
  assert.ok(Math.abs(pair.hit - (-0.535361)) < 0.000001);
  assert.ok(Math.abs(pair.double - (-1.070722)) < 0.000001);
  assert.equal(pair.split,-0.475385);
  assert.equal(pair.surrender,-0.5);
  const soft = evaluate([card('A','c'),card('2','d')],card('A','s'));
  assert.ok(Math.abs(soft.stand - (-0.597220)) < 0.000001);
  assert.ok(Math.abs(soft.hit - (-0.100433)) < 0.000001);
  assert.ok(Math.abs(soft.double - (-0.584256)) < 0.000001);
  const later = evaluate([card('9','c'),card('2','d'),card('5','h')],card('6','s'));
  assert.deepEqual(Object.keys(later).sort(),['hit','stand']);
  assert.ok(later.stand > later.hit);
  const opening = logic.blackjackInitialDecisionEv(
    {cards:[card('9','c'),card('2','d')],status:'active',split:false},card('6','s'),rules
  );
  assert.notEqual(later.stand,opening.stand);
  assert.notEqual(later.hit,opening.hit);
  const alternate = logic.blackjackActionEvs({
    hand:{cards:[card('6','c'),card('5','d')],status:'active',split:false,splitAces:false,doubled:false},
    dealerUpCard:card('6','s'),visibleCards:[card('6','s'),card('6','c'),card('5','d')],
    rules:{decks:1,soft17:'stand',das:false,surrender:false,blackjackPayout:'6:5'},handCount:1,peeked:true
  });
  assert.ok(alternate.double > alternate.hit);
});

test('blackjack house edge matches Wizard cut-card and CSM results', () => {
  const base = {decks:6, soft17:'stand', das:true, surrender:false, blackjackPayout:'3:2'};
  assert.ok(Math.abs(logic.blackjackHouseEdge({...base, csm:false}) - 0.426215) < 1e-9);
  assert.ok(Math.abs(logic.blackjackHouseEdge({...base, csm:true}) - 0.406215) < 1e-9);
  assert.ok(Math.abs(logic.blackjackHouseEdge({...base, blackjackPayout:'6:5'}) - 1.785905) < 1e-9);
  assert.ok(Math.abs(logic.blackjackHouseEdge({decks:1, soft17:'stand', das:true, surrender:false}) - (-0.031195)) < 1e-9);
});

test('blackjack basic strategy changes with deck count and table rules', () => {
  const code = (section, value, up, rules) => logic.blackjackBasicStrategyCode(section, value, up, rules);
  assert.equal(code('hard', 11, 11, {decks:1, soft17:'stand', das:true}), 'D/H');
  assert.equal(code('hard', 11, 11, {decks:6, soft17:'stand', das:true}), 'H');
  assert.equal(code('hard', 11, 11, {decks:6, soft17:'hit', das:true}), 'D/H');
  assert.equal(code('pair', 6, 2, {decks:6, soft17:'stand', das:true}), 'P');
  assert.equal(code('pair', 6, 2, {decks:6, soft17:'stand', das:false}), 'H');
  assert.equal(code('hard', 15, 10, {decks:6, soft17:'stand', das:true, surrender:true}), 'R/H');
  assert.equal(code('hard', 15, 10, {decks:6, soft17:'stand', das:true, surrender:false}), 'H');
});

test('blackjack surrender strategy distinguishes soft totals, pairs, S17, and H17', () => {
  const hand = cards => ({cards, bet:10, status:'active', split:false, splitAces:false, doubled:false});
  const advice = (cards, dealer, soft17) => logic.blackjackAdvice({hand:hand(cards), dealerUpCard:card(dealer,'s'), rules:{soft17, das:true, surrender:true}, bank:100, handCount:1}).action;
  assert.equal(advice([card('A','c'), card('5','d')], 'A', 'hit'), 'hit');
  assert.equal(advice([card('8','c'), card('8','d')], 'T', 'stand'), 'split');
  assert.equal(advice([card('8','c'), card('8','d')], 'A', 'hit'), 'surrender');
  assert.equal(advice([card('T','c'), card('6','d')], 'A', 'stand'), 'surrender');
  assert.equal(advice([card('T','c'), card('5','d')], 'T', 'stand'), 'surrender');
  assert.equal(advice([card('T','c'), card('7','d')], 'A', 'hit'), 'surrender');
  const eights = hand([card('8','c'), card('8','d')]);
  assert.equal(logic.blackjackAdvice({hand:eights, dealerUpCard:card('T','s'), rules:{decks:6, soft17:'stand', das:true, surrender:true}, bank:0, handCount:1}).action, 'surrender');
});

test('blackjack natural payouts return the original wager plus winnings', () => {
  const natural = {cards:[card('A','c'), card('K','d')], split:false};
  assert.deepEqual(logic.blackjackNaturalOutcome(natural, [card('9','c'), card('7','d')], 10), {returned:25, net:15, label:'Blackjack pays 3:2'});
  assert.deepEqual(logic.blackjackNaturalOutcome(natural, [card('9','c'), card('7','d')], 10, '6:5'), {returned:22, net:12, label:'Blackjack pays 6:5'});
  assert.deepEqual(logic.blackjackNaturalOutcome(natural, [card('A','h'), card('T','s')], 10), {returned:10, net:0, label:'Blackjack push'});
  assert.deepEqual(logic.blackjackNaturalOutcome({cards:[card('T','c'), card('9','d')], split:false}, [card('A','h'), card('T','s')], 10), {returned:0, net:-10, label:'Dealer blackjack'});
});

test('blackjack settlement covers wins, pushes, doubles, busts, and surrender', () => {
  const dealer20 = [card('K','c'), card('Q','d')];
  assert.deepEqual(logic.blackjackSettleHand({cards:[card('T','h'), card('A','s')], bet:10, status:'stand'}, dealer20), {returned:20, net:10, label:'Win', playerTotal:21, dealerTotal:20});
  assert.equal(logic.blackjackSettleHand({cards:[card('K','h'), card('Q','s')], bet:10, status:'stand'}, dealer20).net, 0);
  assert.equal(logic.blackjackSettleHand({cards:[card('T','h'), card('9','s')], bet:20, status:'stand', doubled:true}, dealer20).net, -20);
  assert.equal(logic.blackjackSettleHand({cards:[card('K','h'), card('Q','s'), card('2','c')], bet:10, status:'bust'}, dealer20).label, 'Bust');
  assert.deepEqual(logic.blackjackSettleHand({cards:[card('T','h'), card('6','s')], bet:10, status:'surrender'}, dealer20), {returned:5, net:-5, label:'Surrender', playerTotal:16, dealerTotal:20});
});

test('blackjack split hands settle independently', () => {
  const dealer = [card('T','c'), card('8','d')];
  const first = logic.blackjackSettleHand({cards:[card('8','c'), card('K','h')], bet:10, status:'stand', split:true}, dealer);
  const second = logic.blackjackSettleHand({cards:[card('8','s'), card('3','h'), card('T','d')], bet:10, status:'stand', split:true}, dealer);
  assert.equal(first.net, 0);
  assert.equal(second.net, 10);
  assert.equal(first.net + second.net, 10);
});

test('blackjack blocks session exit until the active round resolves', () => {
  assert.equal(logic.blackjackCanExitRound('ready', false), true);
  assert.equal(logic.blackjackCanExitRound('complete', false), true);
  assert.equal(logic.blackjackCanExitRound('player', false), false);
  assert.equal(logic.blackjackCanExitRound('dealer', true), false);
  assert.equal(logic.blackjackCanExitRound('complete', true), false);
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
