const v8 = require('v8');
//v8.setFlagsFromString('--expose-gc --trace-gc --trace-gc-verbose --trace-gc-ignore-scavenger --max-old-space-size=1000');

const express = require('express'),
    bodyParser = require('body-parser'),
    http = require('http'),
    cookieParser = require('cookie-parser'),
    morgan = require('morgan'),
    path = require('path'),
    q = require('q')
const fs = require('fs');

const app = express();
const httpServer = http.createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const publicDir = path.resolve(__dirname, '../public');


app.use(express.static(publicDir));

console.log("USING ENV:", process.env.NODE_ENV);
const port = process.env.port || 3000;

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});


const router = require('./router');

app.use(router);

const database = require('./database/database');
const riotApiService = require('./riotApiService');


database.connect().then(() => {
    console.log("DB CONNECTED");
    riotApiService.loadCache();
    var matchAnalysis = require('./matchAnalysis');

    httpServer.listen(port, function () {
        console.log("Server running at port 3000");
    });
}).catch((err) => {
    console.error("Database Connection error, closing", err)
    process.exit(0);
});


// process.on('unhandledRejection', (reason, p) => {
//     console.log("Unhandled Rejection at: Promise ", p, " reason: ", reason);
// });

process.on('uncaughtException', (err) => {
  console.log(`Caught exception: ${err}`);
});

function onExit(SIGINT) {
    if (SIGINT)
        process.exit();
    else {
        httpServer.close();
        database.disconnect();
    }
}

process.on('exit', onExit.bind(null, false));
process.on('SIGINT', onExit.bind(null, true));


//var profiler = require('./profiler').init(__dirname+'/memdumps');
