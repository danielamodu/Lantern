# OpenCode System Controls & Constraints

## CRITICAL: Rate Limit Protocol (NVIDIA Free Tier)
- **API Environment:** You are running on the NVIDIA NIM API sandbox, which enforces a strict hard ceiling of **40 Requests Per Minute (RPM)**.
- **Goal:** Your primary non-functional requirement is to prevent HTTP 429 "Too Many Requests" errors by pacing your logic.

## Behavioral Adjustments
1. **Zero-Overhead Thinking:** Do not spin up multiple sub-agents or use the `@general` tool for multi-step breakdowns. Process files sequentially.
2. **Batching Requests:** If you need to read or check multiple files, combine your tool calls into a single response block instead of sending individual queries for each file.
3. **Minimize Chat Chatter:** Do not write introductory or concluding small talk (e.g., "Sure, I can help with that..."). Output your code modifications or terminal execution choices instantly to save tokens and request round-trips.
4. **Execution Cooldown:** If you are executing a dense terminal loop (e.g., running tests -> fixing -> rerunning), enforce a conscious 2-second pause in your thinking cycle between tool invocations.

## Strict Restrictions
- DO NOT invoke `task` or `spawn_agent` tools.
- DO NOT attempt parallel lookups across the codebase. Focus on one file path at a time.
