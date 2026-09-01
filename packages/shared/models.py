import datetime
from typing import List, Dict, Any
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    Text,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Source(Base):
    __tablename__ = "sources"

    id = Column(String, primary_key=True)  # Unique source ID (e.g. 'ebay', 'amazon', 'local_dealer_1')
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # 'marketplace', 'local_dealer', 'b2b', etc.
    domain = Column(String, nullable=True)
    access_method = Column(String, nullable=True)  # 'api', 'scrape', 'feed'
    status = Column(String, default="active")  # 'active', 'disabled'
    reliability_score = Column(Float, default=1.0)
    freshness_score = Column(Float, default=1.0)
    last_successful_fetch = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    offers = relationship("ProductOffer", back_populates="source")


class Seller(Base):
    __tablename__ = "sellers"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    seller_type = Column(String, nullable=False)  # 'dealer', 'manufacturer', 'distributor', 'marketplace_merchant'
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    review_count = Column(Integer, default=0)
    verification_status = Column(String, default="unverified")  # 'verified', 'unverified', 'claimed'
    source_id = Column(String, ForeignKey("sources.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    offers = relationship("ProductOffer", back_populates="seller")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True)  # Canonical product UUID or Hash
    title = Column(String, nullable=False, index=True)
    brand = Column(String, nullable=True, index=True)
    model = Column(String, nullable=True, index=True)
    category = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=True)
    images = Column(JSON, default=list)  # List of URLs
    price = Column(Float, nullable=True)  # Representative price (e.g. min of offers)
    currency = Column(String, nullable=True, default="USD")
    availability = Column(String, nullable=True, default="unknown")
    canonical_identifier = Column(String, unique=True, nullable=True, index=True)  # e.g., GTIN, MPN
    attributes = Column(JSON, default=dict)  # Dynamic normalized attributes: { "color": {"value": "Red", "unit": None, "source": "title", "confidence": 0.9} }
    metadata_json = Column(JSON, default=dict)  # Dynamic extra info
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    offers = relationship("ProductOffer", back_populates="product", cascade="all, delete-orphan")


class ProductOffer(Base):
    __tablename__ = "product_offers"

    id = Column(String, primary_key=True)  # Offer unique ID (source_id + raw_id hash)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False)
    source_id = Column(String, ForeignKey("sources.id"), nullable=False)
    platform = Column(String, nullable=False)  # 'ebay', 'local_site', etc.
    price = Column(Float, nullable=True)
    currency = Column(String, default="USD")
    availability = Column(String, default="unknown")  # 'in_stock', 'out_of_stock', 'on_request', etc.
    moq = Column(Integer, default=1)  # Minimum Order Quantity
    delivery = Column(JSON, default=dict)  # Delivery terms, cost, regions
    source_url = Column(Text, nullable=False)
    scraped_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_verified_at = Column(DateTime, default=datetime.datetime.utcnow)
    metadata_json = Column(JSON, default=dict)

    product = relationship("Product", back_populates="offers")
    seller = relationship("Seller", back_populates="offers")
    source = relationship("Source", back_populates="offers")

class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(String, primary_key=True)
    client_id = Column(String, nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    target_price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    product = relationship("Product")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    client_id = Column(String, primary_key=True)
    preferences_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String, primary_key=True)
    query = Column(String, nullable=False, index=True)
    location = Column(String, nullable=True)
    results_json = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)

