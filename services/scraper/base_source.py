import abc
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from packages.schemas.schemas import ProductSchema, ProductOfferSchema, SellerSchema

class BaseProductSource(abc.ABC):
    def __init__(self, source_id: str, name: str, source_type: str):
        self.source_id = source_id
        self.name = name
        self.source_type = source_type

    @abc.abstractmethod
    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search raw source data. Return list of unnormalized records."""
        pass

    @abc.abstractmethod
    def extract_product(self, raw_data: Dict[str, Any]) -> ProductSchema:
        """Parse raw record into structured dynamic ProductSchema."""
        pass

    @abc.abstractmethod
    def extract_offer(self, raw_data: Dict[str, Any], product_id: str, seller_id: str) -> ProductOfferSchema:
        """Extract pricing, freshness, MOQ, and platform parameters."""
        pass

    @abc.abstractmethod
    def extract_seller(self, raw_data: Dict[str, Any]) -> SellerSchema:
        """Extract vendor/dealer details including coordinates and status."""
        pass

    def validate_product(self, product: ProductSchema) -> bool:
        """Check dynamic validity constraints."""
        if not product.title or len(product.title.strip()) < 2:
            return False
        return True


class SourceRegistry:
    def __init__(self):
        self._sources: Dict[str, BaseProductSource] = {}

    def register(self, source: BaseProductSource) -> None:
        self._sources[source.source_id] = source

    def get_source(self, source_id: str) -> Optional[BaseProductSource]:
        return self._sources.get(source_id)

    def list_sources(self) -> List[BaseProductSource]:
        return list(self._sources.values())
