# AWS Bedrock Migration Guide

The application has been migrated from Anthropic's Claude Agent SDK to AWS Bedrock. This document outlines the changes and how to use the updated application.

## What Changed

### 1. **API Provider**: Anthropic Claude Agent SDK → AWS Bedrock
- Now uses AWS Bedrock's Claude models via AWS SDK
- Leverages existing AWS CLI credentials
- No need for separate Anthropic API key

### 2. **Conversation Management**: SDK-managed → File-based
- **Before**: Claude Agent SDK managed conversation history automatically
- **After**: Application stores conversation history in JSON files
- More control over conversation data and storage

### 3. **Dependencies**
- **Removed**: `@anthropic-ai/claude-agent-sdk`
- **Added**: `@aws-sdk/client-bedrock-runtime`

## Prerequisites

Before running the application, ensure:

1. **AWS CLI is configured** with credentials
   ```bash
   aws configure
   # Or ensure ~/.aws/credentials exists with valid credentials
   ```

2. **AWS Bedrock Access** is enabled for your account
   - Go to AWS Console → Bedrock
   - Request access to Claude models if needed

3. **IAM Permissions** include Bedrock access
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel",
           "bedrock:InvokeModelWithResponseStream"
         ],
         "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
       }
     ]
   }
   ```

## Configuration

### Environment Variables

Update `backend/.env`:

```bash
# AWS Configuration (uses AWS CLI credentials by default)
# AWS_REGION=us-east-1                          # Optional: override default region
# AWS_DEFAULT_REGION=us-east-1                  # Optional: alternative region setting

# Bedrock Model Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Server Configuration
PORT=8000
NODE_ENV=development

# Storage
DATA_DIR=../data

# CORS
FRONTEND_URL=http://localhost:5173
```

### Available Claude Models on Bedrock

| Model ID | Description |
|----------|-------------|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.5 Sonnet v2 (Latest) |
| `anthropic.claude-3-5-sonnet-20240620-v1:0` | Claude 3.5 Sonnet v1 |
| `anthropic.claude-3-sonnet-20240229-v1:0` | Claude 3 Sonnet |
| `anthropic.claude-3-haiku-20240307-v1:0` | Claude 3 Haiku (Fastest) |
| `anthropic.claude-3-opus-20240229-v1:0` | Claude 3 Opus (Most capable) |

## Architecture Changes

### Before (Claude Agent SDK)
```
User Message → Backend → Claude Agent SDK (with session ID)
                                ↓
                         Automatic history management
                                ↓
                         Response with new session ID
```

### After (AWS Bedrock)
```
User Message → Backend → Load conversation history from file
                                ↓
                         AWS Bedrock API (with full history)
                                ↓
                         Save message + response to file
```

## Storage Structure

### Before
```json
// data/sessions.json
[
  {
    "userId": "user-123",
    "sessionId": "claude-session-abc",
    "createdAt": 1234567890,
    "lastActivity": 1234567891
  }
]

// History managed by Claude SDK in ~/.claude/projects/
```

### After
```json
// data/sessions.json
[
  {
    "userId": "user-123",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Hello!",
        "timestamp": 1234567890
      },
      {
        "role": "assistant",
        "content": "Hi! How can I help you?",
        "timestamp": 1234567891
      }
    ],
    "createdAt": 1234567890,
    "lastActivity": 1234567891
  }
]
```

## Code Changes Summary

### Backend Services

1. **bedrock.service.ts** (NEW)
   - Replaced `agent.service.ts`
   - Uses AWS Bedrock Runtime Client
   - Implements `ConverseStreamCommand` for streaming

2. **storage.service.ts** (UPDATED)
   - Changed from session ID storage to conversation history storage
   - New methods:
     - `getUserConversation(userId)` - Get full conversation history
     - `addMessage(userId, role, content)` - Add message to history
   - Removed methods:
     - `getUserSession()` - No longer needed
     - `saveUserSession()` - No longer needed

3. **chat.routes.ts** (UPDATED)
   - Load conversation history before sending to Bedrock
   - Save both user and assistant messages after response

4. **env.ts** (UPDATED)
   - Removed `anthropicApiKey`
   - Added `awsRegion` and `bedrockModelId`

### Tests

All 19 tests passing:
- ✅ 6 Bedrock service tests
- ✅ 13 Storage service tests

## Running the Application

### Installation
```bash
# Install dependencies (AWS SDK will be installed)
pnpm install
```

### Development
```bash
# Start both frontend and backend
pnpm dev

# Backend only
pnpm dev:backend

# Frontend only
pnpm dev:frontend
```

### Testing
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Backend tests only
pnpm test:backend
```

## Verification

### Check AWS Credentials
```bash
# Verify AWS CLI is configured
aws sts get-caller-identity

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

### Check Backend Connection
```bash
# Start backend
pnpm dev:backend

# You should see:
# 🔧 AWS Region: us-east-1
# 🤖 Bedrock Model: anthropic.claude-3-5-sonnet-20241022-v2:0
# 📡 Frontend URL: http://localhost:5173
# 🚀 Backend server running at http://localhost:8000
```

### Test API
```bash
# Health check
curl http://localhost:8000/api/health

# Test conversation (requires backend running)
curl "http://localhost:8000/api/chat/stream?userId=test-user&message=Hello"
```

## Troubleshooting

### Issue: "Access Denied" Error
**Solution**: Enable Bedrock model access in AWS Console
```
AWS Console → Bedrock → Model access → Request access to Claude models
```

### Issue: "Region not supported"
**Solution**: Use a Bedrock-supported region
```bash
# Supported regions: us-east-1, us-west-2, ap-southeast-1, ap-northeast-1, eu-central-1
export AWS_REGION=us-east-1
```

### Issue: "AWS credentials not found"
**Solution**: Configure AWS CLI
```bash
aws configure
# OR
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
```

### Issue: Conversation history not loading
**Solution**: Check `data/sessions.json` file exists and has proper permissions
```bash
mkdir -p data
chmod 755 data
```

## Benefits of AWS Bedrock

1. **🔐 Enterprise Security**: Uses AWS IAM for access control
2. **💰 Cost Control**: AWS billing and budget alerts
3. **📊 Monitoring**: CloudWatch integration for logs and metrics
4. **🌍 Multi-Region**: Deploy across AWS regions
5. **🔄 Easy Integration**: Works with existing AWS infrastructure

## Performance Notes

- **Latency**: Similar to direct Anthropic API (~200-500ms first token)
- **Throughput**: Bedrock handles high concurrent requests well
- **Cost**: Similar pricing to Anthropic API (per token)

## Future Enhancements

Possible improvements:
- Use AWS DynamoDB instead of JSON files for scalability
- Add CloudWatch logging for conversation analytics
- Implement AWS Lambda for serverless deployment
- Use AWS S3 for long-term conversation archival

---

**Need Help?**
- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- Claude on Bedrock: https://docs.anthropic.com/en/api/claude-on-amazon-bedrock

**Migration Date**: 2024-11-12
