import uuid
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
from services.scraper.base_source import BaseProductSource
from packages.schemas.schemas import ProductSchema, ProductOfferSchema, SellerSchema
from services.scraper.real_web_source import INDIAN_CITIES_COORDS
import urllib.parse
from datetime import datetime
import re

class GoogleShoppingSource(BaseProductSource):
    def __init__(self):
        super().__init__("google_shopping", "Google Shopping Local", "google_shopping")
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }

    def _parse_price(self, text: str) -> Optional[float]:
        """Helper to parse price in INR."""
        if not text: return None
        patterns = [
            r'(?:Rs\.?|₹)\s?([0-9,]+)',
            r'([0-9,]+)\s?(?:Rupees|INR|Rs)',
            r'Rs\s?([0-9,]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    price_str = match.group(1).replace(",", "")
                    val = float(price_str)
                    if 100 < val < 500000:
                        return val
                except ValueError:
                    continue
        return None

    def search(self, query: str, limit: int = 10, location: Optional[str] = None) -> List[Dict[str, Any]]:
        raw_results = []
        loc_str = f" near {location}" if location else " near me"
        search_query = urllib.parse.quote_plus(f"{query}{loc_str}")
        url = f"https://www.google.com/search?q={search_query}&tbm=shop"
        
        try:
            # We attempt to scrape Google Shopping. Warning: May get CAPTCHA'd without a proxy
            res = httpx.get(url, headers=self.headers, timeout=5.0)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, "html.parser")
                # Find product cards (class names often change, but we look for common structures)
                # Typically inside elements containing 'sh-dgr__content' or similar
                cards = soup.find_all("div", class_=lambda x: x and 'sh-dgr__content' in x)
                
                # If no cards found due to class name changes, we can try a more generic fallback
                if not cards:
                    cards = soup.find_all("div", class_=lambda x: x and 'sh-dlr__list-result' in x)
                    
                for card in cards[:limit]:
                    title_elem = card.find("h3")
                    title = title_elem.text if title_elem else f"Shopping Match: {query.title()}"
                    
                    price_elem = card.find("span", text=re.compile(r'₹|Rs'))
                    price_text = price_elem.text if price_elem else ""
                    price = self._parse_price(price_text) or 1999.0  # Fallback price
                    
                    # Try to extract the seller name
                    seller_elem = card.find("div", class_=lambda x: x and 'a-a-p' in x)
                    if not seller_elem:
                        seller_elem = card.find("a", class_=lambda x: x and 'hy22k' in x)
                    seller = seller_elem.text if seller_elem else "Google Shopping Retailer"
                    
                    # Mock finding an 'in store' badge
                    is_local = "in store" in str(card).lower() or "nearby" in str(card).lower()
                    
                    raw = {
                        "id": str(uuid.uuid4()),
                        "title": title,
                        "brand": query.split()[0].capitalize(),
                        "price": price,
                        "description": f"Found via Google Shopping from {seller}.",
                        "seller_name": seller,
                        "seller_address": f"Local Store ({location})",
                        "lat": 20.5937, "lng": 78.9629,
                        "is_shopping": True,
                        "is_local": True # Force to true for our use-case
                    }
                    
                    if location:
                        loc_clean = location.lower().strip()
                        for city, coords in INDIAN_CITIES_COORDS.items():
                            if city in loc_clean:
                                raw["lat"] = coords["lat"]
                                raw["lng"] = coords["lng"]
                                break
                                
                    raw_results.append(raw)
                    
        except Exception as e:
            print(f"[Warning] Failed to scrape Google Shopping: {e}")
            
        return raw_results

    def extract_product(self, raw_data: Dict[str, Any]) -> ProductSchema:
        return ProductSchema(
            id=raw_data["id"],
            title=raw_data["title"],
            brand=raw_data["brand"],
            description=raw_data["description"],
            price=raw_data["price"],
            currency="INR",
            availability="in_stock",
            metadata_json={"is_shopping": raw_data.get("is_shopping", False), "is_local": True}
        )

    def extract_seller(self, raw_data: Dict[str, Any]) -> SellerSchema:
        return SellerSchema(
            id=f"gshop_seller_{raw_data['id']}",
            name=raw_data["seller_name"],
            seller_type="google_shopping",
            address=raw_data["seller_address"],
            latitude=raw_data["lat"],
            longitude=raw_data["lng"],
            verification_status="shopping_listed"
        )

    def extract_offer(self, raw_data: Dict[str, Any], product_id: str, seller_id: str) -> ProductOfferSchema:
        return ProductOfferSchema(
            id=f"gshop_off_{raw_data['id']}",
            product_id=product_id,
            seller_id=seller_id,
            source_id=self.source_id,
            platform="Google Shopping",
            price=raw_data["price"],
            currency="INR",
            source_url="https://shopping.google.com",
            scraped_at=datetime.utcnow(),
            last_verified_at=datetime.utcnow()
        )
