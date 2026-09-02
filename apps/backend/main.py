import os
import uuid
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from packages.shared.database import get_db, engine, SessionLocal
from packages.shared.models import Base, Product, ProductOffer, Seller, Source, PriceAlert, UserProfile, SearchHistory
from packages.schemas.schemas import SearchRequest, SearchResponseSchema, ProductSchema, ParsedQuerySchema, DealerRegistrationRequest, InventorySyncRequest, PriceAlertCreate, PriceAlertResponse, CompareRequest, CompareResponse, UserProfileUpdate, RecommendationResponse, SwarmRequest, SwarmResponse
from packages.agents.swarm import SearchAgent, AnalysisAgent, OrchestratorAgent
from services.scraper.real_web_source import RealWebDealerSource, INDIAN_CITIES_COORDS
from services.scraper.ondc_source import OndcDealerSource
from services.scraper.google_shopping_source import GoogleShoppingSource
from packages.llm.gemini_provider import GeminiProvider
from packages.llm.llm_service import LLMService
from packages.embeddings.chroma_service import ChromaDBService
from packages.ranking.ranking_service import ConfigurableRankingEngine

# Initialize database schemas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Open-World Product Discovery & Local Dealer API",
    description="Backend discovery system integrating dynamic attributes search and local dealer mapping.",
    version="1.0.0"
)

# CORS Setup
origins = [
    "http://localhost:3000",
    "http://localhost:8000"
]
if os.getenv("FRONTEND_URL"):
    origins.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
llm_service = LLMService(GeminiProvider())
chroma_dir = os.getenv("CHROMADB_PERSIST_DIR", "./data/chroma")
vector_store = ChromaDBService(persist_directory=chroma_dir)
ranking_engine = ConfigurableRankingEngine()

# Initialize Real Web Ingestion Parser
real_dealer_source = RealWebDealerSource()
ondc_dealer_source = OndcDealerSource()
google_shopping_source = GoogleShoppingSource()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "discovery-backend",
        "database": "connected"
    }


@app.get("/api/search/history")
def get_search_history(db: Session = Depends(get_db)):
    history = db.query(SearchHistory).order_by(SearchHistory.timestamp.desc()).limit(10).all()
    return {"history": [{"id": h.id, "query": h.query, "location": h.location, "timestamp": h.timestamp} for h in history]}

@app.delete("/api/search/history/{history_id}")
def delete_search_history(history_id: str, db: Session = Depends(get_db)):
    history_item = db.query(SearchHistory).filter(SearchHistory.id == history_id).first()
    if not history_item:
        raise HTTPException(status_code=404, detail="History not found")
    db.delete(history_item)
    db.commit()
    return {"status": "success"}

@app.get("/api/search/cached")
def get_cached_search(q: str, loc: str = "", db: Session = Depends(get_db)):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
        
    query = db.query(SearchHistory).filter(SearchHistory.query == q)
    if loc:
        query = query.filter(SearchHistory.location == loc)
        
    cached = query.order_by(SearchHistory.timestamp.desc()).first()
    if not cached:
        raise HTTPException(status_code=404, detail="No cached results found")
        
    return cached.results_json

