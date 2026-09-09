# CandidateLoop Deployment Guide

This document outlines the planned AWS deployment path for CandidateLoop, ensuring safety, simplicity, and alignment with the upcoming Strands backend implementation.

## 1. Minimal AWS Deployment Path

To keep the architecture simple and robust for the hackathon, we recommend a containerized approach for the backend and a static host for the frontend.

### Backend (AgentCore & FastAPI)
- **Target:** AWS App Runner or Amazon ECS (Fargate).
- **Why:** Both services natively support standard Docker containers (like the provided `Dockerfile`). App Runner is the simplest path from a container registry to a live HTTPS endpoint.
- **Agent Integration:** The backend relies on Amazon Bedrock. App Runner/ECS tasks will need an IAM Task Role with permissions to invoke Amazon Bedrock models (`bedrock:InvokeModel`).

### Frontend (Vinext/React)
- **Target:** AWS Amplify Hosting or Amazon S3 + CloudFront.
- **Why:** The frontend is a standard Next.js/React application. AWS Amplify provides zero-configuration deployments for Next.js out of the box.

## 2. Environment Configuration

### Backend Environment Variables
The backend requires the following configuration in production:

```env
# CORS Configuration: Comma-separated list of allowed origins.
# Set this to the deployed frontend URL in production.
CORS_ORIGINS=https://your-frontend-domain.com

# AWS Configuration (Used by the upcoming Strands adapter)
AWS_REGION=us-west-2
CANDIDATELOOP_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```
*Note: Do not commit actual AWS access keys. Use IAM Roles (e.g., ECS Task Roles) in production.*

### Frontend Environment Variables
The frontend needs to know where the backend API is hosted:

```env
# The public URL of the deployed FastAPI backend
NEXT_PUBLIC_API_URL=https://your-backend-api-domain.com
```

## 3. Dependencies on Upcoming Work (Codex)
The actual AWS integration depends on Codex's ongoing work to implement the Strands Agent SDK.
- **AgentCore / Bedrock runtime:** Codex is building the integration. The deployment will need an AWS region where Bedrock is available.
- **Credentials:** In local mode, standard `~/.aws/credentials` will be used by the Strands SDK. In deployment, IAM Task Roles will be used. Do not configure static access keys in `.env`.

## 4. Local Testing & Smoke Tests
A local smoke test is available to verify the environment before deployment. This test requires NO AWS credentials, as it uses the deterministic local backend.

```bash
# Run the smoke test to verify backend startup, demo reset, and frontend build
./scripts/smoke_test.sh
```

To run manually:
1. Copy `.env.example` to `.env`.
2. Start the backend: `cd apps/agent && .venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000`
3. Start the frontend: `cd apps/web && npm run dev`
