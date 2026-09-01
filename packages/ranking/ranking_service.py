import math
from typing import List, Dict, Any, Optional
from packages.schemas.schemas import ProductSchema, ParsedQuerySchema

class ConfigurableRankingEngine:
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine formula to compute distance in miles."""
        R = 3958.8  # Radius of the Earth in miles
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def rank_products(self, products: List[ProductSchema], query_info: ParsedQuerySchema, user_coords: Optional[Dict[str, float]] = None) -> List[ProductSchema]:
        if not products:
            return []
            
        from packages.embeddings.chroma_service import ChromaDBService
        import uuid
        
        # Prepare for semantic search
        chroma = ChromaDBService()
        raw_query = query_info.product_concept.lower()
        
        # Build document strings and ids
        documents = []
        ids = []
        for i, prod in enumerate(products):
            prod_id = prod.raw_id if getattr(prod, 'raw_id', None) else str(uuid.uuid4())
            # Safely get snippet or description
            desc = getattr(prod, 'description', None)
            snippet = getattr(prod, 'snippet', None)
            text_desc = desc or snippet or ""
            text = f"{prod.title}. {text_desc} {prod.brand or ''}".strip()
            documents.append(text)
            ids.append(prod_id)
            if not hasattr(prod, 'metadata_json') or prod.metadata_json is None:
                prod.metadata_json = {}
            prod.metadata_json["_temp_id"] = prod_id

        # Get semantic similarity scores
        semantic_scores = chroma.rank_in_memory(raw_query, documents, ids)

        scored_products = []
        for prod in products:
            temp_id = prod.metadata_json.get("_temp_id")
            # Base semantic score mapped to 0-100 range
            base_score = semantic_scores.get(temp_id, 0.0) * 100.0
            score = base_score
            
            # Penalize completely unrelated results
            if base_score < 25.0:
                score -= 100.0
            elif base_score > 75.0:
                score += 30.0 # High relevance boost

            # 4. Attribute Match Penalization / Addition
            for req in query_info.requirements:
                attr_name = req.attribute.lower()
                if attr_name in prod.attributes:
                    prod_val = str(prod.attributes[attr_name].value).lower()
                    req_val = str(req.value).lower()
                    if req_val in prod_val or prod_val in req_val:
                        score += 5.0 if req.importance == "required" else 2.0
                    else:
                        if req.importance == "required":
                            score -= 10.0  # Hard requirements penalty

            # 5. Location Proximity Score Boost (only for local items)
            if user_coords and "lat" in user_coords and "lng" in user_coords:
                seller_lat = prod.metadata_json.get("seller_lat") or prod.metadata_json.get("lat")
                seller_lng = prod.metadata_json.get("seller_lng") or prod.metadata_json.get("lng")
                if seller_lat is not None and seller_lng is not None:
                    distance = self.calculate_distance(user_coords["lat"], user_coords["lng"], seller_lat, seller_lng)
                    prod.metadata_json["distance_miles"] = distance
                    # Proximity boost
                    if distance < 5:
                        score += 10.0  # Very close
                    elif distance < 15:
                        score += 5.0
                    elif distance < 50:
                        score += 2.0

            # Save computed score in temporary metadata
            prod.metadata_json["_calculated_score"] = score
            scored_products.append(prod)

        # Sort in descending order
        scored_products.sort(key=lambda x: x.metadata_json.get("_calculated_score", -9999.0), reverse=True)
        return scored_products
