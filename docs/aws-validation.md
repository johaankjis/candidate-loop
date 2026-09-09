# CandidateLoop AWS Validation

## Status

CandidateLoop has been successfully validated running as a containerized backend on AWS ECS Fargate.

The remaining cloud blocker is live Amazon Bedrock inference, which is currently under AWS Support review at the account level.

## Validated infrastructure

- Amazon ECR repository for the CandidateLoop agent image
- ECS cluster: `candidateloop-cluster`
- ECS Fargate task definition: `candidateloop-agent`
- Linux ARM64 runtime
- CloudWatch logging
- Public FastAPI endpoint
- Deterministic CandidateLoop runtime

## Container validation

The `round2-integrated` and `latest` image tags were successfully pushed to ECR.

Validated image digest:

`sha256:7a144eb473befb3686bface597f1d74b53a8d98477918a7e283cca23168884c6`

The Docker image passed the repository smoke test before deployment.

## AWS workflow validation

### Run 1

CandidateLoop processed all four active candidates.

- Sarah Chen → feedback reminder sent
- David Park → neutral candidate status update sent
- Emily Jones → human decision request created
- Marcus Reed → no action required

Summary:

- candidates scanned: 4
- actions taken: 3
- reminders sent: 1
- candidate updates sent: 1
- human decisions created: 1
- interviews scheduled: 0
- no action needed: 1

CandidateLoop did not make a hiring disposition for Emily.

### Human decision

A recruiter explicitly resolved Emily's pending decision as:

`ADVANCE`

Emily moved to `Panel Scheduling`.

### Run 2

CandidateLoop responded to the human decision by scheduling Emily's panel interview.

Summary:

- candidates scanned: 4
- actions taken: 1
- interviews scheduled: 1
- no action needed: 3

The scheduling action occurred only after explicit recruiter authorization.

### Run 3

CandidateLoop performed a fully idempotent pass.

Summary:

- candidates scanned: 4
- actions taken: 0
- reminders sent: 0
- candidate updates sent: 0
- human decisions created: 0
- interviews scheduled: 0
- no action needed: 4

This validated duplicate prevention for reminders, candidate communications, human decisions, and interview scheduling.

## Safety boundary validated

CandidateLoop autonomously coordinates recruiting operations but does not:

- advance candidates
- hold candidates
- reject candidates
- hire candidates
- rank candidates
- score candidates

Hiring judgment remains behind the recruiter-facing human decision API.

## Remaining validation

Live Strands + Amazon Bedrock execution remains pending because Bedrock Runtime returns account-level Error 002.

AWS authentication, model discovery, inference-profile discovery, Docker packaging, ECR, ECS Fargate, networking, API execution, human decision boundaries, scheduling, and idempotency have all been validated independently of that issue.

Once Bedrock access is restored:

1. Run the direct Bedrock Converse test.
2. Run `apps/agent/scripts/bedrock_smoke.py`.
3. Create the application task IAM role with Bedrock invocation permissions.
4. Register a new ECS task-definition revision using `strands` execution mode.
5. Validate the same three-run workflow using the real model-driven agent.
