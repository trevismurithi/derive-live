const WebSocket = require("ws");
const http = require("http");
require("colors");
const fs = require("fs");
const { CronJob } = require("cron");
const { tradingBot } = require("./trading_bot");

const apiUrl = "wss://ws.derivws.com/websockets/v3?app_id=68813";
const token = "oCS92YDyB7iwQ63"; // Replace with your Deriv API token BEfwiFAdoKCC2PG
const symbol = "1HZ10V"; // Volatility 100 (1s) Index
let currentPrice = 0;

let socket;
let forwardSocket;
let tickHistory = [];
let tickCount = 0; // Tracks the current tick sequence
let proposal = null;
const amount = 20;
const myProposal = {
  proposal: 1,
  subscribe: 1,
  amount: amount,
  basis: "stake",
  contract_type: "ACCU",
  currency: "USD",
  growth_rate: 0.05,
  symbol,
  limit_order: { take_profit: 1 },
};
let maxTicks = 18;
let writeStream;
let restartTickCount = false;
let initialTrade = false;
let NumberOfTrades = 0;
let timerInterval = null;
let timer = 0;
let wbsocket = null;
const clients = [];
let priceHistory = [];
let volatilityHistory = [];
const MIN_THRESHOLD = 0.0006; // 0.02% Minimum Low Volatility Threshold
const TICK_HISTORY = 15; // 🔥 Increased to 30 ticks for better stability
let lowestVolatility = Infinity; // Start with a high value
let priceData = [];
let volumeData = [];
let tickNumber = 0;
let lastBoughtTime = null;

function connect() {
  writeStream = fs.createWriteStream("v5.json", { flags: "a" });
  socket = new WebSocket(apiUrl); // Create a new WebSocket connection using the app_id
  // Event handler for when the WebSocket connection is opened
  socket.onopen = function (e) {
    console.log("[open] Connection established"); // Log connection establishment
    console.log("Sending to server");

    const sendMessage = JSON.stringify({
      authorize: token,
    }); // Create a ping message in JSON format
    socket.send(sendMessage); // Send the ping message to the server
  };

  // Event handler for when a message is received from the server
  socket.onmessage = function (event) {
    // console.log('Received from server:', event.data);
    const data = JSON.parse(event.data);
    if (data.error) {
      console.error("Error:", data.error.message);
      return;
    }
    if (data.msg_type === "authorize") {
      console.log("Authorization successful");
      startListening();
    }
    if (data.msg_type === "tick") {
      analyzeTicks(data);
    }
    if (data.msg_type === "proposal") {
      getProposal(data.proposal);
    }
    if (data.msg_type === "ohlc") {
      priceData.push(data.ohlc);
      if (priceData.length > 35) {
        priceData.shift();
      }
    }

    //   console.log(`[message] Data received from server: ${event.data}`); // Log the message received from the server
  };

  // Event handler for when the WebSocket connection is closed
  socket.onclose = function (event) {
    if (event.wasClean) {
      console.log(
        `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
      ); // Log clean close with code and reason
    } else {
      console.log("[close] Connection died"); // Log an abrupt close
    }
    writeStream.end();
    timer = 0;
    initiateTimeInterval();
  };

  // Event handler for when an error occurs with the WebSocket connection
  socket.onerror = function (error) {
    console.log(`[error] ${error.message}`); // Log the error that occurred
  };
}

function MotherServer() {
  const port = process.env.PORT || 8084;
  
  // Create HTTP server for Heroku
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'Trading Bot Running',
      timestamp: new Date().toISOString(),
      port: port,
      clients: clients.length
    }));
  });

  // Create WebSocket server
  forwardSocket = new WebSocket.Server({ 
    server: server 
  });

  // Start the server
  server.listen(port, () => {
    console.log(`🚀 Trading Bot Server started on port ${port}`);
    console.log(`📊 HTTP endpoint: http://localhost:${port}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${port}`);
  });

  forwardSocket.on("connection", function connection(ws) {
    console.log("Client connected");

    wbsocket = ws;
    clients.push(ws);

    // ws.on('message', function (message){
    //     console.log('clientMessage ', message)
    //     ws.send('Greetings from the server')
    //   })
  });

  forwardSocket.on("close", function close() {
    wbsocket = null;
    console.log("Client disconnected");
  });
}

function startListening() {
  socket.send(JSON.stringify(myProposal));
  socket.send(
    JSON.stringify({
      ticks: symbol,
      subscribe: 1,
    })
  );
  socket.send(
    JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      end: "latest",
      start: 1,
      style: "candles",
      subscribe: 1,
    })
  );
}

