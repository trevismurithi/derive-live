const WebSocket = require("ws");
require("colors");
const fs = require("fs");
const { CronJob }  = require('cron');

const apiUrl = "wss://ws.derivws.com/websockets/v3?app_id=68653";
const token = "oCS92YDyB7iwQ63"; // Replace with your Deriv API token
const symbol = "1HZ10V"; // Volatility 100 (1s) Index

let socket;
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
  symbol: "1HZ100V",
  limit_order: { take_profit: 1 },
};

let writeStream;
let NumberOfTrades = 0;
let isWaitForServer = false 
let timerInterval = null;
let timer = 0;
let wbsocket = null;
let currentTickLoss = null
const apiUrlWb = "ws://localhost:8084";

// Time validation functions
function isWithinTradingHours() {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's weekend (Saturday = 6, Sunday = 0)
  if (utcDay === 0 || utcDay === 6) {
    console.log(`❌ Weekend detected (Day: ${utcDay}) - No trading allowed`.bgRed);
    return false;
  }
  
  // Convert current time to minutes for easier comparison
  const currentTimeInMinutes = utcHours * 60 + utcMinutes;
  const startTimeInMinutes = 8 * 60 + 40; // 8:40 AM GMT
  const endTimeInMinutes = 10 * 60 + 15;  // 10:15 AM GMT
  
  const isWithinWindow = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  
  if (isWithinWindow) {
    console.log(`✅ Within trading hours: ${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')} GMT`.bgGreen);
  } else {
    console.log(`❌ Outside trading hours: ${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')} GMT (Window: 08:40-10:15 GMT)`.bgRed);
  }
  
  return isWithinWindow;
}

function getCurrentGMTTime() {
  const now = new Date();
  return {
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes(),
    day: now.getUTCDay(),
    dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getUTCDay()]
  };
}

function connect() {
  writeStream = fs.createWriteStream("client.json", { flags: "a" });
  socket = new WebSocket(apiUrl); // Create a new WebSocket connection using the app_id
  // Event handler for when the WebSocket connection is opened
  socket.onopen = function (e) {
    console.log("[open] Connection established"); // Log connection establishment
    
    // Display current time and trading status
    const timeInfo = getCurrentGMTTime();
    console.log(`🕐 Current Time: ${timeInfo.hours.toString().padStart(2, '0')}:${timeInfo.minutes.toString().padStart(2, '0')} GMT on ${timeInfo.dayName}`.bgCyan);
    
    if (isWithinTradingHours()) {
      console.log("✅ TRADING ENABLED - Within trading window (08:40-10:15 GMT, Mon-Fri)".bgGreen);
    } else {
      console.log("❌ TRADING DISABLED - Outside trading window or weekend".bgRed);
    }
    
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
    if (data.msg_type === "proposal") {
      getProposal(data.proposal);
    }
    if (data.msg_type === "buy") {
      // writeStream.write(`Contract Response ${JSON.stringify(data)} \n`);
      // subscribe to the contract and monitor
      socket.send(
        JSON.stringify({
          proposal_open_contract: 1,
          contract_id: data.buy.contract_id,
          subscribe: 1,
        })
      );
    }

    if (data.msg_type === "proposal_open_contract") {
      if (data.proposal_open_contract.is_expired) {
        restartTickCount = true;
        console.log("Contract is sold");
        forgetOpenContract(data.proposal_open_contract.id);
        NumberOfTrades++;
        if(data.proposal_open_contract.bid_price === 0){
          writeStream.write(JSON.stringify({...data, NumberOfTrades}) + '\n');
          writeStream.write(currentTickLoss + '\n');
          wbsocket.send(JSON.stringify({...data, NumberOfTrades}))
        }
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
    isWaitForServer=true
    initiateTimeInterval();
  };

  // Event handler for when an error occurs with the WebSocket connection
  socket.onerror = function (error) {
    console.log(`[error] ${error.message}`); // Log the error that occurred
  };
}

function clientServer(){
  wbsocket = new WebSocket(apiUrlWb); // Create a new WebSocket connection using the app_id
  // Event handler for when the WebSocket connection is opened
  wbsocket.on("open", function (e) {
    console.log("[open] Connection established"); // Log connection establishment
    console.log("Sending to server");
  });

  // Event handler for when a message is received from the server
  wbsocket.onmessage = function (event) {
    console.log("receiving", event.data);
    currentTickLoss = event.data
    if(!isWaitForServer){
      analyzeTicks()
    }
  };

  // Event handler for when the WebSocket connection is closed
  wbsocket.onclose = function (event) {
    console.log("Connection closed", event);
  };

  // Event handler for when an error occurs with the WebSocket connection
  wbsocket.onerror = function (error) {
    console.log(`[error] ${error.message}`); // Log the error that occurred
  };
}

function startListening() {
    socket.send(JSON.stringify(myProposal));
    socket.send(
      JSON.stringify({
        ticks: symbol,
        subscribe: 1,
      })
    );
  }


function analyzeTicks() {
    if(!proposal){
      return
    }
    
    // Check if we're within trading hours and not on weekend
    if (!isWithinTradingHours()) {
      const timeInfo = getCurrentGMTTime();
      console.log(`⏰ Trading blocked - Current time: ${timeInfo.hours.toString().padStart(2, '0')}:${timeInfo.minutes.toString().padStart(2, '0')} GMT on ${timeInfo.dayName}`.bgYellow);
      return;
    }
    
    // Proceed with trade if within trading hours
    console.log(`🚀 Executing trade at ${getCurrentGMTTime().hours.toString().padStart(2, '0')}:${getCurrentGMTTime().minutes.toString().padStart(2, '0')} GMT`.bgGreen);
    
    socket.send(
        JSON.stringify({
          buy: proposal.id,
          price: amount,
        })
      );
      forgetAndSubscribe();
    console.log(`Number of Trades: ${NumberOfTrades}`.bgMagenta);
}

function getProposal(data) {
  // store proposal
  proposal = data;
}

function forgetAndSubscribe() {
  socket.send(
    JSON.stringify({
      forget: proposal.id,
    })
  );
  socket.send(JSON.stringify(myProposal));
}

function forgetOpenContract(id) {
  socket.send(
    JSON.stringify({
      forget: id,
    })
  );
}

function initiateTimeInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timer = timer + 1000;
    console.clear();
    console.log(
      `current timer: ${Math.trunc(timer / (1000))} / ${60} seconds`.bgWhite
    );
    if (timer > 1000 * 60) {
      timer = 0;
      isWaitForServer = false
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
connect();
clientServer()
new CronJob(
  '55 * * * *', // cronTime
  function () {
    writeStream.end();
    // close the socket
    socket.close();
    restartTickCount = true
  }, // onTick
  null, // onComplete
  true, // start
);