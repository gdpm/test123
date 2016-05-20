var chai = require('chai');
var assert = chai.assert;

var db = require('../database/database');


describe('Database', function () {
    it("Startup", function (done) {
        db.connect().then(() => { done() }).catch((err) => { done(err); });
    });
    it("Insert and Query", function (done) {
        var playerDb = db.getPlayerTable();
        var record = playerDb.build({
            playerId: 1337,
            literalName: "TestObject",
            riotName: "TestObject"
        });

        record.save().then(() => {
            return record.destroy();
        }).then(() => {
            return playerDb.findOne({
                where: {
                    playerId: 1337
                }
            }).then(player => {
                if (player == null)
                    done();
                else
                    done("Removed record still exists!");
            })
        })
        .catch((err) => { done(err) });
    });
})