#!/bin/bash

# HuggingFace Endpoint Setup Script
# This script helps you set up HuggingFace Inference Endpoints for video generation

set -e

echo "=== HuggingFace Inference Endpoints Setup ==="
echo ""

# Check dependencies
echo "Checking dependencies..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10 or higher."
    exit 1
fi

if ! command -v pip &> /dev/null; then
    echo "❌ pip is not installed. Please install pip."
    exit 1
fi

# Install huggingface_hub if not present
if ! python3 -c "import huggingface_hub" 2>/dev/null; then
    echo "Installing huggingface_hub..."
    pip install -U huggingface_hub
fi

echo "✅ Dependencies checked"
echo ""

# Request HF token securely
echo "Please enter your HuggingFace token (will be hidden):"
read -s HF_TOKEN
echo ""

if [ -z "$HF_TOKEN" ]; then
    echo "❌ HuggingFace token is required"
    exit 1
fi

# Export token for CLI usage
export HF_TOKEN

# Login to HuggingFace
echo "Logging in to HuggingFace..."
huggingface-cli login --token "$HF_TOKEN" --machine

echo "✅ Logged in successfully"
echo ""

# Ask for region preference
echo "Select AWS region for endpoints:"
echo "1) us-east-1 (Virginia)"
echo "2) us-west-2 (Oregon)"
echo "3) eu-west-1 (Ireland)"
echo "4) ap-southeast-1 (Singapore)"
read -p "Enter choice (1-4): " region_choice

case $region_choice in
    1) REGION="us-east-1" ;;
    2) REGION="us-west-2" ;;
    3) REGION="eu-west-1" ;;
    4) REGION="ap-southeast-1" ;;
    *) REGION="us-east-1" ;;
esac

echo "Selected region: $REGION"
echo ""

# Create Fast endpoint
echo "Creating Fast endpoint (L40 S - always warm)..."
FAST_ENDPOINT_OUTPUT=$(huggingface-cli endpoint create hunyuan-fast \
    --repository tencent/HunyuanVideo-Avatar \
    --instance-type "aws-nvidia-l40s-x1" \
    --min-replicas 1 \
    --max-replicas 2 \
    --region "$REGION" \
    --environment "HF_ENABLE_TEACACHE=1,HYMM_SAMPLE_MODE=fast" 2>&1 || true)

if echo "$FAST_ENDPOINT_OUTPUT" | grep -q "already exists"; then
    echo "Fast endpoint already exists, fetching URL..."
else
    echo "Fast endpoint created successfully"
fi

# Create Quality endpoint
echo ""
echo "Creating Quality endpoint (H100 - cold start)..."
QUALITY_ENDPOINT_OUTPUT=$(huggingface-cli endpoint create hunyuan-quality \
    --repository tencent/HunyuanVideo-Avatar \
    --instance-type "aws-nvidia-h100-x1" \
    --min-replicas 0 \
    --max-replicas 1 \
    --region "$REGION" 2>&1 || true)

if echo "$QUALITY_ENDPOINT_OUTPUT" | grep -q "already exists"; then
    echo "Quality endpoint already exists, fetching URL..."
else
    echo "Quality endpoint created successfully"
fi

# Get endpoint URLs
echo ""
echo "Fetching endpoint URLs..."

# Wait a moment for endpoints to be ready
sleep 3

# Get Fast endpoint URL
FAST_URL=$(huggingface-cli endpoint info hunyuan-fast --url 2>/dev/null || echo "")
QUALITY_URL=$(huggingface-cli endpoint info hunyuan-quality --url 2>/dev/null || echo "")

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Add the following to your .env.local file:"
echo ""
echo "# HuggingFace Video Generation"
echo "HF_TOKEN=$HF_TOKEN"
echo "HF_ENDPOINT_FAST_URL=$FAST_URL"
echo "HF_ENDPOINT_QUALITY_URL=$QUALITY_URL"
echo ""
echo "Fast endpoint (L40 S): $FAST_URL"
echo "Quality endpoint (H100): $QUALITY_URL"
echo ""
echo "Note: Endpoints may take 2-5 minutes to become fully operational."
echo "The Fast endpoint stays warm (costs ~$1.80/hour when idle)."
echo "The Quality endpoint starts cold (no idle cost, ~$1 per 5-second video)."
echo ""
echo "To manage endpoints, visit: https://huggingface.co/settings/endpoints"
