import uuid
from datetime import datetime
from typing import List, Dict, Any
from services.scraper.base_source import BaseProductSource
from packages.schemas.schemas import ProductSchema, ProductOfferSchema, SellerSchema, DynamicAttribute

class MockLocalDealerSource(BaseProductSource):
    def __init__(self):
        super().__init__("mock_local_dealer", "Metro City Local Dealer", "local_dealer")

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        # Hardcoding currency to INR and converting/setting local Indian dealer context
        return [
            {
                "raw_id": "dealer-prod-200",
                "title": f"Local {query.capitalize()} Pro Edition",
                "brand": "LocalBrand",
                "model": "PE-01",
                "price": 24999.00, # Representing INR value
                "currency": "INR",
                "availability": "in_stock",
                "url": "https://metrodealer.mock/products/pe-01",
                "specs": {"Range": "50 miles", "Condition": "New"},
                "dealer_name": "Metro City Tech Store",
                "address": "456 Main St, Metro City",
                "phone": "+91-9876543210",
                "lat": 40.7128,
                "lng": -74.0060
            }
        ]

    def extract_product(self, raw_data: Dict[str, Any]) -> ProductSchema:
        prod_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, raw_data["raw_id"]))
        dynamic_attrs = {}
        for key, val in raw_data.get("specs", {}).items():
            dynamic_attrs[key.lower()] = DynamicAttribute(
                value=val,
                unit=None,
                source="specs",
                confidence=1.0
            )

        return ProductSchema(
            id=prod_id,
            title=raw_data["title"],
            brand=raw_data["brand"],
            model=raw_data["model"],
            category="Hardware",
            description="Direct from authorized merchant distributor.",
            images=["https://images.mock/local.jpg"],
            price=raw_data["price"],
            currency=raw_data["currency"],
            availability=raw_data["availability"],
            attributes=dynamic_attrs,
            metadata_json={}
        )

    def extract_offer(self, raw_data: Dict[str, Any], product_id: str, seller_id: str) -> ProductOfferSchema:
        offer_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{self.source_id}:{raw_data['raw_id']}"))
        return ProductOfferSchema(
            id=offer_id,
            product_id=product_id,
            seller_id=seller_id,
            source_id=self.source_id,
            platform=self.name,
            price=raw_data["price"],
            currency=raw_data["currency"],
            availability=raw_data["availability"],
            moq=1,
            delivery={"pickup": "Available in store", "delivery_cost": 500.0},
            source_url=raw_data["url"],
            scraped_at=datetime.utcnow(),
            last_verified_at=datetime.utcnow()
        )

    def extract_seller(self, raw_data: Dict[str, Any]) -> SellerSchema:
        seller_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, raw_data["dealer_name"]))
        return SellerSchema(
            id=seller_id,
            name=raw_data["dealer_name"],
            seller_type="dealer",
            address=raw_data["address"],
            phone=raw_data["phone"],
            latitude=raw_data["lat"],
            longitude=raw_data["lng"],
            verification_status="verified"
        )