@app.post("/api/search", response_model=SearchResponseSchema)
def search_products(payload: SearchRequest, db: Session = Depends(get_db)):
    """Orchestrates query parsing, genuine web search extraction, database sync, and ranking."""
    # 1. LLM Query Parsing
    parsed_json = llm_service.parse_query(payload.query)
    
    parsed_query = ParsedQuerySchema(
        intent="LOCAL_DEALER",
        product_concept=payload.query,
        requirements=[{"attribute": "condition", "value": "New", "importance": "preferred"}],
        constraints=[],
        preferences=[],
        location=payload.location
    )

    # 2. Extract genuine web results
    raw_results_web = real_dealer_source.search(payload.query, location=payload.location)
    raw_results_ondc = [] # Disabled per user request
    raw_results_gshop = google_shopping_source.search(payload.query, location=payload.location)

    candidates: List[ProductSchema] = []

    for source_obj, raw_results in [
        (real_dealer_source, raw_results_web), (google_shopping_source, raw_results_gshop)
    ]:
        for raw in raw_results:
            prod_schema = source_obj.extract_product(raw)
            seller_schema = source_obj.extract_seller(raw)
            offer_schema = source_obj.extract_offer(raw, prod_schema.id, seller_schema.id)
    
            if not source_obj.validate_product(prod_schema):
                continue
    
            # Save to database
            db_source = db.query(Source).filter(Source.id == source_obj.source_id).first()
            if not db_source:
                db_source = Source(
                    id=source_obj.source_id,
                    name=source_obj.name,
                    source_type=source_obj.source_type
                )
                db.add(db_source)
    
            db_seller = db.query(Seller).filter(Seller.id == seller_schema.id).first()
            if not db_seller:
                db_seller = Seller(
                    id=seller_schema.id,
                    name=seller_schema.name,
                    seller_type=seller_schema.seller_type,
                    address=seller_schema.address,
                    phone=seller_schema.phone,
                    latitude=seller_schema.latitude,
                    longitude=seller_schema.longitude,
                    verification_status=seller_schema.verification_status
                )
                db.add(db_seller)
    
            db_product = db.query(Product).filter(Product.id == prod_schema.id).first()
            if not db_product:
                db_product = Product(
                    id=prod_schema.id,
                    title=prod_schema.title,
                    brand=prod_schema.brand,
                    model=prod_schema.model,
                    category=prod_schema.category,
                    description=prod_schema.description,
                    price=prod_schema.price,
                    currency=prod_schema.currency,
                    availability=prod_schema.availability
                )
                db.add(db_product)
    
            # Save Offer
            db_offer = db.query(ProductOffer).filter(ProductOffer.id == offer_schema.id).first()
            if not db_offer:
                db_offer = ProductOffer(
                    id=offer_schema.id,
                    product_id=prod_schema.id,
                    seller_id=seller_schema.id,
                    source_id=source_obj.source_id,
                    platform=offer_schema.platform,
                    price=offer_schema.price,
                    currency=offer_schema.currency,
                    availability=offer_schema.availability,
                    source_url=offer_schema.source_url
                )
                db.add(db_offer)
                
            db.commit()
            
            # Vector indexing
            text_content = f"{prod_schema.title} {prod_schema.brand} {prod_schema.description}"
            vector_store.index(prod_schema.id, text_content, {"title": prod_schema.title})
            
            prod_schema.metadata_json["seller_lat"] = seller_schema.latitude
            prod_schema.metadata_json["seller_lng"] = seller_schema.longitude
            candidates.append(prod_schema)

    # 3. Geo Proximity check if requested
    user_coords = None
    if payload.location:
        loc_clean = payload.location.lower().strip()
        user_coords = {"lat": 20.5937, "lng": 78.9629} # fallback
        for city_key, details in INDIAN_CITIES_COORDS.items():
            if city_key in loc_clean:
                user_coords = {"lat": details["lat"], "lng": details["lng"]}
                break

    # 4. Rank Candidates
    ranked_results = ranking_engine.rank_products(candidates, parsed_query, user_coords)

    # Scrape live active coupons for detected online platforms and brands
    unique_platforms = list(set([p.metadata_json.get("seller_name") for p in ranked_results if not p.metadata_json.get("is_local") and p.metadata_json.get("seller_name")]))
    unique_brands = list(set([p.brand for p in ranked_results if p.brand]))
    active_coupons = real_dealer_source.scrape_active_coupons(unique_platforms, unique_brands)

    # 5. Extract deal analysis using the smart LLM Service
    deal_analysis = llm_service.analyze_deals(
        query=payload.query, 
        products=[p.model_dump() for p in ranked_results],
        external_offers=active_coupons
    )

    best_overall = ranked_results[0] if len(ranked_results) > 0 else None
    best_local = next((p for p in ranked_results if p.metadata_json.get("seller_lat") is not None), None)

    search_res = SearchResponseSchema(
        query=payload.query,
        parsed_query=parsed_query,
        results=ranked_results,
        recommendations={
            "best_overall": best_overall,
            "best_value": best_overall,
            "best_budget": best_overall,
            "best_local": best_local
        },
        sources=[real_dealer_source.name],
        deal_analysis=deal_analysis,
        search_metadata={
            "sources_checked": [real_dealer_source.source_id],
            "retrieval_count": len(ranked_results),
            "duration_ms": 95
        }
    )

    # Save to SearchHistory
    history_id = f"hist_{uuid.uuid4().hex[:8]}"
    db_history = SearchHistory(
        id=history_id,
        query=payload.query,
        location=payload.location,
        results_json=search_res.model_dump()
    )
    db.add(db_history)
    db.commit()
    
    return search_res

