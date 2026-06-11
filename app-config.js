(function(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
  }else{
    root.HUHEAppConfig = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const APP_VERSION = '3.2';
  const CURRENT_GAME_ID = 'heads-up-hold-em';
  const VIDEO_POKER_GAME_ID = 'video-poker-jacks-or-better';
  const DEUCES_WILD_GAME_ID = 'video-poker-deuces-wild';

  const config = {
    appName: "Golden Table Games",
    appVersion: APP_VERSION,
    cacheVersion: `v${APP_VERSION}`,
    currentGameId: CURRENT_GAME_ID,
    games: {
      [CURRENT_GAME_ID]: {
        id: CURRENT_GAME_ID,
        name: "Heads Up Hold 'Em",
        version: '2.9',
        sessionSchemaVersion: 2
      },
      [VIDEO_POKER_GAME_ID]: {
        id: VIDEO_POKER_GAME_ID,
        name: 'Jacks or Better Video Poker',
        version: '0.3',
        status: 'beta',
        sessionSchemaVersion: 1
      },
      [DEUCES_WILD_GAME_ID]: {
        id: DEUCES_WILD_GAME_ID,
        name: 'Deuces Wild Video Poker',
        version: '0.3',
        status: 'beta',
        sessionSchemaVersion: 1
      }
    },
    storage: {
      local: {
        playerName: 'huhe.playerName',
        cardStyle: 'huhe.cardStyle',
        miniStatsOrder: 'huhe.miniStatsOrder',
        schemaVersion: 'huhe.storageSchemaVersion'
      },
      sessionDb: {
        name: 'HeadsUpHoldEmDB',
        version: 2,
        sessionsStore: 'sessions',
        indexes: {
          byPlayer: 'byPlayer',
          byGamePlayer: 'byGamePlayer'
        }
      }
    }
  };

  function normalizeSessionSummary(summary, gameId){
    const out = Object.assign({}, summary || {});
    const resolvedGameId = gameId || out.gameId || config.currentGameId;
    out.gameId = resolvedGameId;
    out.schemaVersion = config.games[resolvedGameId]?.sessionSchemaVersion || 1;
    out.gamePlayer = `${resolvedGameId}::${out.player || '-'}`;
    return out;
  }

  function migrateLocalStorage(storage){
    if(!storage) return {changed:false, version:config.storage.sessionDb.version};
    const key = config.storage.local.schemaVersion;
    const target = String(config.storage.sessionDb.version);
    let current = null;
    try{ current = storage.getItem(key); }catch(e){}
    if(current === target) return {changed:false, version:Number(target)};
    try{ storage.setItem(key, target); }catch(e){}
    return {changed:true, version:Number(target), from:current || null};
  }

  return Object.freeze(Object.assign({}, config, {
    normalizeSessionSummary,
    migrateLocalStorage
  }));
});
