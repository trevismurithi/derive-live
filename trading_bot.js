const BollingerBands = require("technicalindicators").BollingerBands;
const RSI = require("technicalindicators").RSI;
const ATR = require("technicalindicators").ATR;
const OBV = require('technicalindicators').OBV;
const ADX = require('technicalindicators').ADX;


// Configuration Parameters
const stake = 10; // $10 per trade
const takeProfit = 0.5; // $0.5 profit target
const tradeDuration = 3000; // 3 seconds in milliseconds

// Function to check market conditions
function analyzeMarket(priceData) {
  const closes = priceData.map((p) => parseFloat(p.close));
  const highs = priceData.map((p) => parseFloat(p.high));
  const lows = priceData.map((p) => parseFloat(p.low));

  // Bollinger Bands Calculation
  const bbInput = { period: 20, values: closes, stdDev: 2 };
  const bbResult = BollingerBands.calculate(bbInput);
  const lastBB = bbResult[bbResult.length - 1];

  // RSI Calculation
  const rsiInput = { period: 14, values: closes };
  const rsiValues = RSI.calculate(rsiInput);
  const lastRSI = rsiValues[rsiValues.length - 1];

  // ATR Calculation
  const atrInput = { period: 14, high: highs, low: lows, close: closes };
  const atrValues = ATR.calculate(atrInput);
  const lastATR = atrValues[atrValues.length - 1];

  // Check for sideways market conditions
  const isSideways =
    lastBB &&
    lastBB.upper - lastBB.lower < 1.5 * lastATR && // 1.5 times the ATR or 1.3,1.2
    lastRSI >= 40 &&
    lastRSI <= 60;
  return isSideways;
}

// Function to calculate OBV
function calculateOBV(priceData, volumes) {
    if(volumes.length < 20) {
        console.log("Not enough data for OBV calculation".bgRed);
        return false;
    }
    const threshold = 10;
    const closes = priceData.map((p) => parseFloat(p.close));
    const obvInput = { close: closes, volume: volumes };
    const obvValues = OBV.calculate(obvInput);
    
    const lastOBV = obvValues[obvValues.length - 1];
    const prevOBV = obvValues[obvValues.length - 2];
    // log last OBV value
    const volumeStable = Math.abs(lastOBV - prevOBV) < threshold;
    if (volumeStable) {
        console.log(`Last OBV value: ${lastOBV} prev ${prevOBV} difference ${Math.abs(lastOBV - prevOBV)}`.bgGreen);
    }else {
        console.log(`Last OBV value: ${lastOBV} prev ${prevOBV} difference ${Math.abs(lastOBV - prevOBV)}`.bgRed);
    }
    // Trade only if OBV is stable (no sharp moves)
    // (Math.abs(lastOBV - prevOBV) < threshold) 
    return volumeStable;
}


// Main function to run the bot
function tradingBot(priceData, volumes) {
  const sidewaysMarket = analyzeMarket(priceData);
  const volumeStable = calculateOBV(priceData, volumes);
  console.log(`Volume stable: ${volumeStable}`.bgYellow);
  // console.log(`Stochastic RSI: ${stochasticRSI}`.bgYellow);
  if (sidewaysMarket) {
    // const currentPrice = priceData[priceData.length - 1].close;
    // console.log(`Current price: ${currentPrice}`.bgGreen);
    if (volumeStable) {
      // console.log("Market suitable for trading. Placing trade.".bgGreen);
      return true
    }else {
      // console.log("Market not suitable for trading. Skipping trade.".bgRed);
      return false
    }
    return true
  } else {
    // console.log("Market not suitable for trading. Skipping trade.".bgRed);
    return false
  }
}

module.exports = { tradingBot };