@app.post("/api/alerts", response_model=PriceAlertResponse)
def create_price_alert(payload: PriceAlertCreate, db: Session = Depends(get_db)):
    alert_id = f"alt_{uuid.uuid4().hex[:8]}"
    db_alert = PriceAlert(
        id=alert_id,
        client_id=payload.client_id,
        product_id=payload.product_id,
        target_price=payload.target_price
    )
    db.add(db_alert)
    db.commit()
    return db_alert

@app.post("/api/compare", response_model=CompareResponse)
def compare_products(payload: CompareRequest, db: Session = Depends(get_db)):
    if len(payload.product_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two products required for comparison.")
    
    products_db = db.query(Product).filter(Product.id.in_(payload.product_ids)).all()
    if len(products_db) != len(payload.product_ids):
        raise HTTPException(status_code=404, detail="One or more products not found.")
        
    product_dicts = []
    schemas_list = []
    for prod in products_db:
        # Reconstruct into ProductSchema form
        ps = ProductSchema.model_validate(prod)
        schemas_list.append(ps)
        product_dicts.append({
            "id": prod.id,
            "title": prod.title,
            "brand": prod.brand,
            "description": prod.description,
            "price": prod.price,
            "category": prod.category,
            "attributes": prod.attributes,
        })
        
    analysis = llm_service.compare_products(product_dicts)
    
    return CompareResponse(
        products=schemas_list,
        analysis=analysis
    )

@app.post("/api/dealers/register")
def register_dealer(payload: DealerRegistrationRequest, db: Session = Depends(get_db)):
    """Registers a local dealer and their initial inventory."""
    # Create seller
    seller_id = f"local_dealer_{uuid.uuid4().hex[:8]}"
    db_seller = Seller(
        id=seller_id,
        name=payload.store_name,
        seller_type="local_dealer",
        address=payload.address,
        city=payload.city,
        latitude=payload.latitude,
        longitude=payload.longitude,
        phone=payload.phone,
        verification_status="verified" # Trust for now
    )
    db.add(db_seller)
    
    # Create initial product if provided
    if payload.initial_product:
        prod_id = f"prod_{uuid.uuid4().hex[:12]}"
        db_prod = Product(
            id=prod_id,
            title=payload.initial_product.title,
            brand=payload.initial_product.brand,
            description=payload.initial_product.description,
            price=payload.initial_product.price
        )
        db.add(db_prod)
        
        source_id = "local_network"
        db_source = db.query(Source).filter(Source.id == source_id).first()
        if not db_source:
            db_source = Source(id=source_id, name="Local Dealer Network", source_type="local_dealer")
            db.add(db_source)
            
        offer_id = f"off_{uuid.uuid4().hex[:8]}"
        db_offer = ProductOffer(
            id=offer_id,
            product_id=prod_id,
            seller_id=seller_id,
            source_id=source_id,
            platform="Local Shop",
            price=payload.initial_product.price,
            source_url="local"
        )
        db.add(db_offer)
        
        # Index in ChromaDB
        text_content = f"{payload.initial_product.title} {payload.initial_product.brand or ''} {payload.initial_product.description or ''}"
        vector_store.index(prod_id, text_content, {"title": payload.initial_product.title})
        
    db.commit()
    return {"status": "success", "seller_id": seller_id, "message": "Dealer registered successfully"}

@app.post("/api/dealers/{seller_id}/sync-inventory")
def sync_inventory(seller_id: str, payload: InventorySyncRequest, db: Session = Depends(get_db)):
    """Webhook receiver for Shopify/WooCommerce inventory sync."""
    # Verify seller exists
    db_seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not db_seller:
        raise HTTPException(status_code=404, detail="Seller not found")
        
    source_id = "ecommerce_sync"
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        db_source = Source(id=source_id, name="E-Commerce Webhook Sync", source_type="ecommerce_plugin")
        db.add(db_source)
        db.commit()

    synced_count = 0
    for product in payload.products:
        # Create or Update Product
        db_prod = db.query(Product).filter(Product.id == product.id).first()
        if not db_prod:
            db_prod = Product(
                id=product.id,
                title=product.title,
                brand=product.brand,
                description=product.description,
                price=product.price
            )
            db.add(db_prod)
        else:
            db_prod.title = product.title
            db_prod.price = product.price
            db_prod.description = product.description
            
        # Create or Update Offer
        offer_id = f"off_{product.id}_{seller_id}"
        db_offer = db.query(ProductOffer).filter(ProductOffer.id == offer_id).first()
        if not db_offer:
            db_offer = ProductOffer(
                id=offer_id,
                product_id=product.id,
                seller_id=seller_id,
                source_id=source_id,
                platform="Dealer Website",
                price=product.price,
                source_url="plugin_sync",
                availability="in_stock" if product.in_stock else "out_of_stock"
            )
            db.add(db_offer)
        else:
            db_offer.price = product.price
            db_offer.availability = "in_stock" if product.in_stock else "out_of_stock"
            
        # Push immediately to vector db so it becomes instantly searchable
        if product.in_stock:
            text_content = f"{product.title} {product.brand or ''} {product.description or ''}"
            vector_store.index(product.id, text_content, {"title": product.title})
            
        synced_count += 1
        
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully synced {synced_count} products for {db_seller.name}"
    }
