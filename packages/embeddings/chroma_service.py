import os
from typing import List, Dict, Any, Optional
import chromadb
from packages.embeddings.vector_service import VectorSearchService

class ChromaDBService(VectorSearchService):
    def __init__(self, persist_directory: Optional[str] = None):
        if persist_directory:
            self.client = chromadb.PersistentClient(path=persist_directory)
        else:
            self.client = chromadb.EphemeralClient()
        
        self.collection = self.client.get_or_create_collection(
            name="products_collection",
            metadata={"hnsw:space": "cosine"}
        )

    def index(self, product_id: str, text_to_embed: str, metadata: Dict[str, Any]) -> None:
        self.collection.add(
            documents=[text_to_embed],
            metadatas=[metadata],
            ids=[product_id]
        )

    def search(self, query_text: str, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        # Map simple equality filters to chroma formatting if needed
        where_clause = None
        if filters:
            # chroma expects format {"metadata_field": "value"} or dynamic operators
            where_clause = filters

        results = self.collection.query(
            query_texts=[query_text],
            n_results=limit,
            where=where_clause
        )
        
        output = []
        if results and results["ids"] and len(results["ids"][0]) > 0:
            for idx in range(len(results["ids"][0])):
                output.append({
                    "id": results["ids"][0][idx],
                    "document": results["documents"][0][idx],
                    "metadata": results["metadatas"][0][idx],
                    "distance": results["distances"][0][idx] if results["distances"] else None
                })
        return output

    def delete(self, product_id: str) -> None:
        self.collection.delete(ids=[product_id])

    def update(self, product_id: str, text_to_embed: str, metadata: Dict[str, Any]) -> None:
        self.collection.update(
            ids=[product_id],
            documents=[text_to_embed],
            metadatas=[metadata]
        )

