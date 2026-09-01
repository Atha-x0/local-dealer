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

    def rank_in_memory(self, query: str, documents: List[str], ids: List[str]) -> Dict[str, float]:
        """Creates a temporary ephemeral collection to rank a batch of documents."""
        try:
            # Ephemeral client for on-the-fly ranking
            temp_client = chromadb.EphemeralClient()
            temp_collection = temp_client.create_collection(
                name="temp_ranking",
                metadata={"hnsw:space": "cosine"}
            )
            
            # Add documents
            temp_collection.add(
                documents=documents,
                ids=ids
            )
            
            # Query against them
            results = temp_collection.query(
                query_texts=[query],
                n_results=len(documents)
            )
            
            # Map ids to distances
            scores = {}
            if results and results["ids"] and len(results["ids"][0]) > 0:
                for idx, doc_id in enumerate(results["ids"][0]):
                    distance = results["distances"][0][idx]
                    # Cosine similarity = 1 - Cosine distance (Chroma returns distance)
                    scores[doc_id] = max(0.0, 1.0 - distance)
            return scores
        except Exception as e:
            print(f"[Warning] ChromaDB ephemeral ranking failed: {e}")
            return {}
