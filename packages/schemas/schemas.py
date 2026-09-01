from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional
from datetime import datetime

class DynamicAttribute(BaseModel):
    value: Any
    unit: Optional[str] = None
    source: Optional[str] = None
    confidence: float = 1.0


class SourceSchema(BaseModel):
    id: str
    name: str
    source_type: str
    domain: Optional[str] = None
    access_method: Optional[str] = None
    status: str = "active"
    reliability_score: float = 1.0
    freshness_score: float = 1.0

    class Config:
        from_attributes = True


class SellerSchema(BaseModel):
    id: str
    name: str
    seller_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0
    verification_status: str = "unverified"

    class Config:
        from_attributes = True


class ProductOfferSchema(BaseModel):
    id: str
    product_id: str
    seller_id: str
    source_id: str
    platform: str
    price: Optional[float] = None
    currency: str = "USD"
    availability: str = "unknown"
    moq: int = 1
    delivery: Dict[str, Any] = {}
    source_url: str
    scraped_at: datetime
    last_verified_at: datetime

    class Config:
        from_attributes = True


class ProductSchema(BaseModel):
    id: str
    title: str
    brand: Optional[str] = None
    model: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    price: Optional[float] = None
    currency: Optional[str] = "USD"
    availability: Optional[str] = "unknown"
    canonical_identifier: Optional[str] = None
    attributes: Dict[str, DynamicAttribute] = {}
    metadata_json: Dict[str, Any] = {}

    class Config:
        from_attributes = True


# API Contract schemas
class Requirement(BaseModel):
    attribute: str
    value: Any
    importance: str = "required"  # "required" or "preferred"


class ParsedQuerySchema(BaseModel):
    intent: str
    product_concept: str
    requirements: List[Requirement] = []
    constraints: List[Dict[str, Any]] = []
    preferences: List[Dict[str, Any]] = []
    quantity: Optional[int] = None
    location: Optional[str] = None
    radius: Optional[float] = None


class SearchRequest(BaseModel):
    query: str
    location: Optional[str] = None
    radius: Optional[float] = None
    mode: str = "Best Match"


class SearchResponseSchema(BaseModel):
    query: str
    parsed_query: ParsedQuerySchema
    results: List[ProductSchema] = []
    recommendations: Dict[str, Optional[ProductSchema]] = {
        "best_overall": None,
        "best_value": None,
        "best_budget": None,
        "best_local": None
    }
    sources: List[str] = []
    deal_analysis: Optional[Dict[str, Any]] = None
    search_metadata: Dict[str, Any] = {}

class InitialProductListing(BaseModel):
    title: str
    brand: Optional[str] = None
    price: float
    description: Optional[str] = None

class DealerRegistrationRequest(BaseModel):
    store_name: str
    phone: str
    address: str
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    initial_product: Optional[InitialProductListing] = None

class WebhookProductListing(BaseModel):
    id: str
    title: str
    brand: Optional[str] = None
    price: float
    description: Optional[str] = None
    in_stock: bool = True

class InventorySyncRequest(BaseModel):
    products: List[WebhookProductListing]

class PriceAlertCreate(BaseModel):
    client_id: str
    product_id: str
    target_price: float

class PriceAlertResponse(BaseModel):
    id: str
    client_id: str
    product_id: str
    target_price: float
    is_active: bool

    class Config:
        from_attributes = True

class CompareRequest(BaseModel):
    product_ids: List[str]

class CompareResponse(BaseModel):
    products: List[ProductSchema]
    analysis: Dict[str, Any]

class UserProfileUpdate(BaseModel):
    client_id: str
    preferences_text: str

class RecommendationResponse(BaseModel):
    recommendations: List[ProductSchema]

class SwarmRequest(BaseModel):
    query: str

class SwarmStep(BaseModel):
    agent: str
    action: str
    details: str

class SwarmResponse(BaseModel):
    query: str
    steps: List[SwarmStep]
    final_answer: str
    products: List[Dict[str, Any]]



