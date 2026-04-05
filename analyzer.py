import os
import sys
from google import genai
from google.genai import types

def analyze_log_stream(log_content: str, model_name: str = 'gemini-2.5-flash'):
    """Analyzes a build log using the Gemini API and yields chunks of the summary."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        yield "Error: GEMINI_API_KEY environment variable is not set."
        return

    try:
        client = genai.Client(api_key=api_key)
        
        max_chars = 500_000
        if len(log_content) > max_chars:
            yield f"> Warning: Log is very large, truncating to last {max_chars} characters.\n\n"
            log_content = "..." + log_content[-max_chars:]

        prompt = f"""
You are an expert DevOps AI Assistant. Your task is to analyze the following CI/CD build log and provide a helpful, concise summary of why the build failed and how to troubleshoot and fix it.

Please format your response in Markdown with the following sections:
## 🚨 Build Failure Summary
(A very concise 1-3 sentence explanation of the root cause)

## 🔍 Error Details
(Specific file, line number, or command that failed, if applicable)

## 💡 Suggested Fixes
(Actionable steps the developer should take to resolve this issue)

Here is the build log to analyze:
```
{log_content}
```
"""

        response = client.models.generate_content_stream(
            model=model_name,
            contents=prompt,
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        yield f"\n\nAn error occurred while analyzing the log with the LLM API: {e}"

def analyze_log_full(log_content: str, model_name: str = 'gemini-2.5-flash') -> str:
    """Analyzes a build log synchronously and returns the full markdown string."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "Error: GEMINI_API_KEY environment variable is not set."

    try:
        client = genai.Client(api_key=api_key)
        
        max_chars = 500_000
        if len(log_content) > max_chars:
            log_content = "..." + log_content[-max_chars:]

        prompt = f"""
You are an expert DevOps AI Assistant. Your task is to analyze the following CI/CD build log and provide a helpful, concise summary of why the build failed and how to troubleshoot and fix it.

Please format your response in Markdown with the following sections:
## 🚨 Build Failure Summary
(A very concise 1-3 sentence explanation of the root cause)

## 🔍 Error Details
(Specific file, line number, or command that failed, if applicable)

## 💡 Suggested Fixes
(Actionable steps the developer should take to resolve this issue)

Here is the build log to analyze:
```
{log_content}
```
"""
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"An error occurred while analyzing the log with the LLM API: {e}"

