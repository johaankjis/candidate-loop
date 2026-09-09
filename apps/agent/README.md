# CandidateLoop agent service

CandidateLoop defaults to the deterministic local runner, which uses the same policy-enforced
recruiting operations as the Strands path and does not require AWS credentials.

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/uvicorn api.main:app --reload
```

## Live Amazon Bedrock smoke test

The smoke test performs exactly one live model-driven pass through the real Strands agent and its
registered tools. It fails unless all four synthetic workflows are handled, the expected three
safe actions occur, Emily remains behind the human decision boundary, and Marcus receives no
write. From `apps/agent`, run:

```bash
export CANDIDATELOOP_EXECUTION_MODE=strands
export CANDIDATELOOP_MODEL_PROVIDER=bedrock
export CANDIDATELOOP_MODEL_ID=us.amazon.nova-lite-v1:0
export AWS_REGION=us-east-1
.venv/bin/python scripts/bedrock_smoke.py
```

Bedrock authentication uses boto3's standard AWS credential chain. No credential values belong in
the repository. In addition to the four variables above, provide credentials using one standard
mechanism such as `AWS_PROFILE`, an IAM role, or temporary `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` values. The configured model must support tool use,
be enabled for the selected AWS account and region, and allow `bedrock:InvokeModel` and
`bedrock:InvokeModelWithResponseStream`.

The command never substitutes deterministic execution. A Bedrock permission/model error or an
incomplete agent pass exits nonzero, and partial in-memory changes are rolled back. The API follows
the same behavior and reports a failed Strands pass as an error.

Run the local checks without making any model-provider calls:

```bash
.venv/bin/ruff format --check .
.venv/bin/ruff check .
.venv/bin/pytest -q
```
