import abc
import json
from typing import List, Dict, Any, Optional

class BaseLLMProvider(abc.ABC):
    @abc.abstractmethod
    def generate_text(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Sends a text request to the LLM and returns the response string."""
        pass


class LLMService:
    def __init__(self, provider: BaseLLMProvider):
        self.provider = provider

    def parse_query(self, query: str) -> Dict[str, Any]:
        """Parses raw user queries into semantic properties and structured concepts."""
        prompt = f"Parse the user product discovery query: '{query}' into JSON matching structured attributes."
        # Detailed structured prompting will follow in the prompt service implementation.
        raw_res = self.provider.generate_text(prompt, system_instruction="You are an expert NLP parser.")
        return {"raw_response": raw_res}

    def analyze_deals(self, query: str, products: List[Dict[str, Any]], external_offers: Optional[List[str]] = None) -> Dict[str, Any]:
        """Uses LLM to analyze search results, find the best deal and detect offers/coupons."""
        if not products:
            return {
                "best_deal_summary": "No product listings available for analysis.",
                "recommended_platform": "None",
                "active_offers": []
            }
            
        product_list_str = ""
        for i, p in enumerate(products):
            title = p.get("title", "")
            price = p.get("price")
            price_str = f"INR {price}" if price else "Contact Dealer"
            dealer = p.get("dealer_name", "")
            is_local = "Local Store" if p.get("is_local") else "Online Store"
            snippet = p.get("snippet", "")
            product_list_str += f"{i+1}. [{is_local}] {title} sold by {dealer} at {price_str}. Details: {snippet}\n"

        offers_str = ""
        if external_offers:
            offers_str = "\nLive Active Coupons Detected on Web:\n" + "\n".join([f"- {o}" for o in external_offers]) + "\n"

        prompt = f"""
        You are a smart shopping assistant. Analyze the following search results for the query '{query}':
        
        {product_list_str}
        {offers_str}
        
        Identify:
        1. Which platform (brand, e-commerce store) offers the absolute best deal or value for this product?
        2. Are there any active deals, discount offers, coupon codes, cashbacks, or auto-applied discounts mentioned in the listings/snippets?
        3. Explain your choice in a friendly, conversational manner.
        
        Respond ONLY with a valid JSON object matching this schema exactly. Do not wrap the JSON output in markdown formatting like ```json or similar code blocks. Return only the raw JSON string:
        {{
            "best_deal_summary": "Friendly conversational summary highlighting the best deal, active promotions/coupons and details.",
            "recommended_platform": "Name of the retailer/store (e.g. Myntra)",
            "active_offers": ["List of active offers, coupons, or free shipping found on different sites."]
        }}
        """
        
        try:
            raw_res = self.provider.generate_text(prompt, system_instruction="You are a professional shopping deal analyst tailored for the Indian market. Think like an Indian consumer (focus on value for money). Always use INR (₹) for currency. You must output raw JSON only.")
            text = raw_res.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                text = "\n".join(lines).strip()
            return json.loads(text)
        except Exception as e:
            print(f"[Warning] Failed parsing LLM deal analysis: {e}")
            best_p = products[0]
            price_val = f"INR {best_p.get('price')}" if best_p.get('price') else "Contact Dealer"
            return {
                "best_deal_summary": f"The best overall deal appears to be {best_p.get('title')} at {best_p.get('dealer_name')} for {price_val}.",
                "recommended_platform": best_p.get("dealer_name", "Direct"),
                "active_offers": ["Check site listing for current promotions."]
            }

    def compare_products(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compares product specifications and extracts tradeoffs."""
        if not products or len(products) < 2:
            return {
                "features_comparison": [],
                "pros_cons": {},
                "verdict": "Need at least two products to compare."
            }
            
        product_list_str = ""
        for i, p in enumerate(products):
            title = p.get("title", f"Product {i+1}")
            price = p.get("price", "N/A")
            desc = p.get("description", "N/A")
            product_list_str += f"--- Product {i+1} ---\nID: {p.get('id')}\nTitle: {title}\nPrice: {price}\nDescription: {desc}\n\n"
            
        prompt = f"""
        You are an expert product reviewer. Compare the following products and provide a structured analysis.
        
        {product_list_str}
        
        Output a valid JSON object matching this schema exactly. Return only raw JSON (no markdown formatting like ```json):
        {{
            "features_comparison": [
                {{"feature_name": "Price", "differences": "Product 1 is cheaper by ₹500, but Product 2..."}},
                {{"feature_name": "Performance", "differences": "..."}}
            ],
            "pros_cons": {{
                "<product_id_here>": {{"pros": ["pro1", "pro2"], "cons": ["con1", "con2"]}}
            }},
            "verdict": "Your final recommendation and summary of the comparison."
        }}
        """
        try:
            raw_res = self.provider.generate_text(prompt, system_instruction="You are an expert product reviewer tailored for the Indian market. Always use INR (₹) for currency and think from an Indian consumer's perspective. You must output raw JSON only.")
            text = raw_res.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                if lines[0].startswith("```"): lines = lines[1:]
                if lines[-1].strip() == "```": lines = lines[:-1]
                text = "\n".join(lines).strip()
            return json.loads(text)
        except Exception as e:
            print(f"[Warning] Failed parsing LLM comparison: {e}")
            return {
                "features_comparison": [],
                "pros_cons": {},
                "verdict": "Failed to generate smart comparison."
            }

    def explain_recommendation(self, products: List[Dict[str, Any]], query: str) -> str:
        """Generates natural language reviews explaining selected recommendations."""
        pass
