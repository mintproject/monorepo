#!/bin/bash

# TACC CKAN Data Catalog Integration Tests Runner
# This script runs the integration tests for the TACC CKAN Data Catalog

echo "🚀 Starting TACC CKAN Data Catalog Integration Tests..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the integration tests
echo "🧪 Running integration tests..."
npm test -- --testPathPattern=".*integration\.test\.ts$" --verbose --testTimeout=60000

# Check the exit code
if [ $? -eq 0 ]; then
    echo "✅ Integration tests completed successfully!"
else
    echo "❌ Integration tests failed!"
    exit 1
fi