# CandidateLoop agent service

CandidateLoop defaults to the deterministic local runner, which uses the same policy-enforced
recruiting operations as the Strands path and does not require AWS credentials.

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/uvicorn api.main:app --reload
```

To run the model-driven path through the real Strands Agents SDK and Amazon Bedrock, configure:

```bash
export CANDIDATELOOP_EXECUTION_MODE=strands
export CANDIDATELOOP_MODEL_PROVIDER=bedrock
export CANDIDATELOOP_MODEL_ID=us.amazon.nova-lite-v1:0
export AWS_REGION=us-east-1
```

Bedrock authentication uses boto3's standard AWS credential chain. No credential values belong in
the repository. The configured model must support tool use and be enabled for the selected AWS
account and region. CandidateLoop does not silently fall back to deterministic execution if a
Strands/Bedrock run fails; API results therefore never mislabel deterministic work as model-driven.

Run the local checks without making any model-provider calls:

```bash
.venv/bin/ruff format --check .
.venv/bin/ruff check .
.venv/bin/pytest -q
```
