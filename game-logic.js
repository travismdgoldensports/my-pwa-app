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
    return {action:'check', why:'Below 3x preflop thresholds'};
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
    settleFold
  };
});
