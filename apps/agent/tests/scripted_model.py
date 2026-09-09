import json
from collections.abc import AsyncGenerator, Iterable, Sequence
from typing import Any

from strands.models import Model


def tool_call(tool_use_id: str, name: str, tool_input: dict[str, Any] | None = None):
    return {
        "role": "assistant",
        "content": [
            {
                "toolUse": {
                    "toolUseId": tool_use_id,
                    "name": name,
                    "input": tool_input or {},
                }
            }
        ],
    }


def parallel_tool_calls(*calls: tuple[str, str, dict[str, Any]]):
    return {
        "role": "assistant",
        "content": [
            {
                "toolUse": {
                    "toolUseId": tool_use_id,
                    "name": name,
                    "input": tool_input,
                }
            }
            for tool_use_id, name, tool_input in calls
        ],
    }


def final_response(text: str = "Operational pass complete."):
    return {"role": "assistant", "content": [{"text": text}]}


class ScriptedModel(Model):
    """A no-network Strands model that emits deterministic tool-use messages."""

    def __init__(self, responses: Sequence[dict[str, Any]]) -> None:
        self.responses = list(responses)
        self.index = 0
        self.tool_specs_history: list[list[dict[str, Any]]] = []
        self.system_prompts: list[str | None] = []

    def get_config(self) -> dict[str, str]:
        return {"model_id": "scripted-test-model"}

    def update_config(self, **model_config: Any) -> None:
        return None

    async def structured_output(
        self,
        output_model,
        prompt,
        system_prompt=None,
        **kwargs: Any,
    ) -> AsyncGenerator[dict[str, Any], None]:
        if False:
            yield {}

    async def stream(
        self,
        messages,
        tool_specs=None,
        system_prompt=None,
        **kwargs: Any,
    ) -> AsyncGenerator[dict[str, Any], None]:
        self.tool_specs_history.append(list(tool_specs or []))
        self.system_prompts.append(system_prompt)
        response = self.responses[self.index]
        self.index += 1
        for event in self._events(response):
            yield event

    @staticmethod
    def _events(response: dict[str, Any]) -> Iterable[dict[str, Any]]:
        stop_reason = "end_turn"
        yield {"messageStart": {"role": "assistant"}}
        for content in response["content"]:
            if "text" in content:
                yield {"contentBlockStart": {"start": {}}}
                yield {"contentBlockDelta": {"delta": {"text": content["text"]}}}
                yield {"contentBlockStop": {}}
            if "toolUse" in content:
                stop_reason = "tool_use"
                tool_use = content["toolUse"]
                yield {
                    "contentBlockStart": {
                        "start": {
                            "toolUse": {
                                "name": tool_use["name"],
                                "toolUseId": tool_use["toolUseId"],
                            }
                        }
                    }
                }
                yield {
                    "contentBlockDelta": {
                        "delta": {"toolUse": {"input": json.dumps(tool_use["input"])}}
                    }
                }
                yield {"contentBlockStop": {}}
        yield {"messageStop": {"stopReason": stop_reason}}
