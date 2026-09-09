# CandidateLoop Deployment Guide

This document outlines the planned AWS deployment path for CandidateLoop, with safety and
simplicity as the priorities.

## 1. Minimal AWS Deployment Path

To keep the architecture simple and robust for the hackathon, we recommend a containerized approach for the backend and a static host for the frontend.

### Backend (AgentCore & FastAPI)
- **Target:** AWS App Runner or Amazon ECS (Fargate).
- **Why:** Both services natively support standard Docker containers (like the provided `Dockerfile`). App Runner is the simplest path from a container registry to a live HTTPS endpoint.
- **Agent Integration:** The backend uses Strands with Amazon Bedrock when explicitly configured.
  App Runner/ECS tasks will need an IAM task role with `bedrock:InvokeModel` and
  `bedrock:InvokeModelWithResponseStream` permissions.

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

# Explicit Strands/Bedrock runtime configuration
CANDIDATELOOP_EXECUTION_MODE=strands
CANDIDATELOOP_MODEL_PROVIDER=bedrock
AWS_REGION=us-west-2
CANDIDATELOOP_MODEL_ID=us.amazon.nova-lite-v1:0
```
*Note: Do not commit actual AWS access keys. Use IAM Roles (e.g., ECS Task Roles) in production.*

### Frontend Environment Variables
The frontend needs to know where the backend API is hosted:

```env
# The public URL of the deployed FastAPI backend
NEXT_PUBLIC_API_URL=https://your-backend-api-domain.com
```

## 3. Runtime prerequisites

- **Bedrock model access:** The configured account and region must provide access to the selected
  tool-capable model.
- **Credentials:** In local mode, the Strands SDK uses boto3's standard credential chain. In
  deployment, use an IAM task role. Do not configure static access keys in `.env`.
- **Failure behavior:** Production mode never falls back to the deterministic runner. Failed or
  incomplete Strands passes return an error and roll back partial in-memory changes.

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

For a live Bedrock verification before deployment, run the exact command documented in
`apps/agent/README.md` under **Live Amazon Bedrock smoke test**.