@app.post("/api/profile/preferences")
def update_user_preferences(payload: UserProfileUpdate, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.client_id == payload.client_id).first()
    if not profile:
        profile = UserProfile(client_id=payload.client_id, preferences_text=payload.preferences_text)
        db.add(profile)
    else:
        profile.preferences_text = payload.preferences_text
    db.commit()
    return {"status": "success", "message": "Preferences updated."}

@app.get("/api/recommendations/{client_id}", response_model=RecommendationResponse)
def get_recommendations(client_id: str, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.client_id == client_id).first()
    if not profile or not profile.preferences_text:
        return RecommendationResponse(recommendations=[])

    # Search vector store using preferences
    results = vector_store.search(profile.preferences_text, limit=5)
    if not results:
        return RecommendationResponse(recommendations=[])
        
    recommended_ids = [res["id"] for res in results]
    products_db = db.query(Product).filter(Product.id.in_(recommended_ids)).all()
    
    schemas_list = []
    for prod in products_db:
        schemas_list.append(ProductSchema.model_validate(prod))
        
    return RecommendationResponse(recommendations=schemas_list)

@app.post("/api/swarm/ask", response_model=SwarmResponse)
def ask_swarm(payload: SwarmRequest, db: Session = Depends(get_db)):
    # Instantiate agents per request because db session is per request
    search_agent = SearchAgent(vector_store=vector_store, db=db)
    analysis_agent = AnalysisAgent(llm_service=llm_service)
    orchestrator = OrchestratorAgent(llm_service=llm_service, search_agent=search_agent, analysis_agent=analysis_agent)
    
    result = orchestrator.execute_swarm(payload.query)
    return SwarmResponse(**result)

