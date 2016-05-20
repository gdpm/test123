const express = require('express'),
    matchAnalysis = require('./matchAnalysis');

const router = express.Router();

function isQueryDataOK(server, name) {
    if (!server || !name)
        return false;
    const serverList = ["eune", "euw", "kr", "na"];
    var serverOk = serverList.indexOf(server.toLowerCase()) != -1;
    var nameOk = /^[\w\d\s]+$/.test(name);
    return serverOk && nameOk;
}





router.get('/getplayerid', function (req, res) {

    var server = req.query.server;
    var name = req.query.name;

    var reqOk = isQueryDataOK(server, name);
    if (!reqOk)
        res.status(403).send("bad query.");

    riotApiService.getSummonerId(server.toLowerCase(),
        name.toLowerCase()).then( playerId => {
            res.json({
                playerId: playerId
            })
        })
})



router.get('/playerdata', function(req,res){
    
    var name = req.query.name,
        server = req.query.server;
        
    if (!isQueryDataOK(server,name))
        return res.json({error: "Wrong data.", status_code: 400});
        
        server = server.toLowerCase();
   /*var fakeData = {
        name: "Kappa"
        , server: "EUNE"
        , rank: {
            division: 'IV'
            , lp: 31
            , wins: 200
            , losses: 197
            , tier: 'diamond'
        }
        , gpmPoints: 55
        , kdaPoints: 55
        , kpPoints: 55
        , overallPoints: 555
    }*/
    
    matchAnalysis.analysePlayer(server, name).then(data => {
        return res.json(data);
    }).catch(err => {
        return res.json(err);
    })
});


const publicDir = require('path').resolve(__dirname, '../public');

router.use('*', function(req,res){
    res.sendFile(publicDir + '/index.html');
})


module.exports = router;