# Antigravity handoff — CandidateLoop Round 2

## Completed work

- Audited the integrated Strands implementation and updated `.env.example` and `README.md` to reflect that the Strands Bedrock runtime is active and no longer a "later milestone."
- Validated that the best practical deployment path for the backend is standard AWS App Runner / ECS. AgentCore Runtime was considered but not chosen because the current implementation tightly couples the FastAPI web layer and the agent loop state within `InMemoryRepository`. A unified container deployment preserves this architecture while remaining simple and robust.
- Updated `docs/deployment.md` to explain the selected deployment path and detailed the required AWS access configuration (IAM Task Role with `bedrock:InvokeModel`).
- Fixed the backend `Dockerfile` ordering issue where `pip install` executed before the source code was copied, causing `hatchling` to fail when building the package wheel.
- Added a `docker build` check to `scripts/smoke_test.sh` to ensure container packaging is verified during the build harness.
- Ensured frontend deployment target is appropriately documented as Cloudflare Pages/Workers given its Vinext architecture.

## Deployment Status
**Not Deployed**

## Exact AWS Blockers
The project is ready for deployment, but requires AWS account access and permissions that are currently unavailable (and must not be committed to the repository). Specifically:
- Creating an AWS App Runner service or ECS Cluster.
- An IAM Task Role must be created with `bedrock:InvokeModel` permissions and assigned to the App Runner service.
- The Bedrock model (`anthropic.claude-3-haiku-20240307-v1:0`) must be granted access in the chosen AWS region.
- The backend container must be built and pushed to an Amazon ECR registry.
- The Vinext frontend must be deployed via Cloudflare or adapted to a Node-compatible static host.

## Next Human Actions
1. **Cloud Setup:** Provision the AWS App Runner environment and ECR registry.
2. **Push Image:** Build the docker image locally and push it to your ECR registry.
3. **Deploy Backend:** Deploy the container in App Runner using the IAM Task Role to allow Bedrock access.
4. **Deploy Frontend:** Set the `NEXT_PUBLIC_API_URL` to the App Runner URL and deploy the frontend.

## Files changed
- `.env.example`
- `README.md`
- `apps/agent/Dockerfile`
- `docs/deployment.md`
- `scripts/smoke_test.sh`
- `handoffs/antigravity-round2.md`