function analyzeTicks(data) {
  console.clear();
  if (!data) {
    return;
  }
  if (data.tick && proposal) {
    const tickPrice = data.tick.quote;
    // convert quote to float
    const tickPriceFloat = parseFloat(tickPrice);
    const lowerBound = parseFloat(proposal.contract_details.low_barrier);
    const upperBound = parseFloat(proposal.contract_details.high_barrier);
    const range = proposal.contract_details.barrier_spot_distance;

    if (priceHistory.length >= TICK_HISTORY) {
      priceHistory.shift(); // Remove the oldest price
    }
    priceHistory.push(tickPriceFloat);

    console.log(
      `Lower Bound: ${lowerBound} - Upper Bound: ${upperBound}`.bgYellow
    );

    if (tickPriceFloat <= upperBound && tickPriceFloat >= lowerBound) {
      console.log("Price is within boundary");
      tickCount++;
      tickNumber++
    } else {
      // Store last 15 ticks
      tickHistory.push(tickCount);
      volumeData.push(tickNumber)
      tickCount = 0;
      tickNumber = 0;
    }

    if (!initialTrade && tickHistory.length) {
      tickHistory.shift();
      volumeData.shift();
      initialTrade = true;
      console.log("Initial Trade".bgYellow);
    }

    if(volumeData.length > 35){
      volumeData.shift()
    }

    if (restartTickCount) {
      tickCount = 0;
      tickNumber = 0;
      restartTickCount = false;
      initialTrade = false;
      tickHistory = [];
      volumeData = [];
      priceData = [];
      priceHistory = [];
      console.log("Restarting tick count".bgYellow);
    }

    console.log(`priceHistory Length: ${priceHistory.length}`.bgCyan);
    if (tickHistory.length > 9) tickHistory.shift(); // Keep only last 9 ticks
    // limit the price history to 9

    if (priceHistory.length >= TICK_HISTORY) {
      let currentVolatility = calculateVolatility(priceHistory);

      // Store volatility values
      if (volatilityHistory.length >= TICK_HISTORY) {
        volatilityHistory.shift();
      }

      console.log("volume data: ", volumeData.length, " price data: ", priceData.length)

      volatilityHistory.push(currentVolatility);

      let averageVolatility =
        volatilityHistory.reduce((sum, v) => sum + v, 0) /
        volatilityHistory.length;

      // Update lowest observed volatility but NEVER increase it
      if (currentVolatility < lowestVolatility) {
        lowestVolatility = currentVolatility;
      }

      compareTime()

      console.log(
        `Price: ${currentPrice}, Volatility: ${currentVolatility.toFixed(
          5
        )}, Avg Volatility: ${averageVolatility.toFixed(5)}`.bgBlue
      );


      // Trade only if volatility is below the lowest recorded level
      if (
        (currentVolatility <= averageVolatility * 0.0006 || averageVolatility < MIN_THRESHOLD) && currentVolatility < MIN_THRESHOLD
      ) {
        console.log("✅ Very Low Volatility ...".bgGreen);
        // get the highest value
        const highestValue = getTheHighestValue(tickHistory);
            if (priceData.length > 30) {
              const isGreenZone = tradingBot(priceData, volumeData);
              console.log("Is Green Zone: ", isGreenZone);
              const lowestValue = 0
              if (
                highestValue > lowestValue &&
                highestValue < maxTicks + 1 &&
                tickCount === highestValue &&
                tickHistory.length === 9
                &&
                compareTime()
                &&
                isGreenZone
              ) {
                // place a trade
                console.log(
                  `Place a trade for ${highestValue} ticks and tickCount: ${tickCount}`
                    .bgGreen.white
                );
                if (wbsocket) {
                  // wbsocket.send(JSON.stringify({buy: true}))
                  NumberOfTrades++;
                  lastBoughtTime = new Date().getTime()
                  console.log(clients.length);
                  clients.forEach((ws) => {
                    ws.send(
                      JSON.stringify({ highestValue, tickHistory, NumberOfTrades })
                    );
                  });
                  writeStream.write(
                    JSON.stringify({
                      highest: highestValue,
                      tickHistory,
                      NumberOfTrades,
                      tickPriceFloat,
                      range,
                      upperBound,
                      lowerBound,
                      upperDiff: upperBound - tickPriceFloat,
                      lowerDiff: tickPriceFloat - lowerBound,
                      currentVolatility,
                      recordedTime: getUTCHoursMinutes(),
                    }) + "\n"
                  );
                  //restartTickCount = true
                }
              }
          }
      } else {
        console.log("⏳ Market too volatile - Waiting...".bgRed);
      }
    }

    // console.log("Lower and Upper bound difference: ", upperBound - lowerBound);
    console.log(
      `Current Tick ${currentPrice} -  Latest Tick: ${tickPriceFloat}`.green
    );

    console.log(`counter: ${tickCount}`.yellow);
    console.log(`Number of Trades: ${NumberOfTrades}`.bgMagenta);
    currentPrice = tickPriceFloat;
    // console.log(`Last 10 Ticks: ${tickHistory.join(", ")}`.bgBlue);
    console.table(tickHistory);
  }
}


// Calculate Standard Deviation (Volatility)
function calculateVolatility(prices) {
  let mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  let variance =
    prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
    prices.length;
  let standardDeviation = Math.sqrt(variance);
  return standardDeviation / mean; // Normalize to percentage
}

function getProposal(data) {
  // store proposal
  proposal = data;
}

function getTheHighestValue(data) {
  let least = -1;
  let index = -1;
  data.forEach((number, i) => {
    let diff = maxTicks - number;
    if (diff > -1 && least > diff && least !== -1) {
      least = diff;
      index = i;
    } else if (least === -1) {
      least = diff;
      index = i;
    }
  });
  return data[index];
}

function initiateTimeInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timer = timer + 1000;
    console.clear();
    console.log(
      `current timer: ${Math.trunc(timer / 1000)} / ${60} seconds`.bgWhite
    );
    if (timer > 1000 * 60) {
      timer = 0;
      console.log("Starting the socket...".bgGreen);
      stopTimeInterval();
      console.log("Reconnecting after 1 minute");
      connect();
    }
  }, 1000);
}

// function to stop the timer
function stopTimeInterval() {
  clearInterval(timerInterval);
  timerInterval = null;
}


function getUTCHoursMinutes() {
  var d = new Date();
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  );
}

function compareTime(){
  if(lastBoughtTime){
    const difference = (new Date().getTime() - lastBoughtTime)/(1000*60*60)
    console.log(`last bought ${difference} hours`.bgYellow)
    return difference > 0.5
  }
  return true
}

connect();
MotherServer();

new CronJob(
  "55 * * * *", // cronTime
  function () {
    writeStream.end();
    // close the socket
    socket.close();
    restartTickCount = true;
  }, // onTick
  null, // onComplete
  true // start
);
