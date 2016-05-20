const db = require('./models/index'),
    q = require('q');

var connected = false;

function connect() {
    return db.sequelize.sync().then(() => {
        console.assert(db.sequelize.models['player'] != null, "Player model was not created!");
        connected = true;
    }).catch((err) => {
        console.error("DB Startup error", err);
    })
}

function disconnect(){
    if (connected){
        connected = false;
        db.sequelize.close();
        db.sequelize = null;
        console.log("Closed DB.");
    }
}

function getPlayerTable(){
    if (connected)
        return db.sequelize.models['player'];
    else
        return null;
}

function getMatchTable(){
    if (connected)
        return db.sequelize.models['match'];
    else
        return null;
}

module.exports = {
    connect: connect,
    disconnect: disconnect,
    getPlayerTable: getPlayerTable,
    getMatchTable
}