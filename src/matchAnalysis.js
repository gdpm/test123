const q = require('q'),
    database = require('./database/database'),
    riotApi = require('./riotApiService.js');


var fakeData = false;

function pad(width, string, padding) {
    return (width <= string.length) ? string : pad(width, padding + string, padding)
}

function findMatchData(match, playerId) {
    return match.participants[getPlayersParticipantId(match, playerId) - 1];
}

function getPlayersParticipantId(match, playerId) {
    var participantId = match.participantIdentities.filter(m => {
        return m.player.summonerId == playerId;
    })[0].participantId;
    return participantId;
}

function getGameStats(matchData) {
    var s = matchData.stats;

    return {
        "DmgDone_Champs": s.totalDamageDealtToChampions,
        "DmgTaken": s.totalDamageTaken,
        "PinkWards": s.visionWardsBoughtInGame,
        "HealDone": s.totalHeal,
        "wardsKilled": s.wardsKilled,
        "wardsPlaced": s.wardsPlaced,
        "wonGame": s.winner,
        "gold": s.goldEarned,
        "minions": s.minionsKilled,
        "jungleMinions": s.neutralMinionsKilled
    }
}

const Roles = {
    TOP: "TOP",
    MID: "MIDDLE",
    JUNGLE: "JUNGLE",
    ADC: "ADC",
    SUPP: "SUPPORT",
    OTHER: "OTHER"
}

function getRole(matchData) {
    if (!matchData.timeline)
        return null;
    var role = matchData.timeline.role,
        lane = matchData.timeline.lane;

    if (!role || !lane)
        return null;


    switch (role) {
        case "DUO_CARRY": return Roles.ADC;
        case "DUO_SUPPORT": return Roles.SUPP;
        case "NONE":
            if (lane === "JUNGLE")
                return Roles.JUNGLE;
        case "SOLO":
            switch (lane) {
                case "TOP": return Roles.TOP;
                case "MIDDLE": return Roles.MID;
                case "BOTTOM": return Roles.ADC;  // support is trolling
            }
            return Roles.OTHER;
        case "DUO":
            switch (lane) {
                case "BOTTOM": {
                    // ADC or SUPPORT
                    return Roles.OTHER;
                }
                case "MIDDLE": return Roles.MID;
                case "TOP": return Roles.TOP;
            }
            return Roles.OTHER;
        default:
            console.log("UNKNOWN ROLE", lane, role);
            return Roles.OTHER;
    }

}

// kill participation
function countKP(match, matchData) {
    var playersTeamId = matchData.teamId;
    var teamPlayers = match.participants.filter(p => {
        return p.teamId == playersTeamId;
    });

    var teamKills = 0, teamDeaths = 0;

    teamPlayers.forEach(player => {
        var kills = player.stats.kills,
            deaths = player.stats.deaths;

        console.assert(kills != null && deaths != null, "KP Kills or Deaths NULL");
        teamKills += kills;
        teamDeaths += deaths;
    })

    var kp = (matchData.stats.kills + matchData.stats.assists) / (teamKills || 1);
    kp = kp.toFixed(2) * 100;
    return kp.toFixed();
}
// KDA
function countKDA(matchData) {
    var stats = matchData.stats;
    console.assert(stats, "Match data doesnt have STATS!");
    var kills = stats.kills,
        deaths = stats.deaths || 1,
        assists = stats.assists;

    console.assert(kills != null && deaths != null && assists != null, "Data doesnt have required properties");
    var kda = ((kills + assists) / deaths).toFixed(1);
    //console.log(`K:${kills}, D:${deaths}, A: ${assists}  ==>  ${kda}`);
    return kda;
}

// Frame Data  {totalGold, totalExp}
function getFrameData(match, playerId) {
    var timeline = match.timeline;
    if (!timeline || !timeline.frames)
        return null;

    var framesCount = timeline.frames.length;
    var lastFrame = timeline.frames[framesCount - 1];

    var participantId = getPlayersParticipantId(match, playerId);
    var participantFrame = lastFrame.participantFrames[participantId];

    return {
        "totalGold": participantFrame.totalGold,
        "xp": participantFrame.xp,
        "neutralMinions": participantFrame.minionsKilled,
        "jungleMinions": participantFrame.jungleMinionsKilled
    }
}

var saveMatch = q.async(function* (name, server, matchId, matchResult) {
    try {
        var playerId = yield riotApi.getSummonerId(server, name);

        var matchTable = database.getMatchTable();
        if (!matchTable)
            throw new Error("DB Connection issue, couldnt not load match Table");

        var matchResults = {
            playerId: playerId,
            playerName: name,
            server: server,
            matchId: matchId,
            role: matchResult.role,
            gpm: matchResult.gpm,
            xppm: matchResult.xppm,
            cspm: matchResult.cspm,
            statspm: matchResult.statspm,
            kda: matchResult.kda,
            kp: matchResult.kp
        };
        
        riotApi.addToCache(matchResults);
        
        return yield matchTable.create(matchResults).catch(err => {
            console.error("Couldn't save DB Match for ", name, server, matchResults.matchId);
        });


    } catch (err) {
        console.error("DB Match Save Error", err, name, server, matchResults.matchId);
        throw err;
    }
});

