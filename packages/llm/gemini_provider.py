import json
import os
import httpx
from google import genai
from google.genai import types
from typing import Optional
from packages.llm.llm_service import BaseLLMProvider

class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def generate_text(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        # 1. Try Gemini first if client is configured
        if self.client:
            try:
                response = self.client.models.generate_content(
                    model='gemini-3.6-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                    )
                )
                return response.text
            except Exception as e:
                print(f"[Warning] Gemini API failed: {e}. Falling back to OpenRouter...")
                
        # 2. Try OpenRouter fallback
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        if openrouter_key and not openrouter_key.startswith("your_"):
            try:
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": "meta-llama/llama-3.1-8b-instruct",
                    "messages": []
                }
                if system_instruction:
                    payload["messages"].append({"role": "system", "content": system_instruction})
                payload["messages"].append({"role": "user", "content": prompt})
                
                response = httpx.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    json=payload,
                    headers=headers,
                    timeout=15.0
                )
                if response.status_code == 200:
                    res_data = response.json()
                    return res_data["choices"][0]["message"]["content"].strip()
                else:
                    print(f"[Warning] OpenRouter API returned {response.status_code}: {response.text}")
            except Exception as ex:
                print(f"[Warning] OpenRouter fallback failed: {ex}")
                
        # 3. Last resort offline fallback
        return json.dumps({
            "best_deal_summary": "Active deals are available on multiple platforms. Check the listings below.",
            "recommended_platform": "Direct",
            "active_offers": ["No active promotions detected."]
        })
