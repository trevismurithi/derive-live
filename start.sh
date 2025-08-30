#!/bin/bash

echo "Starting win.js server..."
node win.js &
WIN_PID=$!

echo "Waiting for win.js to start..."
sleep 3

echo "Starting client server..."
node "client server3.js" &
CLIENT_PID=$!

echo "Both processes started:"
echo "win.js PID: $WIN_PID"
echo "client server PID: $CLIENT_PID"

# Function to handle cleanup
cleanup() {
    echo "Stopping processes..."
    kill $WIN_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT

# Wait for both processes
wait