// {server, name, data[]}
function analyseGames(server, name) {
    var matches;

    if (fakeData) {
        matches = q.when(JSON.parse(require('fs').readFileSync(`matches/${server}-${name}.json`), 'utf8'));
    }
    else
        matches = riotApi.getMatches(server, name);

    return matches.then(data => {
        var dataResult = [];

        var playersRank = riotApi.getSummonerRank(name, server);

        data.cached.forEach(cachedMatch => {
            dataResult.push(cachedMatch);
        });

        data.matches.forEach(match => {
            console.log(match.matchId);
            var matchData = findMatchData(match, data.playerId);
            //var frameData = getFrameData(match, data.playerId);
            var playersTeamId = matchData.teamId;
            var playersTeam = match.teams.filter(team => playersTeamId == team.teamId)[0];

            var gameStats = getGameStats(matchData);

            var won = gameStats.wonGame;
            var kda = countKDA(matchData);
            var kp = countKP(match, matchData);

            var role = getRole(matchData);
            var minions = gameStats.minions + gameStats.jungleMinions;
            //frameData.neutralMinions + frameData.jungleMinions;
            var gold = gameStats.gold; //frameData.totalGold;
            var xp = 0; //frameData.xp;


            var matchDurationMin = match.matchDuration / 60;

            var gpm = (gameStats.gold / matchDurationMin).toFixed(1);
            var xppm = (xp / matchDurationMin).toFixed(1);
            var cspm = (minions / matchDurationMin).toFixed(1);

            var stats = gameStats.DmgDone_Champs + gameStats.DmgTaken + gameStats.HealDone;

            var result = {
                role,
                gpm,
                xppm,
                cspm,
                statspm: (stats / matchDurationMin).toFixed(1),
                kda,
                kp
            }

            saveMatch(name, server, match.matchId, result);
            dataResult.push(result);
        });

        var resultsLen = dataResult.length;

        var averages = {
            gpm: 0,
            xppm: 0,
            cspm: 0,
            statspm: 0,
            kda: 0,
            kp: 0
        }

        var suppCount = 0;

        dataResult.forEach(result => {
            var factor = 1.0;
            var isSupport = result.role === "SUPPORT";
            var isJungler = result.role === "JUNGLE";
            if (isSupport) {
                factor = 1.3;
                ++suppCount;
            }

            averages.kda += Number(result.kda);
            averages.kp += Number(result.kp);

            averages.gpm += Number(result.gpm) * factor;
            averages.xppm += Number(result.xppm) * factor;
            if (!isSupport) {
                averages.cspm += Number(result.cspm) * (isJungler ? 1.3 : 1.0);
            }
            averages.statspm += result.statspm * factor;
        });
        averages.gpm /= resultsLen;
        averages.xppm /= resultsLen;
        averages.cspm /= (resultsLen - suppCount);
        averages.statspm /= resultsLen;
        averages.kda /= resultsLen;
        averages.kp /= resultsLen;

        Object.keys(averages).forEach(key => {
            averages[key] = averages[key].toFixed(1);
        })


        return playersRank.then(rank => {
            if (rank)
                averages.rank = rank;
            return averages;
        });
    }).catch(err => {
        return q.reject(err);
    })
}


var getPlayerAnalysisResult = q.async(function* (server, name) {
    try {
        var result = yield analyseGames(server, name);


        var gpm = result.gpm,
            cspm = result.cspm,
            statspm = result.statspm,
            kda = result.kda,
            kp = result.kp;

        console.log("Analysis for", name, ":", gpm, cspm, statspm, kda, kp);

        var perfectGpm = 500,
            perfectKp = 70,
            perfectKda = 5.5,
            perfectStats = 2100;

        var worstGpm = 300,
            worstKp = 35,
            worstKda = 1,
            worstStats = 1000;

        var clamp = v => v < 0 ? 0 : (v > 1 ? 1 : v);

        var gpmF = 1;
        var kpF = 1;
        var kdaF = 1;
        var gpmPoints = clamp((gpm - worstGpm) / (perfectGpm - worstGpm)) * gpmF,
            kdaPoints = clamp((kda - worstKda) / (perfectKda - worstKda)) * kdaF,
            kpPoints = clamp((kp - worstKp) / (perfectKp - worstKp)) * kpF;

        console.log(gpmPoints, kdaPoints, kpPoints);

        return {
            server,
            name,
            rank: result.rank,
            gpmPoints: (gpmPoints * 100).toFixed(0),
            kdaPoints: (kdaPoints * 100).toFixed(0),
            kpPoints: (kpPoints * 100).toFixed(0),
            overallPoints: ((gpmPoints + kdaPoints + kpPoints) / 3 * 1000).toFixed(0)
        }
    } catch (err) {
        console.error("Analysis Result", err);
        return { error: "Some error happened", status_code: err.status_code }
    }
})


module.exports = {
    analysePlayer: getPlayerAnalysisResult
}





//getPlayerAnalysisResult('eune', 'redstarscream').then(console.log);

