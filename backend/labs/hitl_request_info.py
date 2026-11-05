from __future__ import annotations

import asyncio
from dataclasses import dataclass

from agent_framework import (
    Executor,
    WorkflowBuilder,
    WorkflowContext,
    handler,
    response_handler,
)


@dataclass
class NumberSignal:
    hint: str


class JudgeExecutor(Executor):
    def __init__(self, target_number: int) -> None:
        super().__init__(id="judge")
        self._target_number = target_number
        self._tries = 0

    @handler
    async def handle_guess(
        self,
        guess: int,
        ctx: WorkflowContext[int, str],
    ) -> None:
        self._tries += 1
        if guess == self._target_number:
            await ctx.yield_output(
                f"{self._target_number} found in {self._tries} tries"
            )
        elif guess < self._target_number:
            await ctx.request_info(
                request_data=NumberSignal(hint="higher"),
                response_type=int,
            )
        else:
            await ctx.request_info(
                request_data=NumberSignal(hint="lower"),
                response_type=int,
            )

    @response_handler
    async def on_human_response(
        self,
        original_request: NumberSignal,
        response: int,
        ctx: WorkflowContext[int, str],
    ) -> None:
        print(f"The workflow requested a {original_request.hint} guess")
        await self.handle_guess(response, ctx)


async def main() -> None:
    workflow = WorkflowBuilder(start_executor=JudgeExecutor(target_number=42)).build()
    first_run = await workflow.run(25)
    requests = first_run.get_request_info_events()
    print(f"Request: {requests}")
    if not requests:
        raise RuntimeError("Expected the workflow to request information")
    responses = {requests[0].request_id: 42}
    print(f"Responses: {responses}")
    final_run = await workflow.run(responses=responses)
    print(final_run.get_outputs())


if __name__ == "__main__":
    asyncio.run(main())