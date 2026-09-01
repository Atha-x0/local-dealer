import abc
from typing import List, Dict, Any, Optional

class VectorSearchService(abc.ABC):
    @abc.abstractmethod
    def index(self, product_id: str, text_to_embed: str, metadata: Dict[str, Any]) -> None:
        """Insert or update a product representation in the vector database."""
        pass

    @abc.abstractmethod
    def search(self, query_text: str, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Perform similarity search and return matching product candidates."""
        pass

    @abc.abstractmethod
    def delete(self, product_id: str) -> None:
        """Remove a product representation from the vector database."""
        pass

    @abc.abstractmethod
    def update(self, product_id: str, text_to_embed: str, metadata: Dict[str, Any]) -> None:
        """Update indexing properties."""
        pass
