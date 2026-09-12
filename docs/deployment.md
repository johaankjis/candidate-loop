# CandidateLoop Deployment Guide

This document outlines the AWS deployment path for CandidateLoop, ensuring safety, simplicity, and alignment with the integrated Strands backend implementation.

## 1. Minimal AWS Deployment Path

To keep the architecture simple and robust for the hackathon, we recommend a containerized approach for the backend and a static host for the frontend.

### Backend (Strands Agent & FastAPI)
- **Target:** AWS App Runner or Amazon ECS (Fargate).
- **Why App Runner / ECS over Bedrock AgentCore Runtime?** While Amazon Bedrock AgentCore Runtime supports deploying code-based agents like Strands, CandidateLoop currently uses an `InMemoryRepository` to share state directly between the operations cockpit API and the agent loop. Deploying the FastAPI application as a unified container keeps the architecture simple, maintains state consistency without requiring an external database, and respects the hackathon boundaries. App Runner is the simplest path from a container registry to a live HTTPS endpoint.
- **Agent Integration:** The backend uses Strands with Amazon Bedrock when explicitly configured. App Runner/ECS tasks will need an IAM Task Role with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions.

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

# Explicit Strands/Bedrock runtime configuration
CANDIDATELOOP_EXECUTION_MODE=strands
CANDIDATELOOP_MODEL_PROVIDER=bedrock
AWS_REGION=us-west-2
CANDIDATELOOP_MODEL_ID=us.amazon.nova-lite-v1:0
```
*Note: Do not commit actual AWS access keys. Use IAM Roles (e.g., ECS Task Roles) in production.*

*OpenRouter is an alternate provider for the same Strands runtime: set
`CANDIDATELOOP_MODEL_PROVIDER=openrouter`, an OpenRouter `CANDIDATELOOP_MODEL_ID`, and
`OPENROUTER_API_KEY` instead of `AWS_REGION`. See `apps/agent/README.md`.*

### Frontend Environment Variables
The frontend needs to know where the backend API is hosted:

```env
# The public URL of the deployed FastAPI backend
NEXT_PUBLIC_API_URL=https://your-backend-api-domain.com
```

## 3. Human Setup, AWS Requirements & Runtime Prerequisites

- **Bedrock model access:** The configured account and region must provide access to the selected tool-capable model (e.g., `us.amazon.nova-lite-v1:0`).
- **Credentials:** In local mode, the Strands SDK uses boto3's standard credential chain. In deployment, use an IAM task role. Do not configure static access keys in `.env`.
- **Failure behavior:** Production mode never falls back to the deterministic runner. Failed or incomplete Strands passes return an error and roll back partial in-memory changes.
- **Container Registry:** Push the Docker image (built from `apps/agent/Dockerfile`) to Amazon ECR.
- **IAM Task Role:** Create an IAM Role for the App Runner or ECS task that includes `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions.
- **App Runner Service:** Create an App Runner service pointing to the ECR image, supplying the necessary environment variables and attaching the IAM Task Role.
- **Amplify/Cloudflare Deployment:** Deploy the frontend and set `NEXT_PUBLIC_API_URL` to the generated App Runner URL.

## 4. Local Testing & Smoke Tests
A local smoke test is available to verify the environment before deployment. This test requires NO AWS credentials, as it can use the deterministic local backend.

```bash
# Run the smoke test to verify backend startup, demo reset, frontend build, and Docker packaging
./scripts/smoke_test.sh
```

To run manually:
1. Copy `.env.example` to `.env`.
2. Start the backend: `cd apps/agent && .venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000`
3. Start the frontend: `cd apps/web && npm run dev`

For a live Bedrock verification before deployment, run the exact command documented in
`apps/agent/README.md` under **Live Amazon Bedrock smoke test**.
