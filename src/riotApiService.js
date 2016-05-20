const q = require('q'),
    https = require('https'),
    db = require('./database/database'),
    process = require('process');
const limit = process.env.limit || 35;

var summonerIdCache = {};
var matchCache = {};

const apiKeys = [
    '6e008321-75cf-49be-8d17-74ce735a42bd',
    'f8ff2765-6028-486b-b3c9-4be316d92188',
    'a27b5773-604c-45b2-956e-79c68fa1e4bd',
    '89b4438f-361d-4c5f-b402-f2ef60a8e9b1'

];
var currentKey = 0;

const apiUrls = {
    summonerByName: 'https://{server}.api.pvp.net/api/lol/{server}/v1.4/summoner/by-name/{name}?api_key={key}',
    matchList: 'https://{server}.api.pvp.net/api/lol/{server}/v2.2/matchlist/by-summoner/{id}?beginIndex=0&endIndex=35&rankedQueues=TEAM_BUILDER_DRAFT_RANKED_5x5&api_key={key}',
    matchById: 'https://{server}.api.pvp.net/api/lol/{server}/v2.2/match/{matchId}?includeTimeline=false&api_key={key}',
    playerRank: 'https://{server}.api.pvp.net/api/lol/{server}/v2.5/league/by-summoner/{id}?api_key={key}'
};


function loadCache(){
    var matchTable = db.getMatchTable();
    if (!matchTable)
        throw new Error("No match table!");
        
    return matchTable.findAll().then(function(data){
        data.forEach(d => {
            d = d.dataValues;
            matchCache[d.matchId] = d;
        })
        console.log("Cache loaded", data.length);
    })
}

function addToCache(matchResult){
    matchCache[matchResult.matchId] = matchResult;
}



function getApiKey() {
    return apiKeys[currentKey++ % apiKeys.length];
}

function getSummonerId(server, name) {
    var riotName = name.toLowerCase().replace(' ', '').replace('%20', '')
    var cachedId = summonerIdCache[server + riotName];
    if (cachedId)
        return q.resolve(cachedId);

    var playerTable = db.getPlayerTable();

    if (!playerTable)
        return q.resolve(null);

    name = name.toLowerCase();
    return playerTable.findOne({
        where: {
            riotName: riotName,
            server: server
        }
    }).then(player => {
        if (player)
            return player.dataValues.playerId;
        else
            return performRequest().catch(function (err) {
                throw new Error("Request Error, Couldn't query for user id!", err);
            }).then(newPlayer => {
                summonerIdCache[server + riotName] = newPlayer.dataValues.playerId;
                return newPlayer.dataValues.playerId;
            });
    });

    function performRequest() {
        console.log("Querying api for User", riotName, server);
        
        var url = apiUrls.summonerByName
            .replace(/\{server\}/g, server)
            .replace(/\{name\}/, riotName)
            .replace(/\{key\}/, getApiKey());
        return request(url).then(json => {
            var playerData = json[Object.keys(json)[0]];
            return playerTable.create({
                playerId: playerData.id,
                literalName: playerData.name,
                riotName: riotName,
                server: server
            }).catch(err=>{
                console.error("PlayerTable DB Save Error",err);
            });
        });
    }
}

var getSummonerRank = q.async(function* (name, server) {
    try {
        var summonerId = yield getSummonerId(server, name);

        var url = apiUrls.playerRank
            .replace(/\{server\}/g, server)
            .replace(/\{id\}/, summonerId)
            .replace(/\{key\}/, getApiKey());

        var data = yield request(url);
        data = data[Object.keys(data)[0]];
        var ranks = data.filter(que => {
            return que.queue === "RANKED_SOLO_5x5";
        })[0];

        if (ranks && ranks.entries) {
            var tier = ranks.tier;
            var player = ranks.entries.filter(rank => {
                return +rank.playerOrTeamId === +summonerId;
            })[0];

            return {
                division: player.division,
                lp: player.leaguePoints,
                wins: player.wins,
                losses: player.losses,
                tier: tier
            }
        }
    }
    catch (err) {
        console.error("Player rank not found", err, name, server);
        return null;
    }
});

function getGame(matchId, server) {
    var url = apiUrls.matchById.replace(/\{server\}/g, server)
        .replace(/\{matchId\}/, matchId)
        .replace(/\{key\}/, getApiKey());
    return request(url);
}

var getMatchesGen = q.async(function* (server, name) {
    try {
        var summonerId = yield getSummonerId(server, name);

        var url = apiUrls.matchList.replace(/\{server\}/g, server)
            .replace(/\{id\}/, summonerId)
            .replace(/\{key\}/, getApiKey());

        var requestData = yield request(url);
        if (!requestData.matches)
            throw new Error("Could not load matches", name, server);
        var matchIds = requestData.matches.filter(match => {
            return match.queue === "TEAM_BUILDER_DRAFT_RANKED_5x5";
        }).reduce((acc, curr) => {
            return acc.push(curr.matchId) && acc;
        }, []).slice(0, limit);

        var promises = [];
        var cached = [];
        matchIds.forEach(id => {
            id = String(id);
            if (id in matchCache)
                cached.push(matchCache[id]);
            else
                promises.push(getGame(id, server));
        });

        var results = yield q.all(promises);
        return {
            matches: results,
            cached: cached,
            playerId: summonerId
        }
    } catch (error) {
        //console.log("GetMatchesGen", error, name, server);
        throw error;
    }
});



function request(url) {
    var defer = q.defer();
    https.get(url, res => {
        res.setEncoding('utf8');
        var data = '';
        res.on('error', () => {
            return defer.reject();
        })
        res.on('data', chunk => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                var json = JSON.parse(data);
            } catch (err) {
                console.error("JSON Parsing error", err);
                return defer.reject();
            }
            if (json.status && json.status.status_code != 200)
                return defer.reject(json.status);
            return defer.resolve(json);
        })
    })
    return defer.promise;
}



module.exports = {
    getSummonerId,
    getMatches: getMatchesGen,
    getSummonerRank,
    loadCache,
    addToCache
}