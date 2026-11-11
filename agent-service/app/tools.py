from typing import Any, Literal
import re

from pydantic import BaseModel, ConfigDict, Field


BusinessToolName = Literal[
    "order_lookup",
    "order_status",
    "refund_status",
    "refund_precheck",
    "cancel_precheck",
    "product_info",
]


class ToolArguments(BaseModel):
    order_no: str | None = Field(default=None, pattern=r"(?i)^ORD\d{8,}$")
    product_id: int | None = Field(default=None, ge=1)


class ToolPlan(BaseModel):
    tool_name: BusinessToolName | None = None
    arguments: ToolArguments = Field(default_factory=ToolArguments)
    missing_fields: list[str] = Field(default_factory=list)


class AuthorizedBusinessToolResult(BaseModel):
    """Validated, read-only tool output produced by the authenticated Java backend."""

    model_config = ConfigDict(extra="allow")

    intent: str | None = None
    toolStatus: str = Field(default="missing_tool_result")
    facts: str = Field(default="", max_length=5000)
    customerReply: str | None = Field(default=None, max_length=3000)
    orderNo: str | None = None
    orderStatus: str | None = None
    refundStatus: str | None = None
    refundPrecheck: str | None = None
    cancelPrecheck: str | None = None


class ToolExecutionResult(BaseModel):
    tool_name: BusinessToolName
    status: Literal[
        "completed", "missing_tool_result", "resource_not_found", "authorization_denied",
        "business_rejected", "timeout", "rate_limited", "backend_unavailable"
    ]
    facts: str = ""
    customer_reply: str | None = None


_TOOL_BY_INTENT: dict[str, BusinessToolName] = {
    "order_lookup": "order_lookup",
    "order_status": "order_status",
    "delivery_status": "order_status",
    "refund_status": "refund_status",
    "refund_precheck": "refund_precheck",
    "refund": "refund_precheck",
    "order_cancel": "cancel_precheck",
    "cancel_order": "cancel_precheck",
    "product_info": "product_info",
    "product": "product_info",
}


def choose_business_tool(agent_intent: str | None, routed_intent: str) -> BusinessToolName | None:
    return _TOOL_BY_INTENT.get(agent_intent or "") or _TOOL_BY_INTENT.get(routed_intent)


def build_tool_plan(tool_name: BusinessToolName | None, message: str, missing_fields: list[str]) -> ToolPlan:
    match = re.search(r"(?i)ORD\d{8,}", message or "")
    return ToolPlan(
        tool_name=tool_name,
        arguments=ToolArguments(order_no=match.group(0).upper() if match else None),
        missing_fields=missing_fields,
    )


def consume_authorized_result(
    tool_name: BusinessToolName, raw_result: dict[str, Any] | None
) -> ToolExecutionResult:
    if not raw_result:
        return ToolExecutionResult(tool_name=tool_name, status="missing_tool_result")
    evidence = AuthorizedBusinessToolResult.model_validate(raw_result)
    status = {
        "completed": "completed",
        "order_not_found": "resource_not_found",
        "order_unavailable": "authorization_denied",
        "product_unavailable": "resource_not_found",
        "timeout": "timeout",
        "rate_limited": "rate_limited",
        "backend_unavailable": "backend_unavailable",
        "no_result": "missing_tool_result",
    }.get(evidence.toolStatus, "business_rejected")
    if status == "completed" and (
        evidence.refundPrecheck == "not_passed" or evidence.cancelPrecheck == "not_passed"
    ):
        status = "business_rejected"
    return ToolExecutionResult(
        tool_name=tool_name,
        status=status,
        facts=evidence.facts,
        customer_reply=evidence.customerReply,
    )
