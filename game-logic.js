(function(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
  }else{
    root.HUHELogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const RANKS = "23456789TJQKA";
  const SUITS = "cdhs";

  const TRIPS_PAY = {royal_flush:100, straight_flush:40, four_kind:30, full_house:8, flush:7, straight:4, three_kind:3};
  const BLIND_WIN_PAY = {royal_flush:500, straight_flush:50, four_kind:10, full_house:3, flush:1.5, straight:1};
  const BAD_BEAT_PAY = {royal_flush:500, straight_flush:500, four_kind:25, full_house:6, flush:5, straight:4};
  const POCKET_PAY = {pair_aces:25, ace_face_suited:20, ace_face_off:10, other_pair:4};

  function handRank7(cards){
    const ranks = cards.map(c => c % 13);
    const suits = cards.map(c => Math.floor(c / 13));
    const countByRank = new Map();
    ranks.forEach(r => countByRank.set(r, (countByRank.get(r) || 0) + 1));
    const suitCount = new Map();
    suits.forEach(s => suitCount.set(s, (suitCount.get(s) || 0) + 1));
    let flushSuit = null;
    for(const [s, c] of suitCount){
      if(c >= 5){ flushSuit = s; break; }
    }
    function bestStraight(rl){
      let u = Array.from(new Set(rl)).sort((a, b) => a - b);
      if(u.includes(12)) u = [-1, ...u];
      let run = 1, best = null;
      for(let i = 1; i < u.length; i++){
        if(u[i] - u[i - 1] === 1){
          run++;
          if(run >= 5) best = u[i];
        }else if(u[i] !== u[i - 1]){
          run = 1;
        }
      }
      if(best === null) return null;
      if(best === -1) return [3, 2, 1, 0, -1];
      return [best, best - 1, best - 2, best - 3, best - 4];
    }
    if(flushSuit !== null){
      const suited = ranks.filter((r, i) => suits[i] === flushSuit);
      const sf = bestStraight(suited);
      if(sf){
        const tb = sf.map(x => x === 12 ? 14 : (x === -1 ? 1 : x + 2));
        return [8, tb];
      }
    }
    const groups = Array.from(countByRank.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    if(flushSuit !== null){
      const fr = ranks.filter((r, i) => suits[i] === flushSuit).sort((a, b) => b - a).slice(0, 5);
      return [5, fr.map(r => r + 2)];
    }
    const st = bestStraight(ranks);
    if(st){
      const tb = st.map(x => x === 12 ? 14 : (x === -1 ? 1 : x + 2));
      return [4, tb];
    }
    if(groups[0][1] === 4){
      const four = groups[0][0];
      const kick = ranks.filter(r => r !== four).sort((a, b) => b - a)[0];
      return [7, [four + 2, kick + 2]];
    }
    if(groups[0][1] === 3){
      const trips = groups[0][0];
      const pair = groups.slice(1).find(g => g[1] >= 2);
      if(pair) return [6, [trips + 2, pair[0] + 2]];
    }
    if(groups[0][1] === 3){
      const trips = groups[0][0];
      const kicks = ranks.filter(r => r !== trips).sort((a, b) => b - a).slice(0, 2);
      return [3, [trips + 2, ...kicks.map(k => k + 2)]];
    }
    const pairs = groups.filter(g => g[1] === 2).map(g => g[0]);
    if(pairs.length >= 2){
      const [hi, lo] = pairs.slice(0, 2);
      const kick = ranks.filter(r => r !== hi && r !== lo).sort((a, b) => b - a)[0];
      return [2, [hi + 2, lo + 2, kick + 2]];
    }
    if(pairs.length === 1){
      const p = pairs[0];
      const ks = ranks.filter(r => r !== p).sort((a, b) => b - a).slice(0, 3);
      return [1, [p + 2, ...ks.map(k => k + 2)]];
    }
    const top5 = ranks.sort((a, b) => b - a).slice(0, 5);
    return [0, top5.map(r => r + 2)];
  }

  function classify(rc, tb){
    const map = {8:"straight_flush", 7:"four_kind", 6:"full_house", 5:"flush", 4:"straight", 3:"three_kind", 2:"two_pair", 1:"one_pair", 0:"high_card"};
    const label = map[rc];
    if(label === "straight_flush" && Math.max(...tb) === 14 && Math.min(...tb) >= 10) return "royal_flush";
    return label;
  }

  function compareHands(a, b){
    if(a[0] !== b[0]) return a[0] - b[0];
    const A = a[1], B = b[1];
    for(let i = 0; i < Math.min(A.length, B.length); i++){
      if(A[i] !== B[i]) return A[i] - B[i];
    }
    return 0;
  }

  function handEval(cards){
    const r = handRank7(cards);
    return {rank:r[0], tie:r[1], cls:classify(r[0], r[1])};
  }

  function pocketBonusPayout(hole, wager){
    const r0 = RANKS[hole[0] % 13], r1 = RANKS[hole[1] % 13];
    const s0 = SUITS[Math.floor(hole[0] / 13)], s1 = SUITS[Math.floor(hole[1] / 13)];
    const pair = r0 === r1;
    const hasAce = r0 === 'A' || r1 === 'A';
    const otherRank = hasAce ? (r0 === 'A' ? r1 : r0) : null;
    const suited = s0 === s1;
    if(wager <= 0) return 0;
    if(pair && r0 === 'A') return wager * (POCKET_PAY.pair_aces + 1);
    if(pair && r0 !== 'A') return wager * (POCKET_PAY.other_pair + 1);
    if(hasAce && otherRank && ['K', 'Q', 'J'].includes(otherRank) && suited) return wager * (POCKET_PAY.ace_face_suited + 1);
    if(hasAce && otherRank && ['K', 'Q', 'J'].includes(otherRank) && !suited) return wager * (POCKET_PAY.ace_face_off + 1);
    return 0;
  }

  function best5HoleInRank(hole, board){
    if(hole.length !== 2 || board.length !== 5) return false;
    const all = [hole[0], hole[1], board[0], board[1], board[2], board[3], board[4]];
    const best = handRank7(all);
    const rc = best[0];
    for(let i = 0; i < 7; i++){
      for(let j = i + 1; j < 7; j++){
        const subset = [];
        for(let k = 0; k < 7; k++) if(k !== i && k !== j) subset.push(all[k]);
        const hr = handRank7(subset);
        if(compareHands(hr, best) !== 0) continue;
        const includesHole = subset.includes(hole[0]) || subset.includes(hole[1]);
        if(!includesHole) continue;
        const tb = hr[1];
        switch(rc){
          case 1: {
            const p = tb[0] - 2;
            if((hole[0] % 13 === p && subset.includes(hole[0])) || (hole[1] % 13 === p && subset.includes(hole[1]))) return true;
            break;
          }
          case 2: {
            const p1 = tb[0] - 2, p2 = tb[1] - 2;
            if((subset.includes(hole[0]) && (hole[0] % 13 === p1 || hole[0] % 13 === p2)) ||
               (subset.includes(hole[1]) && (hole[1] % 13 === p1 || hole[1] % 13 === p2))) return true;
            break;
          }
          case 3: {
            const t = tb[0] - 2;
            if((hole[0] % 13 === t && subset.includes(hole[0])) || (hole[1] % 13 === t && subset.includes(hole[1]))) return true;
            break;
          }
          case 4:
          case 5:
          case 8:
            return true;
          case 6: {
            const t = tb[0] - 2, p = tb[1] - 2;
            if((subset.includes(hole[0]) && (hole[0] % 13 === t || hole[0] % 13 === p)) ||
               (subset.includes(hole[1]) && (hole[1] % 13 === t || hole[1] % 13 === p))) return true;
            break;
          }
          case 7: {
            const q = tb[0] - 2;
            if((hole[0] % 13 === q && subset.includes(hole[0])) || (hole[1] % 13 === q && subset.includes(hole[1]))) return true;
            break;
          }
        }
      }
    }
    return false;
  }

  function dealerOutsDetailed(hole, board){
    if(board.length !== 5 || hole.length !== 2) return {win:0, tie:0};
    const used = new Array(52).fill(false);
    for(const c of hole) used[c] = true;
    for(const c of board) used[c] = true;
    const deck = [];
    for(let i = 0; i < 52; i++) if(!used[i]) deck.push(i);
    const pe = handEval([hole[0], hole[1], ...board]);
    function bestWithOneHole(x){
      let best = null;
      for(let omit = 0; omit < 5; omit++){
        const set = [x];
        for(let i = 0; i < 5; i++) if(i !== omit) set.push(board[i]);
        const hr = handRank7(set);
        if(!best || compareHands(hr, best) > 0) best = hr;
      }
      return best;
    }
    let win = 0, tie = 0;
    for(const x of deck){
      const de = bestWithOneHole(x);
      const cmp = compareHands([pe.rank, pe.tie], de);
      if(cmp < 0) win++;
      else if(cmp === 0) tie++;
    }
    return {win, tie};
  }

  function riverWoORuleDecision({player, board}){
    if(board.length !== 5) return {action:'fold', why:'River not reached'};
    const pe = handEval([player[0], player[1], ...board]);
    const involvesHole = best5HoleInRank(player, board);
    if(pe.rank >= 2 && involvesHole) return {action:'call1', why:'Two pair+ using hole card'};
    if(pe.rank === 1 && involvesHole) return {action:'call1', why:'Hidden pair'};
    const d = dealerOutsDetailed(player, board);
    const eff = d.win + d.tie * 0.5;
    const outsStr = `${eff.toFixed(1)} [${d.win} win, ${d.tie} tie]`;
    if(eff < 21) return {action:'call1', why:`Dealer outs to beat: ${outsStr} (<21)`};
    return {action:'fold', why:`Dealer outs to beat: ${outsStr} (>=21)`};
  }

  function rankLabel(rankIndexValue){
    return rankIndexValue === 8 ? '10' : RANKS[rankIndexValue];
  }

  function preflopCheckWhy(hole){
    const rA = hole[0] % 13, rB = hole[1] % 13;
    const sA = Math.floor(hole[0] / 13), sB = Math.floor(hole[1] / 13);
    const high = Math.max(rA, rB), low = Math.min(rA, rB);
    const suited = sA === sB;
    const handText = `${rankLabel(high)}${rankLabel(low)} ${suited ? 'suited' : 'offsuit'}`;
    if(rA === rB){
      return `Your ${rankLabel(rA)}${rankLabel(rB)} is below the pair threshold: raise 3x with pairs 33+, but check pocket 22.`;
    }
    if(high === 11){
      return `Your ${handText} is below the K threshold: raise 3x with K suited 5+ or K offsuit 7+.`;
    }
    if(high === 10){
      return `Your ${handText} is below the Q threshold: raise 3x with Q suited 8+ or Q offsuit 10+.`;
    }
    if(high === 9){
      return `Your ${handText} is below the J threshold: raise 3x only with J suited 10+.`;
    }
    return `Your ${handText} is outside the 3x preflop range: pairs 33+, any A, K suited 5+/offsuit 7+, Q suited 8+/offsuit 10+, or J suited 10+.`;
  }

  function preflopAction(hole){
    const rA = hole[0] % 13, rB = hole[1] % 13;
    const sA = Math.floor(hole[0] / 13), sB = Math.floor(hole[1] / 13);
    const high = Math.max(rA, rB), low = Math.min(rA, rB);
    const suited = sA === sB;
    const isPair = rA === rB, isAce = rA === 12 || rB === 12, isK = rA === 11 || rB === 11, isQ = rA === 10 || rB === 10, isJ = rA === 9 || rB === 9;
    if(isPair && rA !== 0) return {action:'raise3', why:'Any pair except 22'};
    if(isAce) return {action:'raise3', why:'Ace with any other card'};
    if(isK && ((suited && low >= 3) || (!suited && low >= 5))) return {action:'raise3', why:suited ? 'K with suited 5+' : 'K with offsuit 7+'};
    if(isQ && ((suited && low >= 6) || (!suited && low >= 8))) return {action:'raise3', why:suited ? 'Q with suited 8+' : 'Q with offsuit 10+'};
    if(isJ && suited && low >= 8) return {action:'raise3', why:'J with suited 10+'};
    return {action:'check', why:preflopCheckWhy(hole)};
  }

  function flopAction(hole, flop){
    const rA = hole[0] % 13, rB = hole[1] % 13;
    const sA = Math.floor(hole[0] / 13), sB = Math.floor(hole[1] / 13);
    const peNow = handEval([hole[0], hole[1], flop[0], flop[1], flop[2]]);
    const twoPairOrBetter = peNow.rank >= 2;
    let hiddenPair = false;
    if(peNow.rank === 1){
      const rc = new Array(13).fill(0);
      [rA, rB, flop[0] % 13, flop[1] % 13, flop[2] % 13].forEach(r => rc[r]++);
      const pairRank = rc.findIndex(c => c === 2);
      const matchesA = rA === pairRank, matchesB = rB === pairRank;
      if(matchesA || matchesB){
        const isPocket = rA === rB && rA === pairRank;
        hiddenPair = !(isPocket && pairRank === 0);
      }
    }
    const sc = [0, 0, 0, 0];
    [sA, sB, Math.floor(flop[0] / 13), Math.floor(flop[1] / 13), Math.floor(flop[2] / 13)].forEach(s => sc[s]++);
    let fourFlushWithTPlus = false;
    for(let suit = 0; suit < 4; suit++){
      if(sc[suit] >= 4 && ((sA === suit && rA >= 8) || (sB === suit && rB >= 8))){
        fourFlushWithTPlus = true;
        break;
      }
    }
    if(twoPairOrBetter || hiddenPair || fourFlushWithTPlus){
      const why = [];
      if(twoPairOrBetter) why.push('Two pair or better');
      if(hiddenPair) why.push('Hidden pair (not 22)');
      if(fourFlushWithTPlus) why.push('Four-flush with T+ in hand');
      return {action:'raise2', why:why.join(' / ')};
    }
    return {action:'check', why:'No 2-pair+, hidden pair (not 22), or 4-flush+T'};
  }

  function computeAdvice({stage, player, board, playMult = 0}){
    if(!player || player.length < 2) return {stage:'Waiting', action:'-', why:'No hand yet'};
    if(stage === 'preflop'){
      const rec = preflopAction(player);
      return {stage:'Preflop', action:rec.action === 'raise3' ? 'Raise 3x' : 'Check', why:rec.why};
    }
    if(stage === 'flop' && playMult === 0 && board.length >= 3){
      const rec = flopAction(player, board.slice(0, 3));
      return {stage:'Flop', action:rec.action === 'raise2' ? 'Raise 2x' : 'Check', why:rec.why};
    }
    if((stage === 'river' || stage === 'showdown') && playMult === 0 && board.length === 5){
      const rec = riverWoORuleDecision({player, board});
      return {stage:'River', action:rec.action === 'call1' ? 'Call 1x' : 'Fold', why:rec.why};
    }
    return {stage:String(stage || '').replace(/^./, m => m.toUpperCase()), action:'-', why:'No advice (already raised or not applicable)'};
  }

  function recommendWoO({player, board, ante}){
    const pre = preflopAction(player).action;
    let flop = null, river = null;
    if(pre === 'check'){
      flop = flopAction(player, board.slice(0, 3)).action;
      if(flop === 'check'){
        if(board.length === 5) river = riverWoORuleDecision({player, board}).action;
        else {
          const peNow = handEval([...player, ...board]);
          const aceHigh = player[0] % 13 === 12 || player[1] % 13 === 12;
          river = (peNow.rank >= 1 || aceHigh) ? 'call1' : 'fold';
        }
      }
    }
    const recPlay = pre === 'raise3' ? ante * 3 : (flop === 'raise2' ? ante * 2 : (river === 'call1' ? ante : 0));
    const recFold = (pre === 'raise3' || flop === 'raise2') ? false : river === 'fold';
    return {preflop:pre, flop, river, recPlay, recFold};
  }

  function settleHypGeneric({player, pe, cmp, dealerQual, ante, blind, trips, pocket, playAmt, doFold}){
    const tripsPayH = TRIPS_PAY[pe.cls] ? trips * (TRIPS_PAY[pe.cls] + 1) : 0;
    const pocketPayH = pocket ? pocketBonusPayout(player, pocket) : 0;
    let AnteH = 0, BlindH = 0, PlayH = 0;
    if(doFold){
      AnteH = 0; PlayH = 0; BlindH = 0;
    }else if(cmp > 0){
      PlayH = playAmt > 0 ? playAmt * 2 : 0;
      AnteH = dealerQual ? ante * 2 : ante;
      BlindH = BLIND_WIN_PAY[pe.cls] ? blind * (BLIND_WIN_PAY[pe.cls] + 1) : blind;
    }else if(cmp < 0){
      PlayH = 0; AnteH = 0;
      BlindH = BAD_BEAT_PAY[pe.cls] ? blind * BAD_BEAT_PAY[pe.cls] : 0;
    }else{
      PlayH = playAmt > 0 ? playAmt : 0;
      AnteH = ante;
      BlindH = blind;
    }
    const NetH = AnteH + BlindH + PlayH + tripsPayH + pocketPayH;
    const investedH = ante + blind + (playAmt > 0 ? playAmt : 0) + (trips > 0 ? trips : 0) + (pocket > 0 ? pocket : 0);
    return {NetH, ProfitH:NetH - investedH};
  }

  function actionsFollowed(actions, rec){
    return (
      actions.preflop === rec.preflop &&
      (rec.preflop === 'raise3' || actions.flop === rec.flop) &&
      (rec.preflop === 'raise3' || rec.flop === 'raise2' || actions.river === rec.river)
    );
  }

  function settleHand({player, dealer, board, wagers, actions, anteValue}){
    const ante = wagers.Ante, blind = wagers.Blind, play = wagers.Play, trips = wagers.Trips, pocket = wagers.Pocket;
    const pe = handEval([...player, ...board]);
    const de = handEval([...dealer, ...board]);
    const cmp = compareHands([pe.rank, pe.tie], [de.rank, de.tie]);
    const dealerQual = de.rank >= 1;
    const tripsPay = TRIPS_PAY[pe.cls] ? trips * (TRIPS_PAY[pe.cls] + 1) : 0;
    const pocketPay = pocket ? pocketBonusPayout(player, pocket) : 0;
    let Ante = 0, Blind = 0, Play = 0;
    if(cmp > 0){
      Play = play > 0 ? play * 2 : 0;
      Ante = dealerQual ? ante * 2 : ante;
      Blind = BLIND_WIN_PAY[pe.cls] ? blind * (BLIND_WIN_PAY[pe.cls] + 1) : blind;
    }else if(cmp < 0){
      Play = 0; Ante = 0;
      Blind = BAD_BEAT_PAY[pe.cls] ? blind * BAD_BEAT_PAY[pe.cls] : 0;
    }else{
      Play = play > 0 ? play : 0;
      Ante = ante;
      Blind = blind;
    }
    const Net = Ante + Blind + Play + tripsPay + pocketPay;
    const invested = ante + blind + (play > 0 ? play : 0) + (trips > 0 ? trips : 0) + (pocket > 0 ? pocket : 0);
    const Profit = Net - invested;
    const anteNet = Ante - ante;
    const blindNet = Blind - blind;
    const playNet = Play - (play > 0 ? play : 0);
    const tripsNet = tripsPay - (trips > 0 ? trips : 0);
    const pocketNet = pocketPay - (pocket > 0 ? pocket : 0);
    const breakdown = {
      play:anteNet + blindNet + playNet,
      ante:anteNet,
      blind:blindNet,
      playBet:playNet,
      trips:tripsNet,
      pocket:pocketNet,
      betPlay:play > 0 ? play : 0,
      betAnte:ante,
      betBlind:blind,
      betTrips:trips > 0 ? trips : 0,
      betPocket:pocket > 0 ? pocket : 0,
      betTotal:invested
    };
    const betResults = {
      trips:{wager:trips > 0 ? trips : 0, returned:tripsPay, net:tripsNet},
      pocket:{wager:pocket > 0 ? pocket : 0, returned:pocketPay, net:pocketNet},
      ante:{wager:ante, returned:Ante, net:anteNet},
      odds:{wager:blind, returned:Blind, net:blindNet},
      play:{wager:play > 0 ? play : 0, returned:Play, net:playNet}
    };
    const rec = recommendWoO({player, board, ante:anteValue});
    const hyp = settleHypGeneric({player, pe, cmp, dealerQual, ante, blind, trips, pocket, playAmt:rec.recPlay, doFold:rec.recFold});
    const followed = actionsFollowed(actions, rec);
    return {
      playerNet:Net,
      pClass:pe.cls,
      dClass:de.cls,
      cmp,
      dealerQual,
      returns:{Ante, Blind, Play, tripsPay, pocketPay},
      profit:Profit,
      outcome:cmp > 0 ? 'win' : (cmp < 0 ? 'loss' : 'push'),
      breakdown,
      betResults,
      strategy:{followed, delta:hyp.ProfitH - Profit, hypProfit:hyp.ProfitH, rec}
    };
  }

  function settleFold({player, dealer, board, wagers, actions, anteValue}){
    const ante = wagers.Ante, blind = wagers.Blind, trips = wagers.Trips, pocket = wagers.Pocket;
    const pe = handEval([...player, ...board]);
    const de = handEval([...dealer, ...board]);
    const cmp = compareHands([pe.rank, pe.tie], [de.rank, de.tie]);
    const dealerQual = de.rank >= 1;
    const tripsPay = trips > 0 && TRIPS_PAY[pe.cls] ? trips * (TRIPS_PAY[pe.cls] + 1) : 0;
    const pocketPay = pocket > 0 ? pocketBonusPayout(player, pocket) : 0;
    const invested = ante + blind + (trips > 0 ? trips : 0) + (pocket > 0 ? pocket : 0);
    const Net = tripsPay + pocketPay;
    const Profit = Net - invested;
    const rec = recommendWoO({player, board, ante:anteValue});
    const hyp = settleHypGeneric({player, pe, cmp, dealerQual, ante, blind, trips, pocket, playAmt:rec.recPlay, doFold:rec.recFold});
    return {
      playerNet:Net,
      pClass:pe.cls,
      dClass:de.cls,
      cmp,
      dealerQual,
      returns:{Ante:0, Blind:0, Play:0, tripsPay, pocketPay},
      profit:Profit,
      outcome:'loss',
      breakdown:{
        play:-(ante + blind),
        ante:-ante,
        blind:-blind,
        playBet:0,
        trips:tripsPay - (trips > 0 ? trips : 0),
        pocket:pocketPay - (pocket > 0 ? pocket : 0),
        betPlay:0,
        betAnte:ante,
        betBlind:blind,
        betTrips:trips > 0 ? trips : 0,
        betPocket:pocket > 0 ? pocket : 0,
        betTotal:invested
      },
      betResults:{
        trips:{wager:trips > 0 ? trips : 0, returned:tripsPay, net:tripsPay - (trips > 0 ? trips : 0)},
        pocket:{wager:pocket > 0 ? pocket : 0, returned:pocketPay, net:pocketPay - (pocket > 0 ? pocket : 0)},
        ante:{wager:ante, returned:0, net:-ante},
        odds:{wager:blind, returned:0, net:-blind},
        play:{wager:0, returned:0, net:0}
      },
      strategy:{followed:actionsFollowed(actions, rec), delta:hyp.ProfitH - Profit, hypProfit:hyp.ProfitH, rec}
    };
  }

  function blackjackRank(card){ return card % 13; }
  function blackjackRankValue(card){
    const rank = blackjackRank(card);
    return rank === 12 ? 11 : Math.min(10, rank + 2);
  }
  function blackjackTotal(cards){
    let total = 0, aces = 0;
    (cards || []).forEach(card=>{
      if(blackjackRank(card) === 12) aces++;
      total += blackjackRankValue(card);
    });
    while(total > 21 && aces > 0){ total -= 10; aces--; }
    return {total, soft:aces > 0};
  }
  function blackjackIsNatural(hand){
    return !!hand && hand.cards.length === 2 && blackjackTotal(hand.cards).total === 21 && !hand.split;
  }
  function blackjackCanPlaceBet(bank, bet){
    const available = Number(bank), wager = Number(bet);
    return Number.isFinite(available) && Number.isFinite(wager) && wager > 0 && available >= wager;
  }
  function blackjackCanSplit(hand, handCount, bank){
    return !!hand && hand.cards.length === 2 && blackjackRank(hand.cards[0]) === blackjackRank(hand.cards[1]) && handCount < 4 && blackjackCanPlaceBet(bank, hand.bet);
  }
  function blackjackCanDouble(hand, bank, rules={}){
    if(!hand || hand.cards.length !== 2 || !blackjackCanPlaceBet(bank, hand.bet)) return false;
    if(hand.split && !rules.das) return false;
    return !hand.splitAces;
  }
  function blackjackCanSurrender(hand, rules={}){
    return !!(rules.surrender && hand && hand.cards.length === 2 && !hand.split && !hand.doubled);
  }
  function blackjackDealerUpValue(card){
    if(card === undefined || card === null) return 0;
    const rank = blackjackRank(card);
    return rank === 12 ? 11 : Math.min(10, rank + 2);
  }
  function blackjackShouldDealerHit(cards, rules={}){
    const total = blackjackTotal(cards);
    return total.total < 17 || (total.total === 17 && total.soft && rules.soft17 === 'hit');
  }

  // Exact finite-deck dealer distribution using only cards the caller marks as
  // visible. During an American-peek player decision the hole-card distribution
  // is conditioned on the dealer having already ruled out blackjack.
  function blackjackDealerOutcomeProbabilities({dealerUpCard, visibleCards=[], rules={}, peeked=true}={}){
    if(dealerUpCard === undefined || dealerUpCard === null) return null;
    const decks = [1,2,4,6,8].includes(Number(rules.decks)) ? Number(rules.decks) : 4;
    // Indices are blackjack values 2..11 (Ace); ten represents T/J/Q/K.
    const counts = Array(12).fill(0);
    for(let value=2; value<=9; value++) counts[value] = decks * 4;
    counts[10] = decks * 16;
    counts[11] = decks * 4;
    (visibleCards || []).forEach(card=>{
      const value = blackjackDealerUpValue(card);
      if(value >= 2 && value <= 11 && counts[value] > 0) counts[value]--;
    });
    const up = blackjackDealerUpValue(dealerUpCard);
    const memo = new Map();
    function addCard(total, softAces, value){
      let nextTotal = total + value;
      let nextSoft = softAces + (value === 11 ? 1 : 0);
      while(nextTotal > 21 && nextSoft > 0){ nextTotal -= 10; nextSoft--; }
      return [nextTotal, nextSoft];
    }
    function finish(total, softAces, remaining){
      if(total > 21) return [1,0,0,0,0,0];
      const hit = total < 17 || (total === 17 && softAces > 0 && rules.soft17 === 'hit');
      if(!hit){
        const result = [0,0,0,0,0,0];
        if(total >= 17 && total <= 21) result[total - 16] = 1;
        return result;
      }
      const key = `${total}/${softAces}/${remaining.slice(2).join(',')}`;
      if(memo.has(key)) return memo.get(key);
      const denominator = remaining.slice(2).reduce((sum,n)=>sum+n,0);
      const result = [0,0,0,0,0,0];
      if(!denominator) return result;
      for(let value=2; value<=11; value++){
        const count = remaining[value];
        if(!count) continue;
        remaining[value]--;
        const [nextTotal,nextSoft] = addCard(total,softAces,value);
        const branch = finish(nextTotal,nextSoft,remaining);
        remaining[value]++;
        const weight = count / denominator;
        for(let i=0; i<result.length; i++) result[i] += branch[i] * weight;
      }
      memo.set(key,result);
      return result;
    }
    const [upTotal,upSoft] = addCard(0,0,up);
    const allowedHole = value=>!(peeked && ((up === 11 && value === 10) || (up === 10 && value === 11)));
    let holeDenominator = 0;
    for(let value=2; value<=11; value++) if(allowedHole(value)) holeDenominator += counts[value];
    if(!holeDenominator) return null;
    const combined = [0,0,0,0,0,0];
    for(let value=2; value<=11; value++){
      const count = counts[value];
      if(!count || !allowedHole(value)) continue;
      counts[value]--;
      const [total,softAces] = addCard(upTotal,upSoft,value);
      const branch = finish(total,softAces,counts);
      counts[value]++;
      const weight = count / holeDenominator;
      for(let i=0; i<combined.length; i++) combined[i] += branch[i] * weight;
    }
    return {bust:combined[0], 17:combined[1], 18:combined[2], 19:combined[3], 20:combined[4], 21:combined[5]};
  }

  // Composition-dependent initial-decision EVs supplied from Blackjack
  // Appendix 9: six decks, H17, American peek, resplit to four hands (not
  // aces), one card to split aces. Pair rows carry No-DAS and DAS split EVs.
  const blackjackInitialEv6dH17Data = `A,A,A,-0.597555,-0.064753,-0.585159,0.120987,0.120987|A,2,2,-0.596885,-0.292671,-1.193770,-0.524177,-0.522035|A,3,3,-0.596214,-0.344327,-1.180152,-0.569143,-0.566417|A,4,4,-0.595485,-0.263885,-0.829357,-0.639841,-0.636420|A,5,5,-0.595733,0.034458,-0.025588,-0.755521,-0.751864|A,6,6,-0.594466,-0.387285,-0.836670,-0.729641,-0.726030|A,7,7,-0.592673,-0.477592,-0.976448,-0.731828,-0.728559|A,8,8,-0.594827,-0.538561,-1.077122,-0.516551,-0.514318|A,9,9,-0.219502,-0.638487,-1.276974,-0.242158,-0.240949|A,10,10,0.600344,-0.858455,-1.716911,-0.453428,-0.453428|2,A,A,-0.284008,0.082026,-0.060073,0.485375,0.485375|2,2,2,-0.286162,-0.112545,-0.572323,-0.153905,-0.078280|2,3,3,-0.286019,-0.139266,-0.551880,-0.205805,-0.129464|2,4,4,-0.285785,-0.022238,-0.201987,-0.258251,-0.181576|2,5,5,-0.280711,0.187678,0.371112,-0.316842,-0.271951|2,6,6,-0.281702,-0.253614,-0.507227,-0.267633,-0.190104|2,7,7,-0.282722,-0.370557,-0.741114,-0.198248,-0.120233|2,8,8,-0.283713,-0.470692,-0.941385,-0.000222,0.074691|2,9,9,0.112768,-0.624382,-1.248764,0.154042,0.195080|2,10,10,0.632910,-0.853996,-1.707992,0.098529,0.098529|3,A,A,-0.243667,0.104450,0.005586,0.532737,0.532737|3,2,2,-0.245684,-0.080126,-0.491369,-0.096973,-0.006516|3,3,3,-0.245460,-0.105892,-0.471414,-0.136178,-0.046145|3,4,4,-0.240332,0.009335,-0.128367,-0.180477,-0.088408|3,5,5,-0.239515,0.212595,0.423861,-0.242124,-0.187043|3,6,6,-0.240493,-0.232219,-0.464438,-0.191057,-0.092792|3,7,7,-0.241518,-0.356297,-0.712593,-0.126463,-0.028565|3,8,8,-0.242878,-0.463614,-0.927228,0.064142,0.148354|3,9,9,0.134754,-0.623778,-1.247557,0.203531,0.249871|3,10,10,0.643634,-0.853716,-1.707431,0.181931,0.181931|4,A,A,-0.200841,0.129292,0.073672,0.582300,0.582300|4,2,2,-0.202664,-0.044392,-0.405328,-0.032246,0.073362|4,3,3,-0.197544,-0.065692,-0.376611,-0.052516,0.054585|4,4,4,-0.196633,0.046322,-0.050931,-0.098932,0.010058|4,5,5,-0.195931,0.239693,0.479387,-0.159151,-0.089312|4,6,6,-0.196879,-0.210302,-0.420604,-0.108917,0.010721|4,7,7,-0.198315,-0.341577,-0.683155,-0.047910,0.072938|4,8,8,-0.206168,-0.458790,-0.917580,0.124652,0.218242|4,9,9,0.164403,-0.615147,-1.230295,0.268034,0.319011|4,10,10,0.654267,-0.853474,-1.706948,0.270473,0.270473|5,A,A,-0.158751,0.160827,0.141840,0.633712,0.633712|5,2,2,-0.155452,-0.003781,-0.310904,0.053299,0.176577|5,3,3,-0.154601,-0.026775,-0.290921,0.028720,0.156799|5,4,4,-0.153795,0.082815,0.026924,-0.017220,0.114847|5,5,5,-0.153103,0.269829,0.539658,-0.072492,0.015322|5,6,6,-0.154527,-0.188677,-0.377354,-0.026997,0.115525|5,7,7,-0.162425,-0.329707,-0.659414,0.020047,0.160565|5,8,8,-0.164069,-0.450829,-0.901658,0.197938,0.301452|5,9,9,0.195523,-0.611797,-1.223594,0.337448,0.393253|5,10,10,0.668927,-0.853117,-1.706234,0.366222,0.366222|6,A,A,-0.115159,0.189536,0.206312,0.679649,0.679649|6,2,2,-0.115611,0.030230,-0.231222,0.124768,0.268018|6,3,3,-0.114816,0.009878,-0.212063,0.100861,0.247426|6,4,4,-0.114085,0.113365,0.092929,0.056954,0.207228|6,5,5,-0.113900,0.293773,0.587547,0.000902,0.102498|6,6,6,-0.121827,-0.175211,-0.350422,0.033850,0.191888|6,7,7,-0.123475,-0.317997,-0.635994,0.090458,0.249820|6,8,8,-0.124862,-0.437540,-0.875080,0.260351,0.373881|6,9,9,0.220168,-0.610063,-1.220125,0.393294,0.453097|6,10,10,0.676590,-0.852918,-1.705836,0.448590,0.448590|7,A,A,-0.471742,0.164333,-0.176403,0.475600,0.475600|7,2,2,-0.474621,-0.088828,-0.949243,-0.048572,0.008597|7,3,3,-0.473963,-0.153797,-0.890244,-0.108445,-0.051101|7,4,4,-0.473283,0.086616,-0.175100,-0.227233,-0.168774|7,5,5,-0.476217,0.260394,0.404746,-0.330901,-0.297599|7,6,6,-0.477738,-0.220562,-0.520123,-0.311678,-0.252905|7,7,7,-0.479132,-0.331784,-0.691921,-0.104889,-0.048567|7,8,8,-0.480181,-0.408423,-0.816845,0.264110,0.318876|7,9,9,0.399576,-0.587176,-1.174353,0.334523,0.364180|7,10,10,0.772011,-0.850445,-1.700890,0.262033,0.262033|8,A,A,-0.508761,0.094585,-0.311501,0.359708,0.359708|8,2,2,-0.511247,-0.156790,-1.022494,-0.215128,-0.176794|8,3,3,-0.510567,-0.219182,-1.001140,-0.269599,-0.230664|8,4,4,-0.513430,-0.059090,-0.451036,-0.365344,-0.325801|8,5,5,-0.513325,0.199537,0.293033,-0.482787,-0.459393|8,6,6,-0.514636,-0.279301,-0.630537,-0.456194,-0.416429|8,7,7,-0.515767,-0.377709,-0.780906,-0.429288,-0.390952|8,8,8,-0.517509,-0.453401,-0.906802,-0.065211,-0.029242|8,9,9,0.099261,-0.587148,-1.174296,0.208880,0.229929|8,10,10,0.790420,-0.850101,-1.700201,0.012522,0.012522|9,A,A,-0.538085,-0.000333,-0.450881,0.237754,0.237754|9,2,2,-0.540137,-0.237873,-1.080275,-0.403662,-0.384407|9,3,3,-0.543009,-0.295264,-1.067368,-0.450388,-0.431618|9,4,4,-0.542865,-0.209848,-0.715694,-0.527732,-0.508478|9,5,5,-0.542661,0.116653,0.149188,-0.652354,-0.638481|9,6,6,-0.543905,-0.347155,-0.749935,-0.621483,-0.602063|9,7,7,-0.545528,-0.437912,-0.894019,-0.591483,-0.573526|9,8,8,-0.538890,-0.505707,-1.011415,-0.408743,-0.389950|9,9,9,-0.185235,-0.613052,-1.226103,-0.093583,-0.081564|9,10,10,0.756075,-0.849438,-1.698876,-0.272562,-0.272562|10,A,A,-0.538797,-0.066310,-0.506650,0.181988,0.181988|10,2,2,-0.541589,-0.287099,-1.083178,-0.511458,-0.500907|10,3,3,-0.541402,-0.338693,-1.063997,-0.557327,-0.546375|10,4,4,-0.541266,-0.247994,-0.745112,-0.630523,-0.619294|10,5,5,-0.541033,0.027154,-0.004071,-0.740968,-0.729749|10,6,6,-0.542783,-0.381953,-0.798288,-0.718928,-0.707854|10,7,7,-0.535586,-0.474064,-0.953611,-0.663501,-0.652075|10,8,8,-0.536853,-0.535361,-1.070722,-0.486276,-0.475385|10,9,9,-0.171080,-0.643985,-1.287970,-0.320012,-0.309996|10,10,10,0.559145,-0.847142,-1.694283,-0.419582,-0.419582|A,2,A,-0.597220,-0.100433,-0.584256,0.00060719|A,3,A,-0.596877,-0.135170,-0.583703,0.00060719|A,3,2,-0.596541,-0.317783,-1.193081,0.00063359|A,4,A,-0.596510,-0.172032,-0.586998,0.00060719|A,4,2,-0.596191,-0.344326,-1.180111,0.00063359|A,4,3,-0.595856,-0.353382,-1.085015,0.00063359|A,5,A,-0.596653,-0.209173,-0.592891,0.00060719|A,5,2,-0.596327,-0.351841,-1.086013,0.00063359|A,5,3,-0.595978,-0.265886,-0.830452,0.00063359|A,5,4,-0.595607,-0.124191,-0.451622,0.00063359|A,6,A,-0.514255,-0.221401,-0.548548,0.00060719|A,6,2,-0.595700,-0.265893,-0.831492,0.00063359|A,6,3,-0.595353,-0.124603,-0.452926,0.00063359|A,6,4,-0.594984,0.034616,-0.025748,0.00063359|A,6,5,-0.595078,0.108668,0.124007,0.00063359|A,7,A,-0.225366,-0.160455,-0.417824,0.00060719|A,7,2,-0.594779,-0.126812,-0.454400,0.00063359|A,7,3,-0.594433,0.033882,-0.027798,0.00063359|A,7,4,-0.594044,0.107943,0.122285,0.00063359|A,7,5,-0.594173,-0.387530,-0.837178,0.00063359|A,7,6,-0.593566,-0.434381,-0.906997,0.00063359|A,8,A,0.189506,-0.064654,-0.228245,0.00060719|A,8,2,-0.595855,0.033872,-0.030126,0.00063359|A,8,3,-0.595490,0.107445,0.118796,0.00063359|A,8,4,-0.595123,-0.387293,-0.838971,0.00063359|A,8,5,-0.595253,-0.433097,-0.905727,0.00063359|A,8,6,-0.594646,-0.470188,-0.961526,0.00063359|A,8,7,-0.593749,-0.503074,-1.014255,0.00063359|A,9,A,0.605486,0.030489,-0.040723,0.00060719|A,9,2,-0.596905,0.107036,0.115609,0.00063359|A,9,3,-0.596563,-0.387407,-0.841503,0.00063359|A,9,4,-0.596196,-0.425233,-0.891211,0.00063359|A,9,5,-0.596325,-0.468617,-0.958210,0.00063359|A,9,6,-0.595712,-0.508651,-1.025788,0.00063359|A,9,7,-0.594820,-0.538656,-1.077313,0.00063359|A,9,8,-0.511699,-0.577117,-1.154234,0.00063359|A,10,A,1.500000,0.104246,0.108590,0.00244016|A,10,2,-0.599164,-0.383367,-0.834065,0.00254626|A,10,3,-0.598823,-0.427010,-0.895385,0.00254626|A,10,4,-0.598458,-0.468857,-0.959221,0.00254626|A,10,5,-0.598584,-0.509549,-1.026900,0.00254626|A,10,6,-0.597991,-0.540015,-1.080030,0.00254626|A,10,7,-0.513758,-0.578940,-1.157881,0.00254626|A,10,8,-0.223377,-0.639911,-1.279823,0.00254626|A,10,9,0.191966,-0.733039,-1.466077,0.00254626|2,2,A,-0.285091,0.045611,-0.063455,0.00088085|2,3,A,-0.285009,0.022101,-0.063913,0.00091915|2,3,2,-0.286101,-0.126025,-0.572202,0.00088085|2,4,A,-0.284913,-0.000918,-0.067577,0.00091915|2,4,2,-0.285985,-0.139226,-0.551817,0.00088085|2,4,3,-0.285902,-0.110920,-0.429532,0.00091915|2,5,A,-0.282389,-0.021446,-0.069968,0.00091915|2,5,2,-0.283454,-0.107915,-0.426153,0.00088085|2,5,3,-0.283371,-0.023176,-0.199989,0.00091915|2,5,4,-0.283253,0.075786,0.068039,0.00091915|2,6,A,-0.152739,-0.000274,-0.004882,0.00091915|2,6,2,-0.283949,-0.022871,-0.199767,0.00088085|2,6,3,-0.283865,0.075331,0.067378,0.00091915|2,6,4,-0.283726,0.186754,0.368992,0.00091915|2,6,5,-0.281206,0.244940,0.485545,0.00091915|2,7,A,0.113110,0.060441,0.116262,0.00091915|2,7,2,-0.284457,0.073913,0.067870,0.00088085|2,7,3,-0.284353,0.186119,0.367771,0.00091915|2,7,4,-0.284235,0.243179,0.481737,0.00091915|2,7,5,-0.281716,-0.253609,-0.507218,0.00091915|2,7,6,-0.282213,-0.312485,-0.624970,0.00091915|2,8,A,0.380751,0.121117,0.237658,0.00091915|2,8,2,-0.284919,0.185608,0.366980,0.00088085|2,8,3,-0.284836,0.242280,0.479984,0.00091915|2,8,4,-0.284718,-0.254724,-0.509448,0.00091915|2,8,5,-0.282200,-0.312360,-0.624720,0.00091915|2,8,6,-0.282695,-0.363635,-0.727270,0.00091915|2,8,7,-0.283230,-0.414321,-0.828642,0.00091915|2,9,A,0.637642,0.182199,0.360050,0.00091915|2,9,2,-0.285600,0.241465,0.478395,0.00088085|2,9,3,-0.285517,-0.255818,-0.511635,0.00091915|2,9,4,-0.285400,-0.306135,-0.612270,0.00091915|2,9,5,-0.282881,-0.362973,-0.725946,0.00091915|2,9,6,-0.283403,-0.420576,-0.841152,0.00091915|2,9,7,-0.283912,-0.470891,-0.941781,0.00091915|2,9,8,-0.153788,-0.537261,-1.074522,0.00091915|2,10,A,1.500000,0.238994,0.472562,0.00367661|2,10,2,-0.289435,-0.252224,-0.504448,0.00352341|2,10,3,-0.289352,-0.307973,-0.615946,0.00367661|2,10,4,-0.289236,-0.364353,-0.728707,0.00367661|2,10,5,-0.286740,-0.421462,-0.842924,0.00367661|2,10,6,-0.287237,-0.472332,-0.944663,0.00367661|2,10,7,-0.157192,-0.538482,-1.076963,0.00367661|2,10,8,0.109693,-0.625184,-1.250369,0.00367661|2,10,9,0.377921,-0.732845,-1.465690,0.00367661|3,2,A,-0.244670,0.073770,0.001962,0.00091915|3,3,A,-0.244578,0.050358,-0.000572,0.00088085|3,3,2,-0.245573,-0.093202,-0.491145,0.00088085|3,4,A,-0.242024,0.029075,-0.002231,0.00091915|3,4,2,-0.243009,-0.104221,-0.466758,0.00091915|3,4,3,-0.242896,-0.076982,-0.349532,0.00088085|3,5,A,-0.241620,0.008338,-0.006083,0.00091915|3,5,2,-0.242607,-0.074160,-0.347730,0.00091915|3,5,3,-0.242493,0.008067,-0.128592,0.00088085|3,5,4,-0.239918,0.105900,0.131414,0.00091915|3,6,A,-0.116126,0.029212,0.057176,0.00091915|3,6,2,-0.243094,0.008372,-0.128418,0.00091915|3,6,3,-0.242959,0.105445,0.130048,0.00088085|3,6,4,-0.240406,0.211891,0.422460,0.00091915|3,6,5,-0.240003,0.268158,0.535069,0.00091915|3,7,A,0.141584,0.088230,0.175215,0.00091915|3,7,2,-0.243573,0.104036,0.130522,0.00091915|3,7,3,-0.243459,0.211210,0.420854,0.00088085|3,7,4,-0.240906,0.266757,0.532269,0.00091915|3,7,5,-0.240505,-0.232183,-0.464366,0.00091915|3,7,6,-0.240992,-0.294107,-0.588214,0.00091915|3,8,A,0.399787,0.151059,0.300697,0.00091915|3,8,2,-0.244251,0.210340,0.419211,0.00091915|3,8,3,-0.244137,0.265234,0.528985,0.00088085|3,8,4,-0.241586,-0.233324,-0.466647,0.00091915|3,8,5,-0.241183,-0.294245,-0.588490,0.00091915|3,8,6,-0.241697,-0.349657,-0.699314,0.00091915|3,8,7,-0.242197,-0.403931,-0.807863,0.00091915|3,9,A,0.645253,0.203437,0.405273,0.00091915|3,9,2,-0.248181,0.261295,0.520989,0.00091915|3,9,3,-0.248068,-0.237301,-0.474602,0.00088085|3,9,4,-0.245516,-0.290023,-0.580047,0.00091915|3,9,5,-0.245138,-0.350845,-0.701690,0.00091915|3,9,6,-0.245627,-0.411794,-0.823587,0.00091915|3,9,7,-0.246129,-0.464920,-0.929840,0.00091915|3,9,8,-0.120409,-0.533980,-1.067959,0.00091915|3,10,A,1.500000,0.261370,0.520285,0.00367661|3,10,2,-0.248923,-0.231678,-0.463355,0.00367661|3,10,3,-0.248811,-0.290528,-0.581057,0.00352341|3,10,4,-0.246282,-0.350816,-0.701632,0.00367661|3,10,5,-0.245879,-0.411424,-0.822847,0.00367661|3,10,6,-0.246369,-0.465336,-0.930673,0.00367661|3,10,7,-0.120447,-0.534200,-1.068400,0.00367661|3,10,8,0.137849,-0.623183,-1.246366,0.00367661|3,10,9,0.394037,-0.726003,-1.452006,0.00367661|4,2,A,-0.201766,0.104348,0.070634,0.00091915|4,3,A,-0.199215,0.082777,0.069716,0.00091915|4,3,2,-0.200104,-0.055370,-0.400209,0.00091915|4,4,A,-0.198766,0.060757,0.065278,0.00088085|4,4,2,-0.199655,-0.067021,-0.380345,0.00088085|4,4,3,-0.197094,-0.038414,-0.262411,0.00088085|4,5,A,-0.198414,0.040979,0.061535,0.00091915|4,5,2,-0.199305,-0.037425,-0.265089,0.00091915|4,5,3,-0.196734,0.044637,-0.051206,0.00091915|4,5,4,-0.196281,0.137091,0.197964,0.00088085|4,6,A,-0.076357,0.061648,0.123295,0.00091915|4,6,2,-0.199757,0.043758,-0.054037,0.00091915|4,6,3,-0.197207,0.136632,0.197034,0.00091915|4,6,4,-0.196756,0.239378,0.478756,0.00088085|4,6,5,-0.196406,0.293527,0.587055,0.00091915|4,7,A,0.171028,0.122397,0.244794,0.00091915|4,7,2,-0.200460,0.133799,0.194283,0.00091915|4,7,3,-0.197911,0.238374,0.476749,0.00091915|4,7,4,-0.197461,0.292149,0.584298,0.00088085|4,7,5,-0.197110,-0.210554,-0.421108,0.00091915|4,7,6,-0.197610,-0.275533,-0.551066,0.00091915|4,8,A,0.415570,0.176002,0.352004,0.00091915|4,8,2,-0.204386,0.233346,0.466693,0.00091915|4,8,3,-0.201838,0.287631,0.575263,0.00091915|4,8,4,-0.201386,-0.213959,-0.427918,0.00088085|4,8,5,-0.201061,-0.277746,-0.555493,0.00091915|4,8,6,-0.201536,-0.336519,-0.673038,0.00091915|4,8,7,-0.202241,-0.394686,-0.789372,0.00091915|4,9,A,0.655844,0.229437,0.458874,0.00091915|4,9,2,-0.205200,0.285533,0.571067,0.00091915|4,9,3,-0.202651,-0.215698,-0.431396,0.00091915|4,9,4,-0.202225,-0.271755,-0.543511,0.00088085|4,9,5,-0.201874,-0.336208,-0.672417,0.00091915|4,9,6,-0.202349,-0.401031,-0.802061,0.00091915|4,9,7,-0.203055,-0.457708,-0.915416,0.00091915|4,9,8,-0.083983,-0.530808,-1.061617,0.00091915|4,10,A,1.500000,0.285129,0.570259,0.00367661|4,10,2,-0.205906,-0.210664,-0.421329,0.00367661|4,10,3,-0.203381,-0.272231,-0.544461,0.00367661|4,10,4,-0.202930,-0.336220,-0.672440,0.00352341|4,10,5,-0.202579,-0.400721,-0.801443,0.00367661|4,10,6,-0.203055,-0.457944,-0.915887,0.00367661|4,10,7,-0.080830,-0.529979,-1.059958,0.00367661|4,10,8,0.164363,-0.615157,-1.230315,0.00367661|4,10,9,0.413067,-0.724937,-1.449874,0.00367661|5,2,A,-0.157113,0.137618,0.141030,0.00091915|5,3,A,-0.156687,0.116160,0.139629,0.00091915|5,3,2,-0.155026,-0.015690,-0.310053,0.00091915|5,4,A,-0.156291,0.094928,0.134921,0.00091915|5,4,2,-0.154631,-0.026761,-0.291219,0.00091915|5,4,3,-0.154193,0.001535,-0.179554,0.00091915|5,5,A,-0.155945,0.075288,0.130267,0.00088085|5,5,2,-0.154275,0.002733,-0.180919,0.00088085|5,5,3,-0.153847,0.080817,0.025854,0.00088085|5,5,4,-0.153449,0.170984,0.268497,0.00088085|5,6,A,-0.038473,0.098689,0.197379,0.00091915|5,6,2,-0.154973,0.079302,0.022325,0.00091915|5,6,3,-0.154545,0.169339,0.265167,0.00091915|5,6,4,-0.154149,0.268640,0.537279,0.00091915|5,6,5,-0.153802,0.320525,0.641050,0.00088085|5,7,A,0.198998,0.151132,0.302263,0.00091915|5,7,2,-0.158922,0.163419,0.256391,0.00091915|5,7,3,-0.158495,0.264024,0.528049,0.00091915|5,7,4,-0.158097,0.315817,0.631634,0.00091915|5,7,5,-0.157776,-0.190982,-0.381963,0.00088085|5,7,6,-0.158476,-0.259536,-0.519071,0.00091915|5,8,A,0.439914,0.206222,0.412443,0.00091915|5,8,2,-0.159743,0.262222,0.524444,0.00091915|5,8,3,-0.159316,0.313950,0.627900,0.00091915|5,8,4,-0.158944,-0.192389,-0.384778,0.00091915|5,8,5,-0.158596,-0.259746,-0.519492,0.00088085|5,8,6,-0.159297,-0.321340,-0.642681,0.00091915|5,8,7,-0.163247,-0.384186,-0.768372,0.00091915|5,9,A,0.670408,0.257717,0.515435,0.00091915|5,9,2,-0.160457,0.312258,0.624515,0.00091915|5,9,3,-0.160055,-0.194040,-0.388080,0.00091915|5,9,4,-0.159657,-0.253758,-0.507517,0.00091915|5,9,5,-0.159310,-0.320829,-0.641658,0.00088085|5,9,6,-0.160011,-0.388976,-0.777952,0.00091915|5,9,7,-0.163962,-0.450802,-0.901604,0.00091915|5,9,8,-0.046138,-0.518963,-1.037926,0.00091915|5,10,A,1.500000,0.311068,0.622136,0.00367661|5,10,2,-0.161126,-0.188759,-0.377518,0.00367661|5,10,3,-0.160699,-0.254211,-0.508423,0.00367661|5,10,4,-0.160301,-0.320872,-0.641745,0.00367661|5,10,5,-0.159954,-0.388494,-0.776989,0.00352341|5,10,6,-0.160655,-0.449718,-0.899436,0.00367661|5,10,7,-0.045986,-0.518957,-1.037914,0.00367661|5,10,8,0.195534,-0.611809,-1.223619,0.00367661|5,10,9,0.437502,-0.723459,-1.446918,0.00367661|6,2,A,-0.115391,0.166485,0.204216,0.00091915|6,3,A,-0.114998,0.146111,0.202975,0.00091915|6,3,2,-0.115219,0.019256,-0.230439,0.00091915|6,4,A,-0.114635,0.126272,0.199687,0.00091915|6,4,2,-0.114844,0.009881,-0.212121,0.00091915|6,4,3,-0.114450,0.035824,-0.104380,0.00091915|6,5,A,-0.114523,0.110738,0.202017,0.00091915|6,5,2,-0.114751,0.037108,-0.105273,0.00091915|6,5,3,-0.114357,0.111453,0.092013,0.00091915|6,5,4,-0.113992,0.197680,0.324478,0.00091915|6,6,A,-0.004992,0.126073,0.252146,0.00088085|6,6,2,-0.118703,0.106754,0.082192,0.00088085|6,6,3,-0.118309,0.192820,0.314736,0.00088085|6,6,4,-0.117943,0.289479,0.578959,0.00088085|6,6,5,-0.117876,0.339933,0.679865,0.00088085|6,7,A,0.222598,0.178453,0.356906,0.00091915|6,7,2,-0.119527,0.189590,0.311309,0.00091915|6,7,3,-0.119133,0.287425,0.574849,0.00091915|6,7,4,-0.118792,0.337927,0.675854,0.00091915|6,7,5,-0.118699,-0.173201,-0.346403,0.00091915|6,7,6,-0.122651,-0.246688,-0.493376,0.00088085|6,8,A,0.452220,0.231045,0.462089,0.00091915|6,8,2,-0.120237,0.285645,0.571290,0.00091915|6,8,3,-0.119868,0.336072,0.672145,0.00091915|6,8,4,-0.119502,-0.174273,-0.348546,0.00091915|6,8,5,-0.119409,-0.244828,-0.489656,0.00091915|6,8,6,-0.123361,-0.311131,-0.622262,0.00088085|6,8,7,-0.124186,-0.374794,-0.749588,0.00091915|6,9,A,0.677574,0.281487,0.562975,0.00091915|6,9,2,-0.120933,0.334401,0.668803,0.00091915|6,9,3,-0.120539,-0.175904,-0.351809,0.00091915|6,9,4,-0.120173,-0.238607,-0.477213,0.00091915|6,9,5,-0.120080,-0.308835,-0.617671,0.00091915|6,9,6,-0.124033,-0.380899,-0.761799,0.00088085|6,9,7,-0.124822,-0.437546,-0.875093,0.00091915|6,9,8,-0.009955,-0.515251,-1.030501,0.00091915|6,10,A,1.500000,0.333531,0.667063,0.00367661|6,10,2,-0.121479,-0.170569,-0.341138,0.00367661|6,10,3,-0.121086,-0.239032,-0.478064,0.00367661|6,10,4,-0.120720,-0.308640,-0.617280,0.00367661|6,10,5,-0.120627,-0.378850,-0.757700,0.00367661|6,10,6,-0.124544,-0.437508,-0.875017,0.00352341|6,10,7,-0.009816,-0.515243,-1.030485,0.00367661|6,10,8,0.220261,-0.610054,-1.220107,0.00367661|6,10,9,0.450523,-0.722695,-1.445390,0.00367661|7,2,A,-0.473185,0.120174,-0.179483,0.00091915|7,3,A,-0.472861,0.076540,-0.182241,0.00091915|7,3,2,-0.474287,-0.119481,-0.948574,0.00091915|7,4,A,-0.472512,0.036406,-0.177160,0.00091915|7,4,2,-0.473947,-0.153746,-0.890224,0.00091915|7,4,3,-0.473622,-0.069120,-0.581824,0.00091915|7,5,A,-0.473968,-0.007882,-0.184344,0.00091915|7,5,2,-0.475404,-0.068651,-0.585406,0.00091915|7,5,3,-0.475079,0.083844,-0.178613,0.00091915|7,5,4,-0.474737,0.176299,0.118144,0.00091915|7,6,A,-0.103826,0.054706,-0.008857,0.00091915|7,6,2,-0.476165,0.083939,-0.180927,0.00091915|7,6,3,-0.475838,0.176073,0.115952,0.00091915|7,6,4,-0.475523,0.261579,0.406015,0.00091915|7,6,5,-0.476977,0.293411,0.469748,0.00091915|7,7,A,0.401861,0.171872,0.223664,0.00088085|7,7,2,-0.476858,0.174276,0.113595,0.00088085|7,7,3,-0.476558,0.260334,0.401418,0.00088085|7,7,4,-0.476217,0.292868,0.467648,0.00088085|7,7,5,-0.477672,-0.219577,-0.518149,0.00088085|7,7,6,-0.478433,-0.278428,-0.606515,0.00088085|7,8,A,0.615734,0.220956,0.320560,0.00091915|7,8,2,-0.477422,0.258576,0.396342,0.00091915|7,8,3,-0.477096,0.292164,0.464533,0.00091915|7,8,4,-0.476756,-0.217934,-0.515629,0.00091915|7,8,5,-0.478210,-0.278145,-0.605877,0.00091915|7,8,6,-0.478975,-0.325493,-0.678337,0.00091915|7,8,7,-0.479635,-0.362547,-0.735710,0.00088085|7,9,A,0.773273,0.254647,0.385938,0.00091915|7,9,2,-0.478284,0.291741,0.461868,0.00091915|7,9,3,-0.477959,-0.218241,-0.518061,0.00091915|7,9,4,-0.477619,-0.269781,-0.589288,0.00091915|7,9,5,-0.479075,-0.325412,-0.677253,0.00091915|7,9,6,-0.479801,-0.368743,-0.748137,0.00091915|7,9,7,-0.480503,-0.408432,-0.816865,0.00088085|7,9,8,-0.109730,-0.478075,-0.956150,0.00091915|7,10,A,1.500000,0.291217,0.463763,0.00367661|7,10,2,-0.474935,-0.212638,-0.504855,0.00367661|7,10,3,-0.474609,-0.269267,-0.586650,0.00367661|7,10,4,-0.474271,-0.324567,-0.674240,0.00367661|7,10,5,-0.475708,-0.368927,-0.746864,0.00367661|7,10,6,-0.476476,-0.408624,-0.817247,0.00367661|7,10,7,-0.108885,-0.478380,-0.956760,0.00352341|7,10,8,0.397743,-0.587340,-1.174681,0.00367661|7,10,9,0.615047,-0.712756,-1.425513,0.00367661|8,2,A,-0.510013,0.051835,-0.314099,0.00091915|8,3,A,-0.509664,0.016478,-0.305060,0.00091915|8,3,2,-0.510907,-0.187166,-1.021815,0.00091915|8,4,A,-0.511097,-0.028404,-0.314303,0.00091915|8,4,2,-0.512340,-0.219720,-1.004683,0.00091915|8,4,3,-0.512000,-0.213278,-0.847352,0.00091915|8,5,A,-0.511033,-0.069392,-0.317151,0.00091915|8,5,2,-0.512277,-0.211671,-0.847888,0.00091915|8,5,3,-0.511935,-0.059455,-0.448044,0.00091915|8,5,4,-0.513391,0.099920,-0.021689,0.00091915|8,6,A,-0.382583,-0.071750,-0.251340,0.00091915|8,6,2,-0.512931,-0.059214,-0.449931,0.00091915|8,6,3,-0.512615,0.101203,-0.020122,0.00091915|8,6,4,-0.514046,0.199620,0.291603,0.00091915|8,6,5,-0.513980,0.230173,0.353456,0.00091915|8,7,A,0.108057,0.041028,-0.028189,0.00091915|8,7,2,-0.513537,0.099741,-0.021682,0.00091915|8,7,3,-0.513196,0.200742,0.292600,0.00091915|8,7,4,-0.514627,0.228786,0.349099,0.00091915|8,7,5,-0.514561,-0.279202,-0.630474,0.00091915|8,7,6,-0.515221,-0.334678,-0.714750,0.00091915|8,8,A,0.595896,0.152904,0.193997,0.00088085|8,8,2,-0.514402,0.199178,0.287564,0.00088085|8,8,3,-0.514062,0.228561,0.347405,0.00088085|8,8,4,-0.515493,-0.279058,-0.631948,0.00088085|8,8,5,-0.515429,-0.333494,-0.712504,0.00088085|8,8,6,-0.516050,-0.371477,-0.767559,0.00088085|8,8,7,-0.516638,-0.410942,-0.831472,0.00088085|8,9,A,0.790658,0.193713,0.277473,0.00091915|8,9,2,-0.511055,0.227615,0.346979,0.00091915|8,9,3,-0.510715,-0.278647,-0.629649,0.00091915|8,9,4,-0.512148,-0.326010,-0.696199,0.00091915|8,9,5,-0.512065,-0.371556,-0.765428,0.00091915|8,9,6,-0.512728,-0.417413,-0.843769,0.00091915|8,9,7,-0.513316,-0.453627,-0.907253,0.00091915|8,9,8,-0.387487,-0.501194,-1.002387,0.00088085|8,10,A,1.500000,0.228515,0.347788,0.00367661|8,10,2,-0.511634,-0.272002,-0.617342,0.00367661|8,10,3,-0.511295,-0.324425,-0.693347,0.00367661|8,10,4,-0.512708,-0.369606,-0.761980,0.00367661|8,10,5,-0.512647,-0.416910,-0.841853,0.00367661|8,10,6,-0.513309,-0.453130,-0.906261,0.00367661|8,10,7,-0.384233,-0.500967,-1.001934,0.00367661|8,10,8,0.104057,-0.586989,-1.173977,0.00352341|8,10,9,0.591091,-0.711065,-1.422130,0.00367661|9,2,A,-0.539111,-0.034089,-0.443187,0.00091915|9,3,A,-0.540547,-0.072746,-0.446362,0.00091915|9,3,2,-0.541573,-0.265989,-1.083146,0.00091915|9,4,A,-0.540464,-0.112418,-0.450958,0.00091915|9,4,2,-0.541491,-0.294528,-1.064329,0.00091915|9,4,3,-0.542924,-0.288453,-0.955318,0.00091915|9,5,A,-0.540365,-0.151418,-0.455770,0.00091915|9,5,2,-0.541389,-0.285443,-0.952282,0.00091915|9,5,3,-0.542848,-0.211386,-0.715741,0.00091915|9,5,4,-0.542763,-0.052189,-0.297410,0.00091915|9,6,A,-0.420578,-0.147268,-0.392162,0.00091915|9,6,2,-0.542034,-0.209881,-0.714108,0.00091915|9,6,3,-0.543467,-0.052030,-0.298867,0.00091915|9,6,4,-0.543383,0.116739,0.147751,0.00091915|9,6,5,-0.543281,0.157414,0.230031,0.00091915|9,7,A,-0.182640,-0.098469,-0.284825,0.00091915|9,7,2,-0.542861,-0.052171,-0.297011,0.00091915|9,7,3,-0.544295,0.116689,0.145776,0.00091915|9,7,4,-0.544211,0.156869,0.227194,0.00091915|9,7,5,-0.544111,-0.347763,-0.751490,0.00091915|9,7,6,-0.544695,-0.392092,-0.817609,0.00091915|9,8,A,0.287618,0.007442,-0.071161,0.00091915|9,8,2,-0.539517,0.116883,0.148698,0.00091915|9,8,3,-0.540951,0.155339,0.225746,0.00091915|9,8,4,-0.540869,-0.348743,-0.752669,0.00091915|9,8,5,-0.540750,-0.391310,-0.814270,0.00091915|9,8,6,-0.541376,-0.431821,-0.879484,0.00091915|9,8,7,-0.542209,-0.467044,-0.939621,0.00091915|9,9,A,0.759490,0.113198,0.138523,0.00088085|9,9,2,-0.540098,0.155832,0.225459,0.00088085|9,9,3,-0.541534,-0.348220,-0.753666,0.00088085|9,9,4,-0.541432,-0.383661,-0.800017,0.00088085|9,9,5,-0.541334,-0.430167,-0.875363,0.00088085|9,9,6,-0.541961,-0.472812,-0.951189,0.00088085|9,9,7,-0.542794,-0.504993,-1.009985,0.00088085|9,9,8,-0.421286,-0.550164,-1.100327,0.00088085|9,10,A,1.500000,0.156681,0.225894,0.00367661|9,10,2,-0.540641,-0.340701,-0.738846,0.00367661|9,10,3,-0.542057,-0.382712,-0.798989,0.00367661|9,10,4,-0.541976,-0.428224,-0.872084,0.00367661|9,10,5,-0.541878,-0.472187,-0.949023,0.00367661|9,10,6,-0.542505,-0.504547,-1.009094,0.00367661|9,10,7,-0.422164,-0.549404,-1.098808,0.00367661|9,10,8,-0.185194,-0.612833,-1.225665,0.00367661|9,10,9,0.283901,-0.712763,-1.425526,0.00352341|10,2,A,-0.540188,-0.102303,-0.508569,0.00340294|10,3,A,-0.540096,-0.137094,-0.508720,0.00340294|10,3,2,-0.541496,-0.312725,-1.082993,0.00339104|10,4,A,-0.540016,-0.173213,-0.511188,0.00340294|10,4,2,-0.541415,-0.339101,-1.064024,0.00339104|10,4,3,-0.541348,-0.321535,-0.951438,0.00339104|10,5,A,-0.539901,-0.210080,-0.517630,0.00340294|10,5,2,-0.541327,-0.319527,-0.951413,0.00339104|10,5,3,-0.541232,-0.249600,-0.745093,0.00339104|10,5,4,-0.541149,-0.150592,-0.461977,0.00339104|10,6,A,-0.419557,-0.195609,-0.454581,0.00340294|10,6,2,-0.542220,-0.249607,-0.746677,0.00339104|10,6,3,-0.542126,-0.151214,-0.463526,0.00339104|10,6,4,-0.542043,0.026796,-0.005603,0.00339104|10,6,5,-0.541929,0.118582,0.178451,0.00339104|10,7,A,-0.179563,-0.142912,-0.342747,0.00340294|10,7,2,-0.538594,-0.153086,-0.461749,0.00339104|10,7,3,-0.538501,0.026088,-0.005043,0.00339104|10,7,4,-0.538420,0.117891,0.178371,0.00339104|10,7,5,-0.538285,-0.381631,-0.795997,0.00339104|10,7,6,-0.539184,-0.429243,-0.874234,0.00339104|10,8,A,0.063321,-0.087616,-0.233592,0.00340294|10,8,2,-0.539225,0.026194,-0.006360,0.00339104|10,8,3,-0.539132,0.117850,0.176919,0.00339104|10,8,4,-0.539031,-0.381867,-0.798324,0.00339104|10,8,5,-0.538919,-0.428628,-0.874191,0.00339104|10,8,6,-0.539818,-0.466098,-0.938057,0.00339104|10,8,7,-0.536220,-0.499763,-0.999525,0.00339104|10,9,A,0.554555,0.022689,-0.015427,0.00340294|10,9,2,-0.539813,0.117046,0.173923,0.00339104|10,9,3,-0.539699,-0.382340,-0.800788,0.00339104|10,9,4,-0.539621,-0.421082,-0.859767,0.00339104|10,9,5,-0.539508,-0.464190,-0.933839,0.00339104|10,9,6,-0.540408,-0.505345,-1.011406,0.00339104|10,9,7,-0.536809,-0.535392,-1.070784,0.00339104|10,9,8,-0.415036,-0.580276,-1.160553,0.00339104|10,10,A,1.500000,0.117057,0.173198,0.01346998|10,10,2,-0.540337,-0.375660,-0.787819,0.01342288|10,10,3,-0.540246,-0.420242,-0.858713,0.01342288|10,10,4,-0.540168,-0.463098,-0.932032,0.01342288|10,10,5,-0.540055,-0.503907,-1.007815,0.01342288|10,10,6,-0.540954,-0.534676,-1.069351,0.01342288|10,10,7,-0.418457,-0.580066,-1.160132,0.01342288|10,10,8,-0.174546,-0.643745,-1.287489,0.01342288|10,10,9,0.069444,-0.726389,-1.452778,0.01342288`;
  const blackjackInitialEv6dH17 = new Map(blackjackInitialEv6dH17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,seventh,eighth] = row.split(',');
    const pair = first === second;
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:pair ? null : Number(seventh),
      ...(pair ? {splitNoDas:Number(seventh),splitDas:Number(eighth)} : {})
    }];
  }));
  const blackjackInitialEv6dS17Data = `A,A,A,-0.666458,-0.022206,-0.620238,0.127144,0.127144|A,2,2,-0.665989,-0.254310,-1.331978,-0.435464,-0.435464|A,3,3,-0.665541,-0.309143,-1.303229,-0.483312,-0.483312|A,4,4,-0.664958,-0.198744,-0.807840,-0.563615,-0.563615|A,5,5,-0.664378,0.082875,-0.002421,-0.677139,-0.677139|A,6,6,-0.659438,-0.356496,-0.831043,-0.655291,-0.655291|A,7,7,-0.661343,-0.448700,-0.947415,-0.645587,-0.645587|A,8,8,-0.663258,-0.513551,-1.027102,-0.364371,-0.364371|A,9,9,-0.093071,-0.626095,-1.252191,-0.125683,-0.125683|A,10,10,0.654582,-0.857109,-1.714218,-0.316251,-0.316251|2,A,A,-0.289870,0.083842,-0.063039,0.485870,0.485870|2,2,2,-0.292530,-0.114739,-0.585060,-0.153361,-0.077684|2,3,3,-0.292445,-0.142183,-0.563298,-0.209728,-0.133356|2,4,4,-0.291830,-0.019850,-0.200240,-0.263576,-0.186888|2,5,5,-0.287112,0.189215,0.373180,-0.322951,-0.278099|2,6,6,-0.288075,-0.253323,-0.506645,-0.274276,-0.196702|2,7,7,-0.289069,-0.369250,-0.738501,-0.196447,-0.119508|2,8,8,-0.290038,-0.468469,-0.936938,0.007170,0.082116|2,9,9,0.124232,-0.623270,-1.246540,0.157256,0.198253|2,10,10,0.637885,-0.853873,-1.707745,0.099613,0.099613|3,A,A,-0.248796,0.106038,0.002989,0.533182,0.533182|3,2,2,-0.251293,-0.082064,-0.502587,-0.096476,-0.005954|3,3,3,-0.250687,-0.108263,-0.480703,-0.139334,-0.049267|3,4,4,-0.246007,0.011580,-0.126731,-0.185541,-0.093463|3,5,5,-0.245116,0.213958,0.425665,-0.247489,-0.192429|3,6,6,-0.246070,-0.231966,-0.463931,-0.196866,-0.098544|3,7,7,-0.247072,-0.355164,-0.710327,-0.124884,-0.027915|3,8,8,-0.248413,-0.461664,-0.923328,0.070609,0.154853|3,9,9,0.144792,-0.622799,-1.245598,0.206285,0.252589|3,10,10,0.647984,-0.853605,-1.707210,0.182953,0.182953|4,A,A,-0.205803,0.129004,0.071156,0.582709,0.582709|4,2,2,-0.207678,-0.046774,-0.415355,-0.036159,0.069722|4,3,3,-0.203005,-0.068783,-0.386312,-0.057537,0.049837|4,4,4,-0.202102,0.048027,-0.049346,-0.105325,0.003626|4,5,5,-0.201329,0.240560,0.481119,-0.165747,-0.096008|4,6,6,-0.202253,-0.210060,-0.420120,-0.114932,0.005071|4,7,7,-0.203668,-0.340486,-0.680972,-0.047634,0.072562|4,8,8,-0.211502,-0.456910,-0.913820,0.129760,0.223524|4,9,9,0.174080,-0.614207,-1.228414,0.269646,0.320662|4,10,10,0.658450,-0.853371,-1.706741,0.269971,0.269971|5,A,A,-0.160846,0.160724,0.140787,0.633923,0.633923|5,2,2,-0.157959,-0.004963,-0.315919,0.051252,0.174515|5,3,3,-0.157112,-0.028184,-0.295400,0.026425,0.154494|5,4,4,-0.156310,0.083624,0.027678,-0.020168,0.111900|5,5,5,-0.155585,0.270245,0.540491,-0.075471,0.012315|5,6,6,-0.156998,-0.188561,-0.377121,-0.029732,0.112973|5,7,7,-0.164886,-0.329183,-0.658367,0.020214,0.160460|5,8,8,-0.166521,-0.449933,-0.899865,0.200345,0.303949|5,9,9,0.200047,-0.611359,-1.222718,0.338242,0.394070|5,10,10,0.670892,-0.853070,-1.706139,0.365917,0.365917|6,A,A,-0.145699,0.187973,0.190709,0.682366,0.682366|6,2,2,-0.148979,0.014623,-0.297957,0.097718,0.240682|6,3,3,-0.148235,-0.008642,-0.271320,0.070576,0.216911|6,4,4,-0.147552,0.124399,0.103556,0.017973,0.168189|6,5,5,-0.146921,0.299427,0.598853,-0.038793,0.062410|6,6,6,-0.154706,-0.173833,-0.347667,-0.001979,0.158580|6,7,7,-0.156222,-0.311022,-0.622045,0.093478,0.249022|6,8,8,-0.157495,-0.425486,-0.850971,0.292983,0.405899|6,9,9,0.280805,-0.604091,-1.208183,0.404149,0.464217|6,10,10,0.702826,-0.852263,-1.704526,0.444942,0.444942|7,A,A,-0.471742,0.164333,-0.176403,0.475600,0.475600|7,2,2,-0.474621,-0.088828,-0.949243,-0.048572,0.008597|7,3,3,-0.473963,-0.153797,-0.890244,-0.108445,-0.051101|7,4,4,-0.473283,0.086616,-0.175100,-0.227233,-0.168774|7,5,5,-0.476217,0.260394,0.404746,-0.330901,-0.297599|7,6,6,-0.477738,-0.220562,-0.520123,-0.311678,-0.252905|7,7,7,-0.479132,-0.331784,-0.691921,-0.104889,-0.048567|7,8,8,-0.480181,-0.408423,-0.816845,0.264110,0.318876|7,9,9,0.399576,-0.587176,-1.174353,0.334523,0.364180|7,10,10,0.772011,-0.850445,-1.700890,0.262033,0.262033|8,A,A,-0.508761,0.094585,-0.311501,0.359708,0.359708|8,2,2,-0.511247,-0.156790,-1.022494,-0.215128,-0.176794|8,3,3,-0.510567,-0.219182,-1.001140,-0.269599,-0.230664|8,4,4,-0.513430,-0.059090,-0.451036,-0.365344,-0.325801|8,5,5,-0.513325,0.199537,0.293033,-0.482787,-0.459393|8,6,6,-0.514636,-0.279301,-0.630537,-0.456194,-0.416429|8,7,7,-0.515767,-0.377709,-0.780906,-0.429288,-0.390952|8,8,8,-0.517509,-0.453401,-0.906802,-0.065211,-0.029242|8,9,9,0.099261,-0.587148,-1.174296,0.208880,0.229929|8,10,10,0.790420,-0.850101,-1.700201,0.012522,0.012522|9,A,A,-0.538085,-0.000333,-0.450881,0.237754,0.237754|9,2,2,-0.540137,-0.237873,-1.080275,-0.403662,-0.384407|9,3,3,-0.543009,-0.295264,-1.067368,-0.450388,-0.431618|9,4,4,-0.542865,-0.209848,-0.715694,-0.527732,-0.508478|9,5,5,-0.542661,0.116653,0.149188,-0.652354,-0.638481|9,6,6,-0.543905,-0.347155,-0.749935,-0.621483,-0.602063|9,7,7,-0.545528,-0.437912,-0.894019,-0.591483,-0.573526|9,8,8,-0.538890,-0.505707,-1.011415,-0.408743,-0.389950|9,9,9,-0.185235,-0.613052,-1.226103,-0.093583,-0.081564|9,10,10,0.756075,-0.849438,-1.698876,-0.272562,-0.272562|10,A,A,-0.538797,-0.066310,-0.506650,0.181988,0.181988|10,2,2,-0.541589,-0.287099,-1.083178,-0.511458,-0.500907|10,3,3,-0.541402,-0.338693,-1.063997,-0.557327,-0.546375|10,4,4,-0.541266,-0.247994,-0.745112,-0.630523,-0.619294|10,5,5,-0.541033,0.027154,-0.004071,-0.740968,-0.729749|10,6,6,-0.542783,-0.381953,-0.798288,-0.718928,-0.707854|10,7,7,-0.535586,-0.474064,-0.953611,-0.663501,-0.652075|10,8,8,-0.536853,-0.535361,-1.070722,-0.486276,-0.475385|10,9,9,-0.171080,-0.643985,-1.287970,-0.320012,-0.309996|10,10,10,0.559145,-0.847142,-1.694283,-0.419582,-0.419582`;
  const blackjackInitialEv6dS17 = new Map(blackjackInitialEv6dS17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv8dS17Data = `A,A,A,-0.666586,-0.021787,-0.621280,0.122585,0.122585|A,2,2,-0.666234,-0.254032,-1.332469,-0.435121,-0.435121|A,3,3,-0.665885,-0.307904,-1.303616,-0.483293,-0.483293|A,4,4,-0.665452,-0.198307,-0.808551,-0.562906,-0.562906|A,5,5,-0.665013,0.082514,-0.005328,-0.675211,-0.675211|A,6,6,-0.661344,-0.355007,-0.830645,-0.655002,-0.655002|A,7,7,-0.662761,-0.446511,-0.943493,-0.647280,-0.647280|A,8,8,-0.664189,-0.514455,-1.028909,-0.366507,-0.366507|A,9,9,-0.094866,-0.626196,-1.252392,-0.128495,-0.128495|A,10,10,0.654804,-0.855859,-1.711719,-0.311693,-0.311693|2,A,A,-0.290603,0.083335,-0.065179,0.482040,0.482040|2,2,2,-0.292593,-0.114785,-0.585187,-0.154609,-0.079369|2,3,3,-0.292508,-0.141807,-0.563445,-0.210209,-0.134443|2,4,4,-0.292052,-0.020323,-0.201274,-0.264257,-0.188251|2,5,5,-0.288545,0.187530,0.369607,-0.325583,-0.281172|2,6,6,-0.289268,-0.253341,-0.506682,-0.277397,-0.200763|2,7,7,-0.290011,-0.367475,-0.734950,-0.198732,-0.122595|2,8,8,-0.290732,-0.469110,-0.938221,0.005356,0.080057|2,9,9,0.123607,-0.623062,-1.246123,0.156400,0.197658|2,10,10,0.638411,-0.854215,-1.708429,0.101625,0.101625|3,A,A,-0.249656,0.105396,0.000430,0.529319,0.529319|3,2,2,-0.251510,-0.082188,-0.503021,-0.097979,-0.008365|3,3,3,-0.251061,-0.107994,-0.481425,-0.140262,-0.050980|3,4,4,-0.247575,0.010694,-0.129088,-0.188057,-0.097275|3,5,5,-0.246918,0.211985,0.421564,-0.250669,-0.196540|3,6,6,-0.247638,-0.232403,-0.464807,-0.200527,-0.103877|3,7,7,-0.248377,-0.353549,-0.707098,-0.127667,-0.031884|3,8,8,-0.249378,-0.462197,-0.924394,0.068712,0.152738|3,9,9,0.145696,-0.622092,-1.244184,0.207800,0.254176|3,10,10,0.648558,-0.853951,-1.707901,0.184549,0.184549|4,A,A,-0.207125,0.128395,0.067963,0.578527,0.578527|4,2,2,-0.208518,-0.047417,-0.417037,-0.038071,0.066962|4,3,3,-0.205038,-0.069820,-0.390280,-0.061282,0.044869|4,4,4,-0.204374,0.045695,-0.053651,-0.109719,-0.002424|4,5,5,-0.203797,0.238015,0.476030,-0.170566,-0.101879|4,6,6,-0.204492,-0.210944,-0.421888,-0.119870,-0.001561|4,7,7,-0.205534,-0.339089,-0.678179,-0.051793,0.066743|4,8,8,-0.211384,-0.456748,-0.913496,0.129383,0.222933|4,9,9,0.174514,-0.615026,-1.230053,0.270364,0.321426|4,10,10,0.659104,-0.853708,-1.707416,0.270716,0.270716|5,A,A,-0.162429,0.159662,0.137072,0.629103,0.629103|5,2,2,-0.160295,-0.006838,-0.320589,0.047044,0.168492|5,3,3,-0.159662,-0.029883,-0.300505,0.021429,0.147448|5,4,4,-0.159069,0.080384,0.021547,-0.025529,0.104401|5,5,5,-0.158528,0.266709,0.533417,-0.081932,0.004401|5,6,6,-0.159570,-0.189754,-0.379509,-0.035524,0.104967|5,7,7,-0.165451,-0.327224,-0.654448,0.018224,0.157073|5,8,8,-0.166676,-0.449825,-0.899649,0.199232,0.302428|5,9,9,0.199923,-0.612343,-1.224686,0.337854,0.393623|5,10,10,0.670758,-0.853425,-1.706850,0.365625,0.365625|6,A,A,-0.147712,0.187459,0.187954,0.678612,0.678612|6,2,2,-0.150164,0.013750,-0.300329,0.095682,0.237313|6,3,3,-0.149613,-0.009737,-0.273997,0.067897,0.213080|6,4,4,-0.149105,0.122018,0.099381,0.014999,0.164035|6,5,5,-0.148624,0.296494,0.592989,-0.042368,0.058205|6,6,6,-0.154424,-0.172989,-0.345978,-0.002346,0.157466|6,7,7,-0.155561,-0.308423,-0.616847,0.094053,0.248742|6,8,8,-0.156536,-0.426855,-0.853711,0.294064,0.406860|6,9,9,0.281479,-0.604941,-1.209883,0.405988,0.466133|6,10,10,0.703108,-0.852607,-1.705213,0.447575,0.447575|7,A,A,-0.472657,0.164619,-0.178282,0.472412,0.472412|7,2,2,-0.474809,-0.088690,-0.949618,-0.048579,0.008153|7,3,3,-0.474314,-0.153324,-0.891195,-0.108462,-0.051586|7,4,4,-0.473807,0.085502,-0.178278,-0.225917,-0.168204|7,5,5,-0.475985,0.259518,0.401662,-0.329653,-0.296742|7,6,6,-0.477126,-0.218600,-0.516704,-0.313800,-0.255866|7,7,7,-0.478169,-0.329129,-0.685903,-0.105023,-0.048918|7,8,8,-0.478988,-0.410029,-0.820058,0.264576,0.319500|7,9,9,0.399563,-0.588176,-1.176352,0.334482,0.364447|7,10,10,0.772322,-0.850799,-1.701598,0.264284,0.264284|8,A,A,-0.509202,0.094712,-0.312243,0.357443,0.357443|8,2,2,-0.511065,-0.157443,-1.022129,-0.215029,-0.176800|8,3,3,-0.510557,-0.218685,-1.001173,-0.269707,-0.231032|8,4,4,-0.512695,-0.059294,-0.451269,-0.365079,-0.325947|8,5,5,-0.512604,0.199141,0.291445,-0.481348,-0.458202|8,6,6,-0.513603,-0.277348,-0.626780,-0.458017,-0.418724|8,7,7,-0.514468,-0.376254,-0.777224,-0.429551,-0.391334|8,8,8,-0.515767,-0.454672,-0.909343,-0.064082,-0.027641|8,9,9,0.100941,-0.588133,-1.176265,0.209863,0.231110|8,10,10,0.790770,-0.850451,-1.700902,0.015727,0.015727|9,A,A,-0.539362,-0.000231,-0.452269,0.235248,0.235248|9,2,2,-0.540900,-0.238579,-1.081800,-0.403973,-0.385126|9,3,3,-0.543042,-0.294599,-1.067483,-0.451476,-0.432996|9,4,4,-0.542930,-0.209943,-0.716400,-0.528123,-0.509275|9,5,5,-0.542781,0.116614,0.147967,-0.651132,-0.637534|9,6,6,-0.543711,-0.345349,-0.746796,-0.623318,-0.604348|9,7,7,-0.544944,-0.436155,-0.890006,-0.592570,-0.574705|9,8,8,-0.539962,-0.506614,-1.013229,-0.407864,-0.389375|9,9,9,-0.184712,-0.613927,-1.227853,-0.092854,-0.080698|9,10,10,0.756649,-0.849789,-1.699578,-0.269076,-0.269076|10,A,A,-0.539205,-0.067249,-0.508503,0.181408,0.181408|10,2,2,-0.541301,-0.287637,-1.082602,-0.513278,-0.502637|10,3,3,-0.541162,-0.338463,-1.063576,-0.559282,-0.548341|10,4,4,-0.541048,-0.248356,-0.745474,-0.632076,-0.620925|10,5,5,-0.540876,0.026671,-0.005214,-0.741158,-0.730015|10,6,6,-0.542207,-0.381725,-0.797936,-0.721149,-0.710120|10,7,7,-0.536807,-0.472124,-0.949744,-0.664866,-0.653572|10,8,8,-0.537752,-0.536485,-1.072970,-0.487742,-0.476849|10,9,9,-0.172895,-0.644913,-1.289826,-0.322157,-0.311919|10,10,10,0.557987,-0.847618,-1.695235,-0.419974,-0.419974`;
  const blackjackInitialEv8dS17 = new Map(blackjackInitialEv8dS17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv8dH17Data = `A,A,A,-0.597839,-0.064439,-0.586446,0.116549,0.116549|A,2,2,-0.597338,-0.292566,-1.194675,-0.524461,-0.522828|A,3,3,-0.596828,-0.343405,-1.181256,-0.569791,-0.567719|A,4,4,-0.596279,-0.263777,-0.830517,-0.640187,-0.637593|A,5,5,-0.596461,0.034059,-0.028259,-0.754114,-0.751341|A,6,6,-0.595536,-0.386488,-0.836824,-0.730757,-0.728026|A,7,7,-0.594187,-0.475418,-0.972494,-0.733693,-0.731218|A,8,8,-0.595796,-0.539453,-1.078906,-0.518625,-0.516925|A,9,9,-0.221073,-0.638594,-1.277188,-0.244805,-0.243871|A,10,10,0.600677,-0.857214,-1.714428,-0.449008,-0.449008|2,A,A,-0.284645,0.081466,-0.062173,0.481540,0.481540|2,2,2,-0.286259,-0.112626,-0.572519,-0.155196,-0.080006|2,3,3,-0.286129,-0.138949,-0.552136,-0.206369,-0.130638|2,4,4,-0.285956,-0.022792,-0.203115,-0.258929,-0.182945|2,5,5,-0.282185,0.185996,0.367548,-0.319547,-0.275097|2,6,6,-0.282929,-0.253650,-0.507300,-0.270820,-0.194233|2,7,7,-0.283691,-0.368785,-0.737570,-0.200588,-0.123412|2,8,8,-0.284429,-0.471348,-0.942696,-0.002055,0.072611|2,9,9,0.112141,-0.624180,-1.248359,0.153189,0.194489|2,10,10,0.633452,-0.854339,-1.708677,0.100487,0.100487|3,A,A,-0.244405,0.103750,0.003080,0.528868,0.528868|3,2,2,-0.245899,-0.080271,-0.491799,-0.098512,-0.008962|3,3,3,-0.245732,-0.105607,-0.471977,-0.137081,-0.047839|3,4,4,-0.241915,0.008401,-0.130794,-0.183062,-0.092303|3,5,5,-0.241313,0.210620,0.419754,-0.245336,-0.191185|3,6,6,-0.242051,-0.232674,-0.465349,-0.194733,-0.098149|3,7,7,-0.242807,-0.354696,-0.709392,-0.129305,-0.032580|3,8,8,-0.243822,-0.464173,-0.928346,0.062177,0.146169|3,9,9,0.135585,-0.623082,-1.246163,0.205014,0.251428|3,10,10,0.644190,-0.854062,-1.708124,0.183490,0.183490|4,A,A,-0.202098,0.128661,0.070502,0.578111,0.578111|4,2,2,-0.203452,-0.045028,-0.406904,-0.033961,0.070794|4,3,3,-0.199640,-0.066794,-0.380712,-0.056360,0.049514|4,4,4,-0.198971,0.043972,-0.055286,-0.103434,0.003880|4,5,5,-0.198446,0.237153,0.474306,-0.164048,-0.095272|4,6,6,-0.199159,-0.211201,-0.422402,-0.113919,0.004017|4,7,7,-0.200216,-0.340184,-0.680368,-0.052113,0.067081|4,8,8,-0.206080,-0.458635,-0.917270,0.124281,0.217652|4,9,9,0.164860,-0.615969,-1.231937,0.268756,0.319779|4,10,10,0.654940,-0.853812,-1.707624,0.271400,0.271400|5,A,A,-0.160232,0.159763,0.138175,0.628892,0.628892|5,2,2,-0.157786,-0.005663,-0.315573,0.049078,0.170547|5,3,3,-0.157151,-0.028484,-0.296039,0.023708,0.149737|5,4,4,-0.156555,0.079564,0.020767,-0.022598,0.107326|5,5,5,-0.156040,0.266294,0.532588,-0.078941,0.007421|5,6,6,-0.157089,-0.189878,-0.379756,-0.032778,0.107528|5,7,7,-0.162978,-0.327749,-0.655499,0.018045,0.157179|5,8,8,-0.164209,-0.450726,-0.901453,0.196814,0.299919|5,9,9,0.195376,-0.612786,-1.225571,0.337066,0.392814|5,10,10,0.668790,-0.853473,-1.706946,0.365921,0.365921|6,A,A,-0.116641,0.188937,0.203740,0.675893,0.675893|6,2,2,-0.116983,0.029218,-0.233966,0.122449,0.264417|6,3,3,-0.116393,0.008593,-0.215191,0.097860,0.243244|6,4,4,-0.115849,0.110966,0.088623,0.053572,0.202590|6,5,5,-0.115700,0.290927,0.581855,-0.002754,0.098205|6,6,6,-0.121606,-0.174496,-0.348991,0.033551,0.190854|6,7,7,-0.122841,-0.315381,-0.630763,0.091084,0.249695|6,8,8,-0.123902,-0.438879,-0.877758,0.261636,0.374948|6,9,9,0.221002,-0.610904,-1.221807,0.395347,0.455232|6,10,10,0.677004,-0.853263,-1.706525,0.451182,0.451182|7,A,A,-0.472657,0.164619,-0.178282,0.472412,0.472412|7,2,2,-0.474809,-0.088690,-0.949618,-0.048579,0.008153|7,3,3,-0.474314,-0.153324,-0.891195,-0.108462,-0.051586|7,4,4,-0.473807,0.085502,-0.178278,-0.225917,-0.168204|7,5,5,-0.475985,0.259518,0.401662,-0.329653,-0.296742|7,6,6,-0.477126,-0.218600,-0.516704,-0.313800,-0.255866|7,7,7,-0.478169,-0.329129,-0.685903,-0.105023,-0.048918|7,8,8,-0.478988,-0.410029,-0.820058,0.264576,0.319500|7,9,9,0.399563,-0.588176,-1.176352,0.334482,0.364447|7,10,10,0.772322,-0.850799,-1.701598,0.264284,0.264284|8,A,A,-0.509202,0.094712,-0.312243,0.357443,0.357443|8,2,2,-0.511065,-0.157443,-1.022129,-0.215029,-0.176800|8,3,3,-0.510557,-0.218685,-1.001173,-0.269707,-0.231032|8,4,4,-0.512695,-0.059294,-0.451269,-0.365079,-0.325947|8,5,5,-0.512604,0.199141,0.291445,-0.481348,-0.458202|8,6,6,-0.513603,-0.277348,-0.626780,-0.458017,-0.418724|8,7,7,-0.514468,-0.376254,-0.777224,-0.429551,-0.391334|8,8,8,-0.515767,-0.454672,-0.909343,-0.064082,-0.027641|8,9,9,0.100941,-0.588133,-1.176265,0.209863,0.231110|8,10,10,0.790770,-0.850451,-1.700902,0.015727,0.015727|9,A,A,-0.539362,-0.000231,-0.452269,0.235248,0.235248|9,2,2,-0.540900,-0.238579,-1.081800,-0.403973,-0.385126|9,3,3,-0.543042,-0.294599,-1.067483,-0.451476,-0.432996|9,4,4,-0.542930,-0.209943,-0.716400,-0.528123,-0.509275|9,5,5,-0.542781,0.116614,0.147967,-0.651132,-0.637534|9,6,6,-0.543711,-0.345349,-0.746796,-0.623318,-0.604348|9,7,7,-0.544944,-0.436155,-0.890006,-0.592570,-0.574705|9,8,8,-0.539962,-0.506614,-1.013229,-0.407864,-0.389375|9,9,9,-0.184712,-0.613927,-1.227853,-0.092854,-0.080698|9,10,10,0.756649,-0.849789,-1.699578,-0.269076,-0.269076|10,A,A,-0.539205,-0.067249,-0.508503,0.181408,0.181408|10,2,2,-0.541301,-0.287637,-1.082602,-0.513278,-0.502637|10,3,3,-0.541162,-0.338463,-1.063576,-0.559282,-0.548341|10,4,4,-0.541048,-0.248356,-0.745474,-0.632076,-0.620925|10,5,5,-0.540876,0.026671,-0.005214,-0.741158,-0.730015|10,6,6,-0.542207,-0.381725,-0.797936,-0.721149,-0.710120|10,7,7,-0.536807,-0.472124,-0.949744,-0.664866,-0.653572|10,8,8,-0.537752,-0.536485,-1.072970,-0.487742,-0.476849|10,9,9,-0.172895,-0.644913,-1.289826,-0.322157,-0.311919|10,10,10,0.557987,-0.847618,-1.695235,-0.419974,-0.419974`;
  const blackjackInitialEv8dH17 = new Map(blackjackInitialEv8dH17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv4dS17Data = `A,A,A,-0.666194,-0.023042,-0.618147,0.136338,0.136338|A,2,2,-0.665487,-0.254852,-1.330973,-0.436065,-0.436065|A,3,3,-0.664871,-0.311622,-1.302485,-0.483294,-0.483294|A,4,4,-0.663979,-0.199637,-0.806452,-0.564980,-0.564967|A,5,5,-0.663125,0.083604,0.003395,-0.680970,-0.680825|A,6,6,-0.655570,-0.359475,-0.831783,-0.655819,-0.655646|A,7,7,-0.658474,-0.453109,-0.955310,-0.642188,-0.642188|A,8,8,-0.661381,-0.511736,-1.023472,-0.360130,-0.360130|A,9,9,-0.089453,-0.625904,-1.251808,-0.120073,-0.120073|A,10,10,0.654136,-0.859623,-1.719247,-0.325389,-0.325389|2,A,A,-0.288391,0.084868,-0.058748,0.493574,0.493574|2,2,2,-0.292402,-0.114641,-0.584803,-0.150876,-0.073966|2,3,3,-0.292366,-0.142977,-0.563092,-0.208846,-0.131262|2,4,4,-0.291419,-0.018929,-0.198235,-0.262294,-0.184246|2,5,5,-0.284214,0.192598,0.380351,-0.317681,-0.271851|2,6,6,-0.285656,-0.253283,-0.506565,-0.268028,-0.188340|2,7,7,-0.287158,-0.372824,-0.745647,-0.191883,-0.112768|2,8,8,-0.288633,-0.467167,-0.934334,0.010806,0.086230|2,9,9,0.125487,-0.623687,-1.247374,0.158954,0.199424|2,10,10,0.636830,-0.853184,-1.706367,0.095590,0.095590|3,A,A,-0.247084,0.107339,0.008117,0.540940,0.540940|3,2,2,-0.250905,-0.081843,-0.501811,-0.093509,-0.001174|3,3,3,-0.249976,-0.108859,-0.479328,-0.137574,-0.045956|3,4,4,-0.242856,0.013335,-0.122047,-0.180556,-0.085894|3,5,5,-0.241474,0.217915,0.433895,-0.241122,-0.184195|3,6,6,-0.242888,-0.231077,-0.462154,-0.189528,-0.087869|3,7,7,-0.244441,-0.358404,-0.716809,-0.119313,-0.019984|3,8,8,-0.246472,-0.460584,-0.921167,0.074372,0.159037|3,9,9,0.142932,-0.624231,-1.248461,0.203200,0.249354|3,10,10,0.646830,-0.852909,-1.705817,0.179776,0.179776|4,A,A,-0.203147,0.130517,0.077564,0.591106,0.591106|4,2,2,-0.206009,-0.045498,-0.412018,-0.031764,0.075810|4,3,3,-0.198901,-0.066701,-0.378308,-0.050056,0.059764|4,4,4,-0.197491,0.052735,-0.040638,-0.096531,0.015735|4,5,5,-0.196320,0.245694,0.491389,-0.156041,-0.084203|4,6,6,-0.197701,-0.208262,-0.416523,-0.105007,0.018378|4,7,7,-0.199903,-0.343285,-0.686570,-0.039324,0.084187|4,8,8,-0.211757,-0.457247,-0.914494,0.130449,0.224636|4,9,9,0.173230,-0.612558,-1.225116,0.268250,0.319178|4,10,10,0.657136,-0.852691,-1.705382,0.268547,0.268547|5,A,A,-0.157688,0.162849,0.148228,0.643588,0.643588|5,2,2,-0.153234,-0.001167,-0.306468,0.059689,0.186583|5,3,3,-0.151949,-0.024753,-0.285067,0.036452,0.168629|5,4,4,-0.150714,0.090177,0.040095,-0.009388,0.126949|5,5,5,-0.149611,0.277401,0.554803,-0.062490,0.028234|5,6,6,-0.151806,-0.186140,-0.372279,-0.018144,0.128988|5,7,7,-0.163779,-0.333129,-0.666258,0.024132,0.167171|5,8,8,-0.166236,-0.450158,-0.900316,0.202504,0.306923|5,9,9,0.200299,-0.609372,-1.218745,0.339065,0.395015|5,10,10,0.671161,-0.852354,-1.704708,0.366530,0.366530|6,A,A,-0.141645,0.189020,0.196249,0.689889,0.689889|6,2,2,-0.146596,0.016371,-0.293191,0.101755,0.247368|6,3,3,-0.145457,-0.006444,-0.265922,0.075920,0.224567|6,4,4,-0.144416,0.129206,0.111986,0.023919,0.176484|6,5,5,-0.143496,0.305341,0.610682,-0.031656,0.070816|6,6,6,-0.155330,-0.175559,-0.351118,-0.001380,0.160640|6,7,7,-0.157606,-0.316272,-0.632543,0.092196,0.249423|6,8,8,-0.159434,-0.422727,-0.845454,0.290792,0.403949|6,9,9,0.279430,-0.602385,-1.204771,0.400449,0.460358|6,10,10,0.702265,-0.851570,-1.703141,0.439670,0.439670|7,A,A,-0.469898,0.163757,-0.172621,0.481997,0.481997|7,2,2,-0.474248,-0.089107,-0.948496,-0.048593,0.009444|7,3,3,-0.473262,-0.154760,-0.888339,-0.108412,-0.050171|7,4,4,-0.472234,0.088868,-0.168701,-0.229879,-0.169963|7,5,5,-0.476727,0.262157,0.410917,-0.333366,-0.299294|7,6,6,-0.479008,-0.224556,-0.527096,-0.307410,-0.246964|7,7,7,-0.481104,-0.337152,-0.704102,-0.104738,-0.048004|7,8,8,-0.482548,-0.405174,-0.810348,0.263126,0.317582|7,9,9,0.399617,-0.585162,-1.170324,0.334607,0.363647|7,10,10,0.771374,-0.849732,-1.699465,0.257538,0.257538|8,A,A,-0.507875,0.094344,-0.310003,0.364258,0.364258|8,2,2,-0.511613,-0.155451,-1.023226,-0.215345,-0.176815|8,3,3,-0.510585,-0.220202,-1.001065,-0.269360,-0.229910|8,4,4,-0.514918,-0.058680,-0.450579,-0.365868,-0.325509|8,5,5,-0.514807,0.200331,0.296188,-0.485644,-0.461764|8,6,6,-0.516710,-0.283253,-0.638127,-0.452532,-0.411820|8,7,7,-0.518333,-0.380634,-0.788316,-0.428743,-0.390152|8,8,8,-0.520981,-0.450837,-0.901675,-0.067474,-0.032440|8,9,9,0.095884,-0.585162,-1.170324,0.206929,0.227585|8,10,10,0.789718,-0.849395,-1.698790,0.006145,0.006145|9,A,A,-0.535511,-0.000541,-0.448071,0.242792,0.242792|9,2,2,-0.538592,-0.236442,-1.077184,-0.403033,-0.382969|9,3,3,-0.542943,-0.296613,-1.067142,-0.448178,-0.428832|9,4,4,-0.542748,-0.209639,-0.714277,-0.526941,-0.506881|9,5,5,-0.542426,0.116751,0.151645,-0.654780,-0.640367|9,6,6,-0.544301,-0.350806,-0.756276,-0.617811,-0.597494|9,7,7,-0.546673,-0.441447,-0.902100,-0.589299,-0.571146|9,8,8,-0.536732,-0.503887,-1.007774,-0.410528,-0.391112|9,9,9,-0.186289,-0.611291,-1.222581,-0.095054,-0.083302|9,10,10,0.754917,-0.848731,-1.697462,-0.279489,-0.279489|10,A,A,-0.537981,-0.064423,-0.502927,0.183155,0.183155|10,2,2,-0.542162,-0.286004,-1.084324,-0.507807,-0.497438|10,3,3,-0.541877,-0.339159,-1.064826,-0.553395,-0.542421|10,4,4,-0.541723,-0.247273,-0.744401,-0.627410,-0.616031|10,5,5,-0.541359,0.028133,-0.001792,-0.740571,-0.729207|10,6,6,-0.543907,-0.382407,-0.798973,-0.714449,-0.703285|10,7,7,-0.533125,-0.477970,-0.961397,-0.660761,-0.649067|10,8,8,-0.535048,-0.533098,-1.066195,-0.483352,-0.472463|10,9,9,-0.167428,-0.642116,-1.284232,-0.315720,-0.306151|10,10,10,0.561473,-0.846180,-1.692361,-0.418713,-0.418713`;
  const blackjackInitialEv4dS17 = new Map(blackjackInitialEv4dS17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv4dH17Data = `A,A,A,-0.596977,-0.065388,-0.582574,0.129936,0.129936|A,2,2,-0.595967,-0.292870,-1.191935,-0.523610,-0.520445|A,3,3,-0.594987,-0.346177,-1.177947,-0.567817,-0.563775|A,4,4,-0.593902,-0.264116,-0.827063,-0.639149,-0.634071|A,5,5,-0.594290,0.035263,-0.020254,-0.758331,-0.752908|A,6,6,-0.592290,-0.388892,-0.836346,-0.727365,-0.721978|A,7,7,-0.589617,-0.481972,-0.984407,-0.728085,-0.723218|A,8,8,-0.592875,-0.536768,-1.073536,-0.512423,-0.509113|A,9,9,-0.216334,-0.638282,-1.276564,-0.236875,-0.235107|A,10,10,0.599679,-0.860952,-1.721905,-0.462283,-0.462283|2,A,A,-0.282726,0.083156,-0.055862,0.493092,0.493092|2,2,2,-0.285960,-0.112376,-0.571921,-0.151336,-0.074506|2,3,3,-0.285842,-0.139940,-0.551452,-0.204755,-0.127194|2,4,4,-0.285483,-0.021159,-0.199796,-0.256983,-0.178934|2,5,5,-0.277730,0.191055,0.378266,-0.311423,-0.265558|2,6,6,-0.279215,-0.253537,-0.507075,-0.261251,-0.181597|2,7,7,-0.280755,-0.374122,-0.748245,-0.193574,-0.113433|2,8,8,-0.282263,-0.469361,-0.938721,0.003451,0.078851|2,9,9,0.114027,-0.624788,-1.249576,0.155731,0.196240|2,10,10,0.631826,-0.853306,-1.706611,0.094617,0.094617|3,A,A,-0.242201,0.105864,0.010606,0.540506,0.540506|3,2,2,-0.245303,-0.079865,-0.490606,-0.093934,-0.001666|3,3,3,-0.244961,-0.106527,-0.470379,-0.134480,-0.042884|3,4,4,-0.237152,0.011189,-0.123541,-0.175308,-0.080635|3,5,5,-0.235882,0.216556,0.432104,-0.235624,-0.178683|3,6,6,-0.237332,-0.231295,-0.462590,-0.183642,-0.082047|3,7,7,-0.238920,-0.359510,-0.719019,-0.120676,-0.020455|3,8,8,-0.240979,-0.462481,-0.924963,0.068145,0.152774|3,9,9,0.133040,-0.625189,-1.250378,0.200515,0.246702|3,10,10,0.642519,-0.853018,-1.706035,0.178826,0.178826|4,A,A,-0.198317,0.130565,0.080030,0.590708,0.590708|4,2,2,-0.201106,-0.043137,-0.402213,-0.028869,0.078443|4,3,3,-0.193311,-0.063477,-0.368335,-0.044836,0.064732|4,4,4,-0.191887,0.051068,-0.042119,-0.089919,0.022424|4,5,5,-0.190827,0.244820,0.489639,-0.149285,-0.077328|4,6,6,-0.192244,-0.208472,-0.416945,-0.098864,0.024172|4,7,7,-0.194479,-0.344370,-0.688740,-0.039508,0.084642|4,8,8,-0.206360,-0.459113,-0.918225,0.125332,0.219354|4,9,9,0.163507,-0.613494,-1.226987,0.266631,0.317521|4,10,10,0.652914,-0.852794,-1.705588,0.268647,0.268647|5,A,A,-0.155794,0.162955,0.149183,0.643381,0.643381|5,2,2,-0.150729,0.000025,-0.301459,0.061760,0.188657|5,3,3,-0.149439,-0.023324,-0.280561,0.038776,0.170963|5,4,4,-0.148198,0.089391,0.039393,-0.006405,0.129939|5,5,5,-0.147145,0.276981,0.553963,-0.059539,0.031214|5,6,6,-0.149356,-0.186242,-0.372484,-0.015431,0.131522|5,7,7,-0.161344,-0.333648,-0.667296,0.023989,0.167275|5,8,8,-0.163814,-0.451043,-0.902086,0.200119,0.304450|5,9,9,0.195823,-0.609801,-1.219603,0.338258,0.394184|5,10,10,0.669203,-0.852399,-1.704799,0.366853,0.366853|6,A,A,-0.112187,0.190740,0.211466,0.687177,0.687177|6,2,2,-0.112850,0.032260,-0.225700,0.129375,0.275171|6,3,3,-0.111632,0.012463,-0.205750,0.106855,0.255791|6,4,4,-0.110518,0.118208,0.101627,0.063726,0.216500|6,5,5,-0.110282,0.299512,0.599024,0.008196,0.111071|6,6,6,-0.122332,-0.176676,-0.353352,0.034309,0.193783|6,7,7,-0.124808,-0.323281,-0.646562,0.089068,0.249902|6,8,8,-0.126803,-0.434843,-0.869686,0.257753,0.371721|6,9,9,0.218471,-0.608375,-1.216749,0.389160,0.448796|6,10,10,0.675762,-0.852223,-1.704446,0.443399,0.443399|7,A,A,-0.469898,0.163757,-0.172621,0.481997,0.481997|7,2,2,-0.474248,-0.089107,-0.948496,-0.048593,0.009444|7,3,3,-0.473262,-0.154760,-0.888339,-0.108412,-0.050171|7,4,4,-0.472234,0.088868,-0.168701,-0.229879,-0.169963|7,5,5,-0.476727,0.262157,0.410917,-0.333366,-0.299294|7,6,6,-0.479008,-0.224556,-0.527096,-0.307410,-0.246964|7,7,7,-0.481104,-0.337152,-0.704102,-0.104738,-0.048004|7,8,8,-0.482548,-0.405174,-0.810348,0.263126,0.317582|7,9,9,0.399617,-0.585162,-1.170324,0.334607,0.363647|7,10,10,0.771374,-0.849732,-1.699465,0.257538,0.257538|8,A,A,-0.507875,0.094344,-0.310003,0.364258,0.364258|8,2,2,-0.511613,-0.155451,-1.023226,-0.215345,-0.176815|8,3,3,-0.510585,-0.220202,-1.001065,-0.269360,-0.229910|8,4,4,-0.514918,-0.058680,-0.450579,-0.365868,-0.325509|8,5,5,-0.514807,0.200331,0.296188,-0.485644,-0.461764|8,6,6,-0.516710,-0.283253,-0.638127,-0.452532,-0.411820|8,7,7,-0.518333,-0.380634,-0.788316,-0.428743,-0.390152|8,8,8,-0.520981,-0.450837,-0.901675,-0.067474,-0.032440|8,9,9,0.095884,-0.585162,-1.170324,0.206929,0.227585|8,10,10,0.789718,-0.849395,-1.698790,0.006145,0.006145|9,A,A,-0.535511,-0.000541,-0.448071,0.242792,0.242792|9,2,2,-0.538592,-0.236442,-1.077184,-0.403033,-0.382969|9,3,3,-0.542943,-0.296613,-1.067142,-0.448178,-0.428832|9,4,4,-0.542748,-0.209639,-0.714277,-0.526941,-0.506881|9,5,5,-0.542426,0.116751,0.151645,-0.654780,-0.640367|9,6,6,-0.544301,-0.350806,-0.756276,-0.617811,-0.597494|9,7,7,-0.546673,-0.441447,-0.902100,-0.589299,-0.571146|9,8,8,-0.536732,-0.503887,-1.007774,-0.410528,-0.391112|9,9,9,-0.186289,-0.611291,-1.222581,-0.095054,-0.083302|9,10,10,0.754917,-0.848731,-1.697462,-0.279489,-0.279489|10,A,A,-0.537981,-0.064423,-0.502927,0.183155,0.183155|10,2,2,-0.542162,-0.286004,-1.084324,-0.507807,-0.497438|10,3,3,-0.541877,-0.339159,-1.064826,-0.553395,-0.542421|10,4,4,-0.541723,-0.247273,-0.744401,-0.627410,-0.616031|10,5,5,-0.541359,0.028133,-0.001792,-0.740571,-0.729207|10,6,6,-0.543907,-0.382407,-0.798973,-0.714449,-0.703285|10,7,7,-0.533125,-0.477970,-0.961397,-0.660761,-0.649067|10,8,8,-0.535048,-0.533098,-1.066195,-0.483352,-0.472463|10,9,9,-0.167428,-0.642116,-1.284232,-0.315720,-0.306151|10,10,10,0.561473,-0.846180,-1.692361,-0.418713,-0.418713`;
  const blackjackInitialEv4dH17 = new Map(blackjackInitialEv4dH17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv2dS17Data = `A,A,A,-0.665322,-0.025469,-0.611807,0.164548,0.164548|A,2,2,-0.663878,-0.256368,-1.327756,-0.437851,-0.437386|A,3,3,-0.663014,-0.319065,-1.300533,-0.482871,-0.480932|A,4,4,-0.661114,-0.202472,-0.802584,-0.568899,-0.565303|A,5,5,-0.659528,0.085850,0.020818,-0.692277,-0.686737|A,6,6,-0.643494,-0.368407,-0.833531,-0.657006,-0.651098|A,7,7,-0.649594,-0.466588,-0.979387,-0.631918,-0.628820|A,8,8,-0.655627,-0.506225,-1.012450,-0.347646,-0.347342|A,9,9,-0.078374,-0.625411,-1.250822,-0.103364,-0.103364|A,10,10,0.652797,-0.867286,-1.734572,-0.352955,-0.352955|2,A,A,-0.283862,0.088038,-0.045768,0.517050,0.517050|2,2,2,-0.291988,-0.114288,-0.583976,-0.143505,-0.061214|2,3,3,-0.292519,-0.145707,-0.563234,-0.206852,-0.124620|2,4,4,-0.290478,-0.016406,-0.192747,-0.259102,-0.175873|2,5,5,-0.275251,0.202855,0.402068,-0.301809,-0.251170|2,6,6,-0.278126,-0.253133,-0.506266,-0.249248,-0.160614|2,7,7,-0.281210,-0.383726,-0.767452,-0.178233,-0.091470|2,8,8,-0.284276,-0.463093,-0.926185,0.021789,0.098557|2,9,9,0.129292,-0.624946,-1.249892,0.164076,0.202899|2,10,10,0.633650,-0.851076,-1.702151,0.083537,0.083537|3,A,A,-0.242022,0.111397,0.023580,0.564482,0.564482|3,2,2,-0.250141,-0.081419,-0.500282,-0.084913,0.012840|3,3,3,-0.248154,-0.111120,-0.475815,-0.133064,-0.036955|3,4,4,-0.233291,0.018454,-0.108279,-0.165209,-0.062988|3,5,5,-0.230232,0.229862,0.458808,-0.220975,-0.158521|3,6,6,-0.232945,-0.228296,-0.456592,-0.167036,-0.055717|3,7,7,-0.236374,-0.368221,-0.736441,-0.101528,0.004634|3,8,8,-0.240562,-0.457223,-0.914446,0.086440,0.172200|3,9,9,0.136895,-0.628673,-1.257346,0.193594,0.239235|3,10,10,0.643327,-0.850776,-1.701552,0.170357,0.170357|4,A,A,-0.195062,0.135393,0.096965,0.616545,0.616545|4,2,2,-0.201117,-0.041765,-0.402234,-0.018731,0.093892|4,3,3,-0.186291,-0.060388,-0.353751,-0.027708,0.090771|4,4,4,-0.183112,0.067218,-0.013696,-0.070101,0.052111|4,5,5,-0.180685,0.261478,0.522956,-0.126360,-0.048246|4,6,6,-0.183429,-0.202617,-0.405233,-0.074861,0.058614|4,7,7,-0.188334,-0.351727,-0.703455,-0.014451,0.118949|4,8,8,-0.212673,-0.458364,-0.916728,0.132002,0.227419|4,9,9,0.170851,-0.607518,-1.215036,0.264413,0.315099|4,10,10,0.653132,-0.850614,-1.701228,0.264525,0.264525|5,A,A,-0.148301,0.169241,0.170637,0.672798,0.672798|5,2,2,-0.138596,0.010588,-0.277191,0.085173,0.222964|5,3,3,-0.135949,-0.014189,-0.253041,0.066801,0.211407|5,4,4,-0.133254,0.110439,0.078651,0.023463,0.172547|5,5,5,-0.130965,0.299561,0.599122,-0.023091,0.076794|5,6,6,-0.135845,-0.178613,-0.357226,0.016654,0.177047|5,7,7,-0.160661,-0.345179,-0.690358,0.035382,0.186794|5,8,8,-0.165601,-0.450917,-0.901834,0.208452,0.315298|5,9,9,0.201095,-0.603264,-1.206527,0.341918,0.398282|5,10,10,0.671980,-0.850167,-1.700333,0.368606,0.368606|6,A,A,-0.129268,0.192311,0.213109,0.712562,0.712562|6,2,2,-0.139357,0.021616,-0.278715,0.113570,0.267136|6,3,3,-0.136925,0.000220,-0.249373,0.091832,0.249961|6,4,4,-0.134736,0.143985,0.137949,0.041768,0.201293|6,5,5,-0.133084,0.323496,0.646993,-0.010353,0.098168|6,6,6,-0.157726,-0.181043,-0.362087,-0.000650,0.165487|6,7,7,-0.162279,-0.332449,-0.664898,0.087280,0.249339|6,8,8,-0.165417,-0.414294,-0.828588,0.283990,0.397872|6,9,9,0.275070,-0.597222,-1.194444,0.389154,0.448563|6,10,10,0.700605,-0.849453,-1.698906,0.423802,0.423802|7,A,A,-0.464261,0.162012,-0.161064,0.501347,0.501347|7,2,2,-0.473143,-0.089960,-0.946285,-0.048945,0.011632|7,3,3,-0.471189,-0.157776,-0.882620,-0.108326,-0.047684|7,4,4,-0.469075,0.095816,-0.149153,-0.237868,-0.173850|7,5,5,-0.478645,0.267524,0.429428,-0.340483,-0.304178|7,6,6,-0.483194,-0.237102,-0.549126,-0.294433,-0.229024|7,7,7,-0.487416,-0.353743,-0.741839,-0.105226,-0.047451|7,8,8,-0.489491,-0.395130,-0.790259,0.259789,0.313354|7,9,9,0.399873,-0.578992,-1.157985,0.334847,0.362036|7,10,10,0.769342,-0.847556,-1.695112,0.244147,0.244147|8,A,A,-0.505189,0.093723,-0.305396,0.378075,0.378075|8,2,2,-0.512714,-0.151141,-1.025428,-0.216148,-0.177153|8,3,3,-0.510601,-0.223474,-1.000756,-0.268417,-0.227467|8,4,4,-0.519505,-0.057427,-0.449287,-0.367352,-0.324611|8,5,5,-0.519589,0.202720,0.305454,-0.494031,-0.468766|8,6,6,-0.522988,-0.295476,-0.661531,-0.441426,-0.397853|8,7,7,-0.525781,-0.389533,-0.810925,-0.426937,-0.387476|8,8,8,-0.531286,-0.442962,-0.885925,-0.074244,-0.041918|8,9,9,0.085625,-0.579074,-1.158148,0.201198,0.220677|8,10,10,0.787591,-0.847237,-1.694474,-0.012699,-0.012699|9,A,A,-0.527616,-0.001194,-0.439365,0.258121,0.258121|9,2,2,-0.533796,-0.231968,-1.067592,-0.400986,-0.378564|9,3,3,-0.542765,-0.300754,-1.066499,-0.441161,-0.420110|9,4,4,-0.542509,-0.208672,-0.709968,-0.524166,-0.501778|9,5,5,-0.541764,0.117382,0.159119,-0.661366,-0.645439|9,6,6,-0.545572,-0.362092,-0.775819,-0.606791,-0.583829|9,7,7,-0.549913,-0.452235,-0.926791,-0.582678,-0.563857|9,8,8,-0.530143,-0.498373,-0.996747,-0.416084,-0.394672|9,9,9,-0.189527,-0.605915,-1.211831,-0.099562,-0.088558|9,10,10,0.751376,-0.846569,-1.693139,-0.299869,-0.299869|10,A,A,-0.535536,-0.058695,-0.491614,0.186732,0.186732|10,2,2,-0.543856,-0.282600,-1.087711,-0.496786,-0.486989|10,3,3,-0.543248,-0.340616,-1.067197,-0.541403,-0.530374|10,4,4,-0.543260,-0.245136,-0.742386,-0.618008,-0.606232|10,5,5,-0.542443,0.031176,0.004965,-0.739234,-0.727487|10,6,6,-0.547053,-0.383777,-0.800867,-0.700672,-0.689245|10,7,7,-0.525583,-0.489910,-0.985179,-0.652361,-0.639840|10,8,8,-0.529565,-0.526181,-1.052362,-0.474649,-0.463745|10,9,9,-0.156304,-0.636400,-1.272801,-0.302837,-0.294618|10,10,10,0.568553,-0.843225,-1.686450,-0.415431,-0.415431`;
  const blackjackInitialEv2dS17 = new Map(blackjackInitialEv2dS17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv2dH17Data = `A,A,A,-0.595164,-0.067327,-0.574721,0.157378,0.157378|A,2,2,-0.593113,-0.293373,-1.186226,-0.521920,-0.515629|A,3,3,-0.591323,-0.351766,-1.171354,-0.563535,-0.555498|A,4,4,-0.589214,-0.264925,-0.820424,-0.636857,-0.626815|A,5,5,-0.590103,0.037716,-0.004346,-0.766384,-0.755707|A,6,6,-0.585447,-0.393801,-0.835230,-0.720170,-0.709339|A,7,7,-0.580226,-0.495371,-1.008716,-0.716802,-0.707039|A,8,8,-0.586903,-0.531321,-1.062642,-0.500197,-0.493576|A,9,9,-0.206613,-0.637736,-1.275473,-0.221117,-0.217618|A,10,10,0.597669,-0.868561,-1.737122,-0.488963,-0.488963|2,A,A,-0.278818,0.086622,-0.043149,0.516612,0.516612|2,2,2,-0.285287,-0.111793,-0.570575,-0.143714,-0.061513|2,3,3,-0.285685,-0.142296,-0.550893,-0.202243,-0.120005|2,4,4,-0.284922,-0.018168,-0.193777,-0.253927,-0.170617|2,5,5,-0.268503,0.201293,0.399936,-0.295065,-0.244387|2,6,6,-0.271468,-0.253276,-0.506553,-0.242041,-0.153417|2,7,7,-0.274633,-0.385000,-0.769999,-0.179531,-0.091811|2,8,8,-0.277763,-0.465195,-0.930391,0.014587,0.091351|2,9,9,0.117843,-0.626010,-1.252021,0.160733,0.199594|2,10,10,0.628556,-0.851193,-1.702385,0.082909,0.082909|3,A,A,-0.237885,0.110271,0.025730,0.564088,0.564088|3,2,2,-0.244572,-0.079331,-0.489143,-0.085097,0.012583|3,3,3,-0.243863,-0.108982,-0.468059,-0.130236,-0.034121|3,4,4,-0.227510,0.016921,-0.109341,-0.158026,-0.055950|3,5,5,-0.224679,0.228532,0.457065,-0.213975,-0.151641|3,6,6,-0.227464,-0.228411,-0.456822,-0.160758,-0.049705|3,7,7,-0.230965,-0.369242,-0.738485,-0.101445,0.005358|3,8,8,-0.235203,-0.458963,-0.917927,0.081654,0.167276|3,9,9,0.127459,-0.629565,-1.259130,0.191269,0.236908|3,10,10,0.639140,-0.850880,-1.701759,0.169623,0.169623|4,A,A,-0.190661,0.134467,0.099262,0.616184,0.616184|4,2,2,-0.196595,-0.039502,-0.393190,-0.018299,0.094093|4,3,3,-0.180285,-0.056736,-0.342912,-0.021859,0.096771|4,4,4,-0.177078,0.065674,-0.014834,-0.062806,0.059604|4,5,5,-0.174888,0.260577,0.521155,-0.119102,-0.040807|4,6,6,-0.177710,-0.202730,-0.405459,-0.068312,0.064861|4,7,7,-0.182685,-0.352793,-0.705586,-0.014349,0.119652|4,8,8,-0.207078,-0.460183,-0.920366,0.126867,0.222150|4,9,9,0.160990,-0.608440,-1.216879,0.262770,0.313418|4,10,10,0.648790,-0.850713,-1.701427,0.263966,0.263966|5,A,A,-0.146973,0.169339,0.171311,0.672616,0.672616|5,2,2,-0.136105,0.011809,-0.272209,0.087308,0.225069|5,3,3,-0.133446,-0.012701,-0.248466,0.069204,0.213821|5,4,4,-0.130739,0.109724,0.078108,0.026539,0.175650|5,5,5,-0.128554,0.299131,0.598262,-0.020232,0.079678|5,6,6,-0.133466,-0.178674,-0.357349,0.019290,0.179514|5,7,7,-0.158311,-0.345685,-0.691370,0.035307,0.186891|5,8,8,-0.163273,-0.451767,-0.903535,0.206143,0.312904|5,9,9,0.196771,-0.603663,-1.207326,0.341075,0.397409|5,10,10,0.670048,-0.850206,-1.700412,0.368984,0.368984|6,A,A,-0.103203,0.194397,0.227011,0.709899,0.709899|6,2,2,-0.104437,0.038384,-0.208874,0.142946,0.296358|6,3,3,-0.101836,0.020343,-0.186344,0.124775,0.283422|6,4,4,-0.099499,0.133111,0.128449,0.084099,0.244279|6,5,5,-0.099300,0.317115,0.634229,0.029924,0.138863|6,6,6,-0.124391,-0.181364,-0.362729,0.034584,0.198094|6,7,7,-0.129361,-0.339575,-0.679151,0.083771,0.248792|6,8,8,-0.132803,-0.426598,-0.853196,0.249727,0.365032|6,9,9,0.213138,-0.603261,-1.206521,0.376538,0.435645|6,10,10,0.673275,-0.850096,-1.700192,0.427790,0.427790|7,A,A,-0.464261,0.162012,-0.161064,0.501347,0.501347|7,2,2,-0.473143,-0.089960,-0.946285,-0.048945,0.011632|7,3,3,-0.471189,-0.157776,-0.882620,-0.108326,-0.047684|7,4,4,-0.469075,0.095816,-0.149153,-0.237868,-0.173850|7,5,5,-0.478645,0.267524,0.429428,-0.340483,-0.304178|7,6,6,-0.483194,-0.237102,-0.549126,-0.294433,-0.229024|7,7,7,-0.487416,-0.353743,-0.741839,-0.105226,-0.047451|7,8,8,-0.489491,-0.395130,-0.790259,0.259789,0.313354|7,9,9,0.399873,-0.578992,-1.157985,0.334847,0.362036|7,10,10,0.769342,-0.847556,-1.695112,0.244147,0.244147|8,A,A,-0.505189,0.093723,-0.305396,0.378075,0.378075|8,2,2,-0.512714,-0.151141,-1.025428,-0.216148,-0.177153|8,3,3,-0.510601,-0.223474,-1.000756,-0.268417,-0.227467|8,4,4,-0.519505,-0.057427,-0.449287,-0.367352,-0.324611|8,5,5,-0.519589,0.202720,0.305454,-0.494031,-0.468766|8,6,6,-0.522988,-0.295476,-0.661531,-0.441426,-0.397853|8,7,7,-0.525781,-0.389533,-0.810925,-0.426937,-0.387476|8,8,8,-0.531286,-0.442962,-0.885925,-0.074244,-0.041918|8,9,9,0.085625,-0.579074,-1.158148,0.201198,0.220677|8,10,10,0.787591,-0.847237,-1.694474,-0.012699,-0.012699|9,A,A,-0.527616,-0.001194,-0.439365,0.258121,0.258121|9,2,2,-0.533796,-0.231968,-1.067592,-0.400986,-0.378564|9,3,3,-0.542765,-0.300754,-1.066499,-0.441161,-0.420110|9,4,4,-0.542509,-0.208672,-0.709968,-0.524166,-0.501778|9,5,5,-0.541764,0.117382,0.159119,-0.661366,-0.645439|9,6,6,-0.545572,-0.362092,-0.775819,-0.606791,-0.583829|9,7,7,-0.549913,-0.452235,-0.926791,-0.582678,-0.563857|9,8,8,-0.530143,-0.498373,-0.996747,-0.416084,-0.394672|9,9,9,-0.189527,-0.605915,-1.211831,-0.099562,-0.088558|9,10,10,0.751376,-0.846569,-1.693139,-0.299869,-0.299869|10,A,A,-0.535536,-0.058695,-0.491614,0.186732,0.186732|10,2,2,-0.543856,-0.282600,-1.087711,-0.496786,-0.486989|10,3,3,-0.543248,-0.340616,-1.067197,-0.541403,-0.530374|10,4,4,-0.543260,-0.245136,-0.742386,-0.618008,-0.606232|10,5,5,-0.542443,0.031176,0.004965,-0.739234,-0.727487|10,6,6,-0.547053,-0.383777,-0.800867,-0.700672,-0.689245|10,7,7,-0.525583,-0.489910,-0.985179,-0.652361,-0.639840|10,8,8,-0.529565,-0.526181,-1.052362,-0.474649,-0.463745|10,9,9,-0.156304,-0.636400,-1.272801,-0.302837,-0.294618|10,10,10,0.568553,-0.843225,-1.686450,-0.415431,-0.415431`;
  const blackjackInitialEv2dH17 = new Map(blackjackInitialEv2dH17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv1dS17Data = `A,A,A,-0.663142,-0.030635,-0.598755,0.223931,0.223931|A,2,2,-0.660049,-0.258901,-1.320098,-0.441608,-0.434211|A,3,3,-0.660147,-0.333963,-1.298180,-0.480539,-0.470279|A,4,4,-0.655759,-0.208972,-0.796495,-0.576512,-0.562934|A,5,5,-0.653287,0.090561,0.055149,-0.714734,-0.697709|A,6,6,-0.617010,-0.386204,-0.834602,-0.657391,-0.638018|A,7,7,-0.630502,-0.494721,-1.029343,-0.610436,-0.597411|A,8,8,-0.643532,-0.494905,-0.989811,-0.323759,-0.316498|A,9,9,-0.055174,-0.624843,-1.249686,-0.070608,-0.069038|A,10,10,0.650097,-0.883183,-1.766366,-0.408696,-0.408696|2,A,A,-0.274327,0.094777,-0.019360,0.565704,0.565704|2,2,2,-0.290803,-0.113174,-0.581605,-0.128956,-0.035789|2,3,3,-0.294866,-0.152948,-0.567470,-0.200303,-0.107639|2,4,4,-0.290133,-0.012616,-0.184577,-0.255913,-0.161808|2,5,5,-0.255915,0.223862,0.446442,-0.267488,-0.206910|2,6,6,-0.261714,-0.252671,-0.505342,-0.211108,-0.104559|2,7,7,-0.268309,-0.406388,-0.812776,-0.148796,-0.047919|2,8,8,-0.274814,-0.454093,-0.908186,0.044815,0.123747|2,9,9,0.137057,-0.627497,-1.254994,0.175980,0.211065|2,10,10,0.627226,-0.846661,-1.693322,0.062075,0.062075|3,A,A,-0.232311,0.120586,0.054882,0.612856,0.612856|3,2,2,-0.250722,-0.081767,-0.501443,-0.068689,0.039858|3,3,3,-0.246186,-0.118136,-0.472052,-0.127153,-0.022805|3,4,4,-0.213730,0.028836,-0.082465,-0.131818,-0.015657|3,5,5,-0.206172,0.254782,0.509564,-0.176326,-0.102942|3,6,6,-0.211033,-0.222134,-0.444267,-0.120497,0.008941|3,7,7,-0.219400,-0.388265,-0.776530,-0.062670,0.056070|3,8,8,-0.228354,-0.449931,-0.899863,0.111595,0.198718|3,9,9,0.122553,-0.638281,-1.276562,0.174122,0.218237|3,10,10,0.636134,-0.846301,-1.692602,0.152111,0.152111|4,A,A,-0.178249,0.145730,0.136650,0.668582,0.668582|4,2,2,-0.191999,-0.034842,-0.383998,0.006268,0.131291|4,3,3,-0.159691,-0.047439,-0.302167,0.016377,0.154244|4,4,4,-0.151694,0.097855,0.044128,-0.017034,0.125183|4,5,5,-0.146291,0.294911,0.589822,-0.064209,0.026796|4,6,6,-0.151883,-0.190113,-0.380227,-0.012894,0.140454|4,7,7,-0.163937,-0.368803,-0.737605,0.034983,0.187843|4,8,8,-0.215266,-0.461146,-0.922291,0.132831,0.230561|4,9,9,0.166978,-0.597001,-1.194002,0.258432,0.308760|4,10,10,0.644848,-0.846273,-1.692545,0.257708,0.257708|5,A,A,-0.130086,0.182014,0.215727,0.732160,0.732160|5,2,2,-0.107014,0.035944,-0.214028,0.137126,0.300407|5,3,3,-0.101455,0.008318,-0.183982,0.128780,0.304545|5,4,4,-0.094897,0.153926,0.162314,0.091925,0.266161|5,5,5,-0.090048,0.347346,0.694691,0.057835,0.185562|5,6,6,-0.102166,-0.162360,-0.324720,0.086307,0.277969|5,7,7,-0.155509,-0.370327,-0.740653,0.055550,0.223685|5,8,8,-0.165443,-0.452874,-0.905749,0.217988,0.329648|5,9,9,0.202893,-0.590310,-1.180620,0.349438,0.406878|5,10,10,0.673675,-0.845597,-1.691194,0.373953,0.373953|6,A,A,-0.103505,0.199607,0.247914,0.758276,0.758276|6,2,2,-0.124502,0.032055,-0.249003,0.135806,0.306525|6,3,3,-0.118893,0.013896,-0.214511,0.123137,0.302028|6,4,4,-0.114034,0.175290,0.193184,0.077621,0.250343|6,5,5,-0.111669,0.361823,0.723645,0.031578,0.155292|6,6,6,-0.165187,-0.193568,-0.387137,-0.003913,0.169401|6,7,7,-0.174225,-0.366941,-0.733882,0.072477,0.243170|6,8,8,-0.178171,-0.396692,-0.793384,0.269350,0.385156|6,9,9,0.265195,-0.586713,-1.173426,0.365645,0.423942|6,10,10,0.697403,-0.845027,-1.690053,0.392186,0.392186|7,A,A,-0.452479,0.158489,-0.136975,0.540712,0.540712|7,2,2,-0.471027,-0.091472,-0.942054,-0.050453,0.016482|7,3,3,-0.467213,-0.164040,-0.871217,-0.107550,-0.041923|7,4,4,-0.462717,0.111349,-0.108353,-0.252865,-0.178019|7,5,5,-0.484469,0.279059,0.466340,-0.352877,-0.310701|7,6,6,-0.493437,-0.264854,-0.598513,-0.267925,-0.192858|7,7,7,-0.501956,-0.389227,-0.823012,-0.110429,-0.051412|7,8,8,-0.502514,-0.373561,-0.747122,0.251647,0.303621|7,9,9,0.401060,-0.566049,-1.132097,0.335235,0.358752|7,10,10,0.764677,-0.843026,-1.686052,0.217946,0.217946|8,A,A,-0.499700,0.093060,-0.295648,0.406468,0.406468|8,2,2,-0.514917,-0.140878,-1.029833,-0.218289,-0.178911|8,3,3,-0.510419,-0.230703,-0.999660,-0.264924,-0.221195|8,4,4,-0.529261,-0.054359,-0.447062,-0.369395,-0.322222|8,5,5,-0.530853,0.207838,0.322885,-0.509576,-0.481765|8,6,6,-0.535771,-0.321707,-0.711353,-0.418848,-0.369478|8,7,7,-0.539340,-0.407893,-0.857865,-0.422623,-0.380884|8,8,8,-0.551276,-0.426315,-0.852630,-0.087081,-0.059689|8,9,9,0.064518,-0.566265,-1.132529,0.190184,0.207350|8,10,10,0.783251,-0.842727,-1.685455,-0.048882,-0.048882|9,A,A,-0.510996,-0.002488,-0.420608,0.289770,0.289770|9,2,2,-0.523455,-0.221986,-1.046910,-0.395441,-0.368892|9,3,3,-0.542453,-0.309366,-1.065288,-0.424234,-0.400308|9,4,4,-0.542638,-0.204341,-0.701087,-0.514284,-0.488027|9,5,5,-0.540668,0.120345,0.174553,-0.667997,-0.649823|9,6,6,-0.548502,-0.386242,-0.817364,-0.584405,-0.556836|9,7,7,-0.555391,-0.474654,-0.978238,-0.569340,-0.548789|9,8,8,-0.516426,-0.487124,-0.974248,-0.427146,-0.401442|9,9,9,-0.196372,-0.594732,-1.189465,-0.108930,-0.099162|9,10,10,0.743970,-0.842055,-1.684111,-0.338563,-0.338563|10,A,A,-0.530674,-0.046842,-0.468319,0.194251,0.194251|10,2,2,-0.547137,-0.275101,-1.094274,-0.474492,-0.465966|10,3,3,-0.545672,-0.343585,-1.071267,-0.516190,-0.505094|10,4,4,-0.547191,-0.241025,-0.738996,-0.598618,-0.586290|10,5,5,-0.545139,0.038319,0.018006,-0.734630,-0.722816|10,6,6,-0.552167,-0.386149,-0.803852,-0.669574,-0.658131|10,7,7,-0.509739,-0.514818,-1.034724,-0.633557,-0.619017|10,8,8,-0.518291,-0.511755,-1.023510,-0.457453,-0.446436|10,9,9,-0.133285,-0.624465,-1.248929,-0.277030,-0.271554|10,10,10,0.583154,-0.836969,-1.673938,-0.405482,-0.405482`;
  const blackjackInitialEv1dS17 = new Map(blackjackInitialEv1dS17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEv1dH17Data = `A,A,A,-0.591119,-0.071244,-0.558494,0.215092,0.215092|A,2,2,-0.586848,-0.293348,-1.173695,-0.517798,-0.505026|A,3,3,-0.584067,-0.362147,-1.158259,-0.551501,-0.535428|A,4,4,-0.580201,-0.265337,-0.808571,-0.627424,-0.607152|A,5,5,-0.582567,0.045762,0.026604,-0.775751,-0.755857|A,6,6,-0.570140,-0.403721,-0.832166,-0.700421,-0.677277|A,7,7,-0.560383,-0.523378,-1.059340,-0.692580,-0.672616|A,8,8,-0.574417,-0.520115,-1.040230,-0.476453,-0.462833|A,9,9,-0.186131,-0.637010,-1.274020,-0.190106,-0.182862|A,10,10,0.593596,-0.884336,-1.768673,-0.542739,-0.542739|2,A,A,-0.270691,0.093909,-0.017397,0.565372,0.565372|2,2,2,-0.283340,-0.110110,-0.566680,-0.128652,-0.035602|2,3,3,-0.287310,-0.148694,-0.553531,-0.200233,-0.107470|2,4,4,-0.285624,-0.013517,-0.184721,-0.251452,-0.157174|2,5,5,-0.248567,0.222272,0.444230,-0.258171,-0.197627|2,6,6,-0.254573,-0.252577,-0.505153,-0.202762,-0.096350|2,7,7,-0.261350,-0.407605,-0.815210,-0.147939,-0.046433|2,8,8,-0.267966,-0.456002,-0.912005,0.039058,0.117909|2,9,9,0.125626,-0.628481,-1.256962,0.172908,0.208002|2,10,10,0.621940,-0.846767,-1.693533,0.059708,0.059708|3,A,A,-0.229679,0.120023,0.056302,0.612564,0.612564|3,2,2,-0.245297,-0.079280,-0.490594,-0.068246,0.040194|3,3,3,-0.243798,-0.116637,-0.467619,-0.125245,-0.020926|3,4,4,-0.207855,0.027952,-0.082649,-0.124069,-0.007870|3,5,5,-0.200756,0.253973,0.507946,-0.169224,-0.095914|3,6,6,-0.205760,-0.222063,-0.444125,-0.114221,0.015061|3,7,7,-0.214283,-0.389122,-0.778245,-0.062013,0.057220|3,8,8,-0.223307,-0.451354,-0.902708,0.107602,0.194633|3,9,9,0.114107,-0.639033,-1.278067,0.172452,0.216588|3,10,10,0.632230,-0.846392,-1.692785,0.151789,0.151789|4,A,A,-0.174886,0.145021,0.138475,0.668294,0.668294|4,2,2,-0.188494,-0.032969,-0.376988,0.006792,0.131818|4,3,3,-0.152722,-0.042778,-0.289322,0.023632,0.161803|4,4,4,-0.144654,0.096628,0.043836,-0.008235,0.134439|4,5,5,-0.139802,0.293960,0.587920,-0.055824,0.035488|4,6,6,-0.145580,-0.190010,-0.380020,-0.005436,0.147712|4,7,7,-0.157794,-0.369828,-0.739655,0.035714,0.189098|4,8,8,-0.209220,-0.462849,-0.925698,0.127721,0.225384|4,9,9,0.156842,-0.597885,-1.195770,0.256727,0.307023|4,10,10,0.640239,-0.846366,-1.692732,0.257780,0.257780|5,A,A,-0.129684,0.182058,0.215933,0.732081,0.732081|5,2,2,-0.104579,0.037203,-0.209157,0.139343,0.302553|5,3,3,-0.098994,0.009903,-0.179332,0.131292,0.307086|5,4,4,-0.092410,0.153362,0.162098,0.095125,0.269416|5,5,5,-0.087779,0.346903,0.693805,0.060463,0.188222|5,6,6,-0.099958,-0.162349,-0.324698,0.088749,0.280268|5,7,7,-0.153359,-0.370802,-0.741605,0.055586,0.223759|5,8,8,-0.163322,-0.453646,-0.907293,0.215869,0.327454|5,9,9,0.198919,-0.590647,-1.181293,0.348528,0.405927|5,10,10,0.671820,-0.845624,-1.691247,0.374431,0.374431|6,A,A,-0.084955,0.201887,0.258415,0.755927,0.755927|6,2,2,-0.087026,0.050745,-0.174053,0.168896,0.338659|6,3,3,-0.081029,0.036723,-0.145223,0.160372,0.340139|6,4,4,-0.075873,0.164731,0.185687,0.125243,0.299513|6,5,5,-0.076807,0.354212,0.708425,0.072472,0.196607|6,6,6,-0.131294,-0.192225,-0.384450,0.030246,0.200737|6,7,7,-0.141234,-0.374367,-0.748733,0.067908,0.240203|6,8,8,-0.145647,-0.409377,-0.818754,0.232605,0.350700|6,9,9,0.201291,-0.592827,-1.185654,0.350254,0.408199|6,10,10,0.668303,-0.845644,-1.691287,0.396449,0.396449|7,A,A,-0.452479,0.158489,-0.136975,0.540712,0.540712|7,2,2,-0.471027,-0.091472,-0.942054,-0.050453,0.016482|7,3,3,-0.467213,-0.164040,-0.871217,-0.107550,-0.041923|7,4,4,-0.462717,0.111349,-0.108353,-0.252865,-0.178019|7,5,5,-0.484469,0.279059,0.466340,-0.352877,-0.310701|7,6,6,-0.493437,-0.264854,-0.598513,-0.267925,-0.192858|7,7,7,-0.501956,-0.389227,-0.823012,-0.110429,-0.051412|7,8,8,-0.502514,-0.373561,-0.747122,0.251647,0.303621|7,9,9,0.401060,-0.566049,-1.132097,0.335235,0.358752|7,10,10,0.764677,-0.843026,-1.686052,0.217946,0.217946|8,A,A,-0.499700,0.093060,-0.295648,0.406468,0.406468|8,2,2,-0.514917,-0.140878,-1.029833,-0.218289,-0.178911|8,3,3,-0.510419,-0.230703,-0.999660,-0.264924,-0.221195|8,4,4,-0.529261,-0.054359,-0.447062,-0.369395,-0.322222|8,5,5,-0.530853,0.207838,0.322885,-0.509576,-0.481765|8,6,6,-0.535771,-0.321707,-0.711353,-0.418848,-0.369478|8,7,7,-0.539340,-0.407893,-0.857865,-0.422623,-0.380884|8,8,8,-0.551276,-0.426315,-0.852630,-0.087081,-0.059689|8,9,9,0.064518,-0.566265,-1.132529,0.190184,0.207350|8,10,10,0.783251,-0.842727,-1.685455,-0.048882,-0.048882|9,A,A,-0.510996,-0.002488,-0.420608,0.289770,0.289770|9,2,2,-0.523455,-0.221986,-1.046910,-0.395441,-0.368892|9,3,3,-0.542453,-0.309366,-1.065288,-0.424234,-0.400308|9,4,4,-0.542638,-0.204341,-0.701087,-0.514284,-0.488027|9,5,5,-0.540668,0.120345,0.174553,-0.667997,-0.649823|9,6,6,-0.548502,-0.386242,-0.817364,-0.584405,-0.556836|9,7,7,-0.555391,-0.474654,-0.978238,-0.569340,-0.548789|9,8,8,-0.516426,-0.487124,-0.974248,-0.427146,-0.401442|9,9,9,-0.196372,-0.594732,-1.189465,-0.108930,-0.099162|9,10,10,0.743970,-0.842055,-1.684111,-0.338563,-0.338563|10,A,A,-0.530674,-0.046842,-0.468319,0.194251,0.194251|10,2,2,-0.547137,-0.275101,-1.094274,-0.474492,-0.465966|10,3,3,-0.545672,-0.343585,-1.071267,-0.516190,-0.505094|10,4,4,-0.547191,-0.241025,-0.738996,-0.598618,-0.586290|10,5,5,-0.545139,0.038319,0.018006,-0.734630,-0.722816|10,6,6,-0.552167,-0.386149,-0.803852,-0.669574,-0.658131|10,7,7,-0.509739,-0.514818,-1.034724,-0.633557,-0.619017|10,8,8,-0.518291,-0.511755,-1.023510,-0.457453,-0.446436|10,9,9,-0.133285,-0.624465,-1.248929,-0.277030,-0.271554|10,10,10,0.583154,-0.836969,-1.673938,-0.405482,-0.405482`;
  const blackjackInitialEv1dH17 = new Map(blackjackInitialEv1dH17Data.split('|').map(row=>{
    const [dealer,first,second,stand,hit,double,splitNoDas,splitDas] = row.split(',');
    return [`${dealer}|${first},${second}`, {
      stand:Number(stand), hit:Number(hit), double:Number(double),
      probability:null, splitNoDas:Number(splitNoDas), splitDas:Number(splitDas)
    }];
  }));
  const blackjackInitialEvTables = {
    '1,hit':blackjackInitialEv1dH17,
    '1,stand':blackjackInitialEv1dS17,
    '2,hit':blackjackInitialEv2dH17,
    '2,stand':blackjackInitialEv2dS17,
    '4,hit':blackjackInitialEv4dH17,
    '4,stand':blackjackInitialEv4dS17,
    '6,hit':blackjackInitialEv6dH17,
    '6,stand':blackjackInitialEv6dS17,
    '8,hit':blackjackInitialEv8dH17,
    '8,stand':blackjackInitialEv8dS17
  };
  function blackjackInitialEvSupported(rules={}){
    return !!blackjackInitialEvTables[`${Number(rules.decks)},${rules.soft17}`]
      && (rules.blackjackPayout || '3:2') === '3:2';
  }
  function blackjackInitialDecisionEv(hand,dealerUpCard,rules={}){
    if(!blackjackInitialEvSupported(rules) || !hand || hand.split || hand.cards?.length !== 2) return null;
    const rankLabel = card=>{
      const value = blackjackDealerUpValue(card);
      return value === 11 ? 'A' : String(value);
    };
    const order = label=>label === 'A' ? 1 : Number(label);
    const player = hand.cards.map(rankLabel).sort((a,b)=>order(b)-order(a)).join(',');
    const dealer = rankLabel(dealerUpCard);
    const table = blackjackInitialEvTables[`${Number(rules.decks)},${rules.soft17}`];
    const row = table.get(`${dealer}|${player}`);
    if(!row) return null;
    const result = {stand:row.stand,hit:row.hit,double:row.double};
    if(row.splitDas !== undefined) result.split = rules.das === false ? row.splitNoDas : row.splitDas;
    if(rules.surrender === true) result.surrender = -0.5;
    return result;
  }

  // Exact composition-dependent action EVs. The counts retain the unknown
  // dealer hole card; player draws update that belief state, so future choices
  // never gain knowledge of the hole card while still respecting its removal.
  function blackjackActionEvs({hand,dealerUpCard,visibleCards=[],rules={},handCount=1,peeked=true}={}){
    if(!hand || hand.status !== 'active' || dealerUpCard === undefined || dealerUpCard === null) return null;
    const decks = [1,2,4,6,8].includes(Number(rules.decks)) ? Number(rules.decks) : 4;
    const up = blackjackDealerUpValue(dealerUpCard);
    const counts = Array(12).fill(0);
    for(let value=2; value<=9; value++) counts[value] = decks * 4;
    counts[10] = decks * 16;
    counts[11] = decks * 4;
    (visibleCards || []).forEach(card=>{
      const value = blackjackDealerUpValue(card);
      if(value >= 2 && value <= 11 && counts[value] > 0) counts[value]--;
    });
    const rootCards = (hand.cards || []).map(blackjackDealerUpValue);
    if(!rootCards.length) return null;
    const dealerMemo = new Map();
    const dealerBeliefMemo = new Map();
    const roundMemo = new Map();
    const allowedHole = value=>!(peeked && ((up === 11 && value === 10) || (up === 10 && value === 11)));
    function valueTotal(cards){
      let total = 0, softAces = 0;
      cards.forEach(value=>{ total += value; if(value === 11) softAces++; });
      while(total > 21 && softAces > 0){ total -= 10; softAces--; }
      return {total,softAces};
    }
    function addValue(total,softAces,value){
      total += value;
      if(value === 11) softAces++;
      while(total > 21 && softAces > 0){ total -= 10; softAces--; }
      return [total,softAces];
    }
    function dealerFinish(total,softAces,remaining){
      if(total > 21) return [1,0,0,0,0,0];
      const hit = total < 17 || (total === 17 && softAces > 0 && rules.soft17 === 'hit');
      if(!hit){
        const result = [0,0,0,0,0,0];
        result[total - 16] = 1;
        return result;
      }
      const key = `${total}/${softAces}/${remaining.slice(2).join(',')}`;
      if(dealerMemo.has(key)) return dealerMemo.get(key);
      const denominator = remaining.slice(2).reduce((sum,n)=>sum+n,0);
      const result = [0,0,0,0,0,0];
      if(!denominator) return result;
      for(let value=2; value<=11; value++){
        const count = remaining[value];
        if(!count) continue;
        remaining[value]--;
        const [nextTotal,nextSoft] = addValue(total,softAces,value);
        const branch = dealerFinish(nextTotal,nextSoft,remaining);
        remaining[value]++;
        const weight = count / denominator;
        for(let i=0; i<6; i++) result[i] += branch[i] * weight;
      }
      dealerMemo.set(key,result);
      return result;
    }
    function dealerFromBelief(remaining){
      const key = remaining.slice(2).join(',');
      if(dealerBeliefMemo.has(key)) return dealerBeliefMemo.get(key);
      let holeDenominator = 0;
      for(let value=2; value<=11; value++) if(allowedHole(value)) holeDenominator += remaining[value];
      const combined = [0,0,0,0,0,0];
      if(!holeDenominator) return combined;
      const [upTotal,upSoft] = addValue(0,0,up);
      for(let value=2; value<=11; value++){
        const count = remaining[value];
        if(!count || !allowedHole(value)) continue;
        remaining[value]--;
        const [total,softAces] = addValue(upTotal,upSoft,value);
        const branch = dealerFinish(total,softAces,remaining);
        remaining[value]++;
        const weight = count / holeDenominator;
        for(let i=0; i<6; i++) combined[i] += branch[i] * weight;
      }
      dealerBeliefMemo.set(key,combined);
      return combined;
    }
    function drawBranches(remaining,callback){
      const totalUnknown = remaining.slice(2).reduce((sum,n)=>sum+n,0);
      let allowedTotal = 0;
      for(let value=2; value<=11; value++) if(allowedHole(value)) allowedTotal += remaining[value];
      if(totalUnknown <= 1 || !allowedTotal) return -Infinity;
      let ev = 0, probabilityTotal = 0;
      for(let value=2; value<=11; value++){
        const count = remaining[value];
        if(!count) continue;
        const probability = count * (allowedTotal - (allowedHole(value) ? 1 : 0)) / (allowedTotal * (totalUnknown - 1));
        if(probability <= 0) continue;
        remaining[value]--;
        ev += probability * callback(value,remaining);
        remaining[value]++;
        probabilityTotal += probability;
      }
      return probabilityTotal ? ev / probabilityTotal : -Infinity;
    }
    function copyHands(hands){
      return hands.map(item=>({...item,cards:item.cards.slice()}));
    }
    function terminalEv(hands,remaining){
      const dealer = dealerFromBelief(remaining);
      let ev = 0;
      for(const item of hands){
        const wager = item.wager || 1;
        const playerTotal = valueTotal(item.cards).total;
        if(item.status === 'bust' || playerTotal > 21){ ev -= wager; continue; }
        ev += dealer[0] * wager;
        for(let total=17; total<=21; total++){
          const payoff = playerTotal > total ? wager : playerTotal < total ? -wager : 0;
          ev += dealer[total - 16] * payoff;
        }
      }
      return ev;
    }
    function handKey(item){
      const total = valueTotal(item.cards);
      const pair = item.cards.length === 2 && item.cards[0] === item.cards[1] ? item.cards[0] : 0;
      return `${total.total}.${total.softAces}:${item.cards.length}:${pair}:${item.status}:${item.wager}:${item.split?1:0}:${item.splitAces?1:0}`;
    }
    function availableActions(item){
      const actions = ['stand','hit'];
      if(item.cards.length === 2 && !item.splitAces && (!item.split || rules.das !== false)) actions.push('double');
      return actions;
    }
    function actionEv(hands,index,action,remaining,externalHands){
      if(action === 'stand'){
        const next = copyHands(hands);
        next[index].status = 'stand';
        return roundEv(next,remaining,externalHands);
      }
      if(action === 'hit'){
        return drawBranches(remaining,(value,afterDraw)=>{
          const next = copyHands(hands);
          next[index].cards.push(value);
          if(valueTotal(next[index].cards).total > 21) next[index].status = 'bust';
          return roundEv(next,afterDraw,externalHands);
        });
      }
      if(action === 'double'){
        return drawBranches(remaining,(value,afterDraw)=>{
          const next = copyHands(hands);
          next[index].cards.push(value);
          next[index].wager *= 2;
          next[index].status = valueTotal(next[index].cards).total > 21 ? 'bust' : 'stand';
          return roundEv(next,afterDraw,externalHands);
        });
      }
      return -Infinity;
    }
    function roundEv(hands,remaining,externalHands){
      const index = hands.findIndex(item=>item.status === 'active');
      if(index < 0) return terminalEv(hands,remaining);
      const key = `${externalHands}|${hands.map(handKey).join('|')}|${remaining.slice(2).join(',')}`;
      if(roundMemo.has(key)) return roundMemo.get(key);
      let best = -Infinity;
      availableActions(hands[index]).forEach(action=>{
        best = Math.max(best,actionEv(hands,index,action,remaining,externalHands));
      });
      roundMemo.set(key,best);
      return best;
    }
    const root = [{
      cards:rootCards,status:'active',wager:1,split:!!hand.split,splitAces:!!hand.splitAces
    }];
    const externalHands = Math.max(0,Number(handCount || 1) - 1);
    const actions = availableActions(root[0]);
    const result = {};
    actions.forEach(action=>{ result[action] = actionEv(root,0,action,counts,externalHands); });
    // Exact split/resplit recursion is intentionally not used in live play: it
    // is much too expensive for a mobile UI. Use the supplied validated table
    // for an original pair when its exact six-deck H17 ruleset is selected.
    const tableEv = blackjackInitialDecisionEv(hand,dealerUpCard,rules);
    if(!hand.split && rootCards.length === 2 && rootCards[0] === rootCards[1] && tableEv?.split !== undefined) result.split = tableEv.split;
    if(rules.surrender === true && rootCards.length === 2 && !hand.split && !hand.doubled) result.surrender = -0.5;
    return result;
  }

  // Wizard of Odds total-dependent basic-strategy tables. The suffix is the
  // deck group: 0 = one deck, 1 = two decks, 2 = four to eight decks.
  const blackjackStrategyData = {
    H17_0:'H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|DH,DH,DH,DH,DH,DH,DH,DH,DH,DH|H,H,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,RH|S,S,S,S,S,H,H,H,RH,RH|S,S,S,S,S,S,S,S,S,RS|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,H,H,H,H,H|S,DS,DS,DS,DS,S,S,H,H,H|S,S,S,S,DS,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|QH,P,P,P,P,P,H,H,H,H|QH,QH,P,P,P,P,QH,H,H,H|H,H,QH,QD,QD,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|P,P,P,P,P,QH,H,H,H,H|P,P,P,P,P,P,QH,H,RS,RH|P,P,P,P,P,P,P,P,P,P|P,P,P,P,P,S,P,P,S,QS|S,S,S,S,S,S,S,S,S,S|P,P,P,P,P,P,P,P,P,P',
    S17_0:'H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|DH,DH,DH,DH,DH,DH,DH,DH,DH,DH|H,H,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,RH,RH|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,H,H,H,H,H|S,DS,DS,DS,DS,S,S,H,H,S|S,S,S,S,DS,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|QH,P,P,P,P,P,H,H,H,H|QH,QH,P,P,P,P,QH,H,H,H|H,H,QH,QD,QD,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|P,P,P,P,P,QH,H,H,H,H|P,P,P,P,P,P,QH,H,RS,H|P,P,P,P,P,P,P,P,P,P|P,P,P,P,P,S,P,P,S,S|S,S,S,S,S,S,S,S,S,S|P,P,P,P,P,P,P,P,P,P',
    H17_1:'H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|DH,DH,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|DH,DH,DH,DH,DH,DH,DH,DH,DH,DH|H,H,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,RH,RH|S,S,S,S,S,H,H,H,RH,RH|S,S,S,S,S,S,S,S,S,RS|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|H,H,H,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,DH,DH,DH,DH,H,H,H,H,H|DS,DS,DS,DS,DS,S,S,H,H,H|S,S,S,S,DS,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|QH,QH,P,P,P,P,H,H,H,H|QH,QH,P,P,P,P,H,H,H,H|H,H,H,QH,QH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|P,P,P,P,P,QH,H,H,H,H|P,P,P,P,P,P,QH,H,H,H|P,P,P,P,P,P,P,P,P,RP|P,P,P,P,P,S,P,P,S,S|S,S,S,S,S,S,S,S,S,S|P,P,P,P,P,P,P,P,P,P',
    S17_1:'H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|DH,DH,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|DH,DH,DH,DH,DH,DH,DH,DH,DH,DH|H,H,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,RH,H|S,S,S,S,S,H,H,H,RH,RH|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|H,H,H,DH,DH,H,H,H,H,H|H,H,H,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,DH,DH,DH,DH,H,H,H,H,H|S,DS,DS,DS,DS,S,S,H,H,H|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|QH,QH,P,P,P,P,H,H,H,H|QH,QH,P,P,P,P,H,H,H,H|H,H,H,QH,QH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|P,P,P,P,P,QH,H,H,H,H|P,P,P,P,P,P,QH,H,H,H|P,P,P,P,P,P,P,P,P,P|P,P,P,P,P,S,P,P,S,S|S,S,S,S,S,S,S,S,S,S|P,P,P,P,P,P,P,P,P,P',
    H17_2:'H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,DH,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|DH,DH,DH,DH,DH,DH,DH,DH,DH,DH|H,H,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,RH,RH|S,S,S,S,S,H,H,RH,RH,RH|S,S,S,S,S,S,S,S,S,RS|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|H,H,H,DH,DH,H,H,H,H,H|H,H,H,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,DH,DH,DH,DH,H,H,H,H,H|DS,DS,DS,DS,DS,S,S,H,H,H|S,S,S,S,DS,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|QH,QH,P,P,P,P,H,H,H,H|QH,QH,P,P,P,P,H,H,H,H|H,H,H,QH,QH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|QH,P,P,P,P,H,H,H,H,H|P,P,P,P,P,P,H,H,H,H|P,P,P,P,P,P,P,P,P,RP|P,P,P,P,P,S,P,P,S,S|S,S,S,S,S,S,S,S,S,S|P,P,P,P,P,P,P,P,P,P',
    S17_2:'H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,H,H,H,H,H,H,H,H,H|H,DH,DH,DH,DH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|DH,DH,DH,DH,DH,DH,DH,DH,DH,H|H,H,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,H,H|S,S,S,S,S,H,H,H,RH,H|S,S,S,S,S,H,H,RH,RH,RH|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|H,H,H,DH,DH,H,H,H,H,H|H,H,H,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,H,DH,DH,DH,H,H,H,H,H|H,DH,DH,DH,DH,H,H,H,H,H|S,DS,DS,DS,DS,S,S,H,H,H|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|S,S,S,S,S,S,S,S,S,S|QH,QH,P,P,P,P,H,H,H,H|QH,QH,P,P,P,P,H,H,H,H|H,H,H,QH,QH,H,H,H,H,H|DH,DH,DH,DH,DH,DH,DH,DH,H,H|QH,P,P,P,P,H,H,H,H,H|P,P,P,P,P,P,H,H,H,H|P,P,P,P,P,P,P,P,P,P|P,P,P,P,P,S,P,P,S,S|S,S,S,S,S,S,S,S,S,S|P,P,P,P,P,P,P,P,P,P'
  };
  const blackjackStrategyTables = Object.fromEntries(Object.entries(blackjackStrategyData).map(([key,value])=>[
    key,
    value.split('|').map(row=>row.split(','))
  ]));

  // Exact Wizard calculator rows for this game's fixed rules: double on any
  // first two cards, split to four hands, no resplitting/hitting split aces,
  // and American peek (only the original bet is exposed to dealer blackjack).
  const blackjackOptimalEdges = {
    '1,0,0':[-0.041620,-0.063668], '1,0,1':[-0.182895,-0.204943],
    '1,1,0':[0.151762,0.113752], '1,1,1':[0.007747,-0.030263],
    '2,0,0':[0.321003,0.269849], '2,0,1':[0.178315,0.127162],
    '2,1,0':[0.525253,0.459061], '2,1,1':[0.379879,0.313717],
    '4,0,0':[0.489600,0.422835], '4,0,1':[0.347486,0.280721],
    '4,1,0':[0.702116,0.619913], '4,1,1':[0.557183,0.475079],
    '6,0,0':[0.544889,0.472286], '6,0,1':[0.403115,0.330512],
    '6,1,0':[0.760168,0.671883], '6,1,1':[0.615626,0.527409],
    '8,0,0':[0.572499,0.496681], '8,0,1':[0.430961,0.355143],
    '8,1,0':[0.789206,0.697582], '8,1,1':[0.644928,0.553356]
  };
  const blackjackCutCardAdjustment = {1:0.1517, 2:0.0770, 4:0.0395, 6:0.0231, 8:0.0159};
  const blackjackCsmReduction = {1:0.113, 2:0.063, 4:0.034, 6:0.020, 8:0.014};
  const blackjackSixFiveAdjustment = {1:1.394773, 2:1.373499, 4:1.363115, 6:1.359690, 8:1.357984};
  function blackjackHouseEdge(rules={}){
    const decks = [1,2,4,6,8].includes(Number(rules.decks)) ? Number(rules.decks) : 4;
    const h17 = rules.soft17 === 'hit' ? 1 : 0;
    const das = rules.das === false ? 0 : 1;
    const surrender = rules.surrender === true ? 1 : 0;
    let edge = blackjackOptimalEdges[`${decks},${h17},${das}`][surrender];
    edge += blackjackCutCardAdjustment[decks];
    if(rules.csm) edge -= blackjackCsmReduction[decks];
    if(rules.blackjackPayout === '6:5') edge += blackjackSixFiveAdjustment[decks];
    return edge;
  }

  function blackjackStrategyActionCode(hand, dealerUpCard, rules={}, usePair=true){
    const up = blackjackDealerUpValue(dealerUpCard);
    if(!hand || !up) return null;
    const total = blackjackTotal(hand.cards);
    const deckGroup = rules.decks === 1 ? 0 : rules.decks === 2 ? 1 : 2;
    const table = blackjackStrategyTables[`${rules.soft17 === 'hit' ? 'H17' : 'S17'}_${deckGroup}`];
    const dealerColumn = up === 11 ? 9 : up - 2;
    const pairRank = hand.cards.length === 2 && blackjackRank(hand.cards[0]) === blackjackRank(hand.cards[1]) ? blackjackRank(hand.cards[0]) : null;
    let row;
    if(pairRank !== null && usePair){
      const pairValue = pairRank === 12 ? 11 : Math.min(10, pairRank + 2);
      row = 26 + (pairValue === 11 ? 9 : pairValue - 2);
    }else if(total.soft && total.total >= 13){
      row = 17 + Math.min(8, total.total - 13);
    }else{
      row = Math.max(0, Math.min(16, total.total - 5));
    }
    return table[row][dealerColumn];
  }

  function blackjackBasicStrategyCode(section, value, dealerUpValue, rules={}){
    const deckGroup = rules.decks === 1 ? 0 : rules.decks === 2 ? 1 : 2;
    const table = blackjackStrategyTables[`${rules.soft17 === 'hit' ? 'H17' : 'S17'}_${deckGroup}`];
    const dealerColumn = dealerUpValue === 11 ? 9 : dealerUpValue - 2;
    const row = section === 'pair' ? 26 + (value === 11 ? 9 : value - 2)
      : section === 'soft' ? 17 + Math.max(0, Math.min(8, value - 13))
      : Math.max(0, Math.min(16, value - 5));
    let code = table[row][dealerColumn];
    if(code === 'QD') code = rules.das === false ? 'DH' : 'P';
    if(code === 'QH') code = rules.das === false ? 'H' : 'P';
    if(code === 'QS') code = rules.das === false ? 'S' : 'P';
    if(code[0] === 'R' && rules.surrender !== true) code = code[1];
    return code.length === 2 ? `${code[0]}/${code[1]}` : code;
  }

  function blackjackAdvice({hand, dealerUpCard, rules={}, bank=Infinity, handCount=1}){
    const up = blackjackDealerUpValue(dealerUpCard);
    if(!hand || hand.status !== 'active' || !up) return {action:'-', why:'No active decision.'};
    const canDouble = blackjackCanDouble(hand, bank, rules);
    const canSplit = blackjackCanSplit(hand, handCount, bank);
    const canSurrender = blackjackCanSurrender(hand, rules);
    let code = blackjackStrategyActionCode(hand, dealerUpCard, rules);
    if(code === 'QD') code = rules.das ? 'P' : 'DH';
    if(code === 'QH') code = rules.das ? 'P' : 'H';
    if(code === 'QS') code = rules.das ? 'P' : 'S';
    if(code === 'RH' || code === 'RS' || code === 'RP'){
      if(canSurrender) return {action:'surrender', why:'Late surrender is the correct basic-strategy play for these rules.'};
      code = code.slice(1);
    }
    if(code === 'P' && !canSplit){
      code = blackjackStrategyActionCode(hand, dealerUpCard, rules, false);
    }
    if(code === 'RH' || code === 'RS' || code === 'RP'){
      if(canSurrender) return {action:'surrender', why:'Late surrender is the correct basic-strategy play for these rules.'};
      code = code.slice(1);
    }
    if(code === 'DH') code = canDouble ? 'D' : 'H';
    if(code === 'DS') code = canDouble ? 'D' : 'S';
    const action = {H:'hit', S:'stand', D:'double', P:'split'}[code] || 'hit';
    const labels = {hit:'Hit', stand:'Stand', double:'Double', split:'Split'};
    return {action, why:`${labels[action]} is the correct basic-strategy play for this ruleset.`};
  }
  function blackjackNaturalOutcome(playerHand, dealerCards, bet, blackjackPayout='3:2'){
    const playerNatural = blackjackIsNatural(playerHand);
    const dealerNatural = blackjackIsNatural({cards:dealerCards || [], split:false});
    if(!playerNatural && !dealerNatural) return null;
    if(playerNatural && dealerNatural) return {returned:bet, net:0, label:'Blackjack push'};
    if(playerNatural){
      const payout = blackjackPayout === '6:5' ? 1.2 : 1.5;
      const label = blackjackPayout === '6:5' ? 'Blackjack pays 6:5' : 'Blackjack pays 3:2';
      return {returned:bet * (1 + payout), net:bet * payout, label};
    }
    return {returned:0, net:-bet, label:'Dealer blackjack'};
  }
  function blackjackSettleHand(hand, dealerCards){
    const playerTotal = blackjackTotal(hand.cards).total;
    const dealerTotal = blackjackTotal(dealerCards).total;
    let returned = 0, label = '';
    if(hand.status === 'surrender'){
      returned = hand.bet / 2;
      label = 'Surrender';
    }else if(playerTotal > 21){
      label = 'Bust';
    }else if(dealerTotal > 21 || playerTotal > dealerTotal){
      returned = hand.bet * 2;
      label = 'Win';
    }else if(playerTotal === dealerTotal){
      returned = hand.bet;
      label = 'Push';
    }else{
      label = 'Loss';
    }
    return {returned, net:returned - hand.bet, label, playerTotal, dealerTotal};
  }
  function blackjackCanExitRound(stage, busy){
    return !busy && stage !== 'player' && stage !== 'dealer';
  }

  return {
    RANKS,
    SUITS,
    TRIPS_PAY,
    BLIND_WIN_PAY,
    BAD_BEAT_PAY,
    POCKET_PAY,
    handRank7,
    classify,
    compareHands,
    handEval,
    pocketBonusPayout,
    best5HoleInRank,
    dealerOutsDetailed,
    riverWoORuleDecision,
    computeAdvice,
    recommendWoO,
    settleHypGeneric,
    settleHand,
    settleFold,
    blackjackRank,
    blackjackTotal,
    blackjackIsNatural,
    blackjackCanPlaceBet,
    blackjackCanSplit,
    blackjackCanDouble,
    blackjackCanSurrender,
    blackjackDealerUpValue,
    blackjackShouldDealerHit,
    blackjackDealerOutcomeProbabilities,
    blackjackInitialEvSupported,
    blackjackInitialDecisionEv,
    blackjackActionEvs,
    blackjackHouseEdge,
    blackjackBasicStrategyCode,
    blackjackAdvice,
    blackjackNaturalOutcome,
    blackjackSettleHand,
    blackjackCanExitRound
  };
});
