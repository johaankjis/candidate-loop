# CandidateLoop Deployment Guide

This document outlines the AWS deployment path for CandidateLoop, ensuring safety, simplicity, and alignment with the integrated Strands backend implementation.

## 1. Minimal AWS Deployment Path

To keep the architecture simple and robust for the hackathon, we recommend a containerized approach for the backend and a static host for the frontend.

### Backend (Strands Agent & FastAPI)
- **Target:** AWS App Runner or Amazon ECS (Fargate).
- **Why App Runner / ECS over Bedrock AgentCore Runtime?** While Amazon Bedrock AgentCore Runtime supports deploying code-based agents like Strands, CandidateLoop currently uses an `InMemoryRepository` to share state directly between the operations cockpit API and the agent loop. Deploying the FastAPI application as a unified container keeps the architecture simple, maintains state consistency without requiring an external database, and respects the hackathon boundaries. App Runner is the simplest path from a container registry to a live HTTPS endpoint.
- **Agent Integration:** The backend relies on Amazon Bedrock. App Runner/ECS tasks will need an IAM Task Role with permissions to invoke Amazon Bedrock models (`bedrock:InvokeModel`).

### Frontend (Vinext/React)
- **Target:** Cloudflare Pages/Workers, or a Node-compatible runtime like AWS Amplify Hosting (if adapted).
- **Why:** The frontend is a Vinext/React application built on Vite and designed for Edge Workers. A Cloudflare deployment is the most native path, though AWS static hosting is possible if exported statically.

## 2. Environment Configuration

### Backend Environment Variables
The backend requires the following configuration in production:

```env
# CORS Configuration: Comma-separated list of allowed origins.
# Set this to the deployed frontend URL in production.
CORS_ORIGINS=https://your-frontend-domain.com

# AWS Configuration (Used by the Strands adapter)
AWS_REGION=us-west-2

# Strands execution mode configuration
CANDIDATELOOP_EXECUTION_MODE=strands
CANDIDATELOOP_MODEL_PROVIDER=bedrock
CANDIDATELOOP_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```
*Note: Do not commit actual AWS access keys. Use IAM Roles (e.g., ECS Task Roles) in production.*

### Frontend Environment Variables
The frontend needs to know where the backend API is hosted:

```env
# The public URL of the deployed FastAPI backend
NEXT_PUBLIC_API_URL=https://your-backend-api-domain.com
```

## 3. Human Setup & AWS Requirements

Since this repository contains no AWS credentials, deploying the backend requires a human to perform the following steps in the AWS Console:

1. **Model Access:** Ensure Amazon Bedrock model access is enabled for the model specified in `CANDIDATELOOP_MODEL_ID` (e.g., Anthropic Claude 3 Haiku) within your chosen `AWS_REGION`.
2. **Container Registry:** Push the Docker image (built from `apps/agent/Dockerfile`) to Amazon ECR.
3. **IAM Task Role:** Create an IAM Role for the App Runner or ECS task that includes `bedrock:InvokeModel` permissions.
4. **App Runner Service:** Create an App Runner service pointing to the ECR image, supplying the necessary environment variables and attaching the IAM Task Role.
5. **Amplify Deployment:** Connect the repository to AWS Amplify to deploy the frontend, setting `NEXT_PUBLIC_API_URL` to the generated App Runner URL.

## 4. Local Testing & Smoke Tests
A local smoke test is available to verify the environment before deployment. This test requires NO AWS credentials, as it can use the deterministic local backend.

```bash
# Run the smoke test to verify backend startup, demo reset, and frontend build
./scripts/smoke_test.sh
```

To run manually:
1. Copy `.env.example` to `.env`.
2. Start the backend: `cd apps/agent && .venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000`
3. Start the frontend: `cd apps/web && npm run dev`
