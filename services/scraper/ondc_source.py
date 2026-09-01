import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from services.scraper.base_source import BaseProductSource
from packages.schemas.schemas import ProductSchema, ProductOfferSchema, SellerSchema
from services.scraper.real_web_source import INDIAN_CITIES_COORDS

class OndcDealerSource(BaseProductSource):
    def __init__(self):
        super().__init__("ondc_network", "ONDC Verified Retail Network", "ondc_bap")

    def _generate_beckn_search_payload(self, query: str, location: Optional[str]) -> Dict[str, Any]:
        """Generates a Beckn compliant /search payload for BAP."""
        transaction_id = str(uuid.uuid4())
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        payload = {
            "context": {
                "domain": "ONDC:RET10",
                "country": "IND",
                "city": "std:080",
                "action": "search",
                "core_version": "1.2.0",
                "bap_id": "buyer-app.localdealer.in",
                "bap_uri": "https://buyer-app.localdealer.in/protocol/v1",
                "transaction_id": transaction_id,
                "message_id": message_id,
                "timestamp": timestamp,
                "ttl": "PT30S"
            },
            "message": {
                "intent": {
                    "item": {
                        "descriptor": {
                            "name": query
                        }
                    },
                    "fulfillment": {
                        "type": "Delivery"
                    }
                }
            }
        }
        
        # Add GPS if location provided
        if location:
            loc_clean = location.lower().strip()
            for city_key, details in INDIAN_CITIES_COORDS.items():
                if city_key in loc_clean:
                    payload["message"]["intent"]["fulfillment"]["end"] = {
                        "location": {
                            "gps": f"{details['lat']},{details['lng']}"
                        }
                    }
                    break
                    
        return payload

    def search(self, query: str, limit: int = 10, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """Performs a real ONDC network search with cryptographic signing (falling back if not whitelisted)."""
        payload = self._generate_beckn_search_payload(query, location)
        
        # In a real environment, read from environment variables (.env)
        # For development without real credentials, we generate a dummy keypair
        import os
        from packages.shared.ondc_crypto import create_authorization_header, generate_key_pair
        import httpx
        
        bap_id = os.getenv("ONDC_BAP_ID", "buyer-app.localdealer.in")
        unique_key_id = os.getenv("ONDC_KEY_ID", "key1")
        private_key = os.getenv("ONDC_PRIVATE_KEY")
        
        if not private_key:
            private_key, _ = generate_key_pair()
            
        auth_header = create_authorization_header(payload, bap_id, unique_key_id, private_key)
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": auth_header,
            "X-Gateway-Authorization": auth_header
        }
        
        # Try hitting the official staging gateway
        try:
            # We set a low timeout because if we are not whitelisted, the gateway might hang or drop
            response = httpx.post("https://staging.gateway.ondc.org/search", json=payload, headers=headers, timeout=2.0)
            response.raise_for_status()
            # If successful, in Beckn protocol, it responds with ACK and we must wait for /on_search webhook
            # For simplicity in this demo, we will log success and still return our mock results 
            # since a full webhook receiver is out of scope for a synchronous endpoint.
            print(f"ONDC Gateway acknowledged search: {response.status_code}")
        except Exception as e:
            print(f"ONDC Gateway request failed (likely need real whitelisted keys): {e}")

        # Fallback: Mock ONDC Verified network results since we don't have the async webhook listener running
        raw_results = []
        
        # Determine coordinates
        lat, lng = 20.5937, 78.9629 # default India center
        if location:
            loc_clean = location.lower().strip()
            for city, coords in INDIAN_CITIES_COORDS.items():
                if city in loc_clean:
                    lat, lng = coords["lat"], coords["lng"]
                    break
        
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
            metadata_json={"is_ondc": raw_data.get("is_ondc", False), "is_local": True}
        )

    def extract_seller(self, raw_data: Dict[str, Any]) -> SellerSchema:
        return SellerSchema(
            id=f"ondc_seller_{raw_data['id']}",
            name=raw_data["seller_name"],
            seller_type="ondc_merchant",
            address=raw_data["seller_address"],
            latitude=raw_data["lat"],
            longitude=raw_data["lng"],
            verification_status="ondc_verified"
        )

    def extract_offer(self, raw_data: Dict[str, Any], product_id: str, seller_id: str) -> ProductOfferSchema:
        return ProductOfferSchema(
            id=f"ondc_off_{raw_data['id']}",
            product_id=product_id,
            seller_id=seller_id,
            source_id=self.source_id,
            platform="ONDC Network",
            price=raw_data["price"],
            currency="INR",
            source_url="https://ondc.org",
            scraped_at=datetime.utcnow(),
            last_verified_at=datetime.utcnow()
        )
