import json
from typing import List, Dict, Any
from packages.llm.llm_service import LLMService
from packages.embeddings.chroma_service import ChromaDBService
from packages.schemas.schemas import ProductSchema
from sqlalchemy.orm import Session
from packages.shared.models import Product

class BaseAgent:
    def __init__(self, name: str):
        self.name = name

    def run(self, task: str, context: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

class SearchAgent(BaseAgent):
    def __init__(self, vector_store: ChromaDBService, db: Session):
        super().__init__("SearchAgent")
        self.vector_store = vector_store
        self.db = db

    def run(self, task: str, context: Dict[str, Any]) -> Dict[str, Any]:
        print(f"[{self.name}] Executing search for: {task}")
        # Use vector search to find products matching the task description
        results = self.vector_store.search(task, limit=10)
        
        if not results:
            return {"found_products": []}
            
        recommended_ids = [res["id"] for res in results]
        products_db = self.db.query(Product).filter(Product.id.in_(recommended_ids)).all()
        
        schemas_list = []
        for prod in products_db:
            schemas_list.append(ProductSchema.model_validate(prod).model_dump())
            
        return {"found_products": schemas_list}

class AnalysisAgent(BaseAgent):
    def __init__(self, llm_service: LLMService):
        super().__init__("AnalysisAgent")
        self.llm_service = llm_service

    def run(self, task: str, context: Dict[str, Any]) -> Dict[str, Any]:
        print(f"[{self.name}] Analyzing task: {task}")
        products = context.get("found_products", [])
        
        if not products:
            return {"analysis": "No products were found to analyze."}
            
        # Limit to top 5 to avoid token limits
        top_products = products[:5]
        
        product_str = ""
        for p in top_products:
            product_str += f"- {p.get('title')} ({p.get('price')} {p.get('currency')}): {p.get('description')}\n"
            
        prompt = f"""
        Task: {task}
        
        Products Data:
        {product_str}
        
        Analyze the products above specifically addressing the task. Provide a clear, concise, and helpful analysis.
        """
        
        analysis = self.llm_service.provider.generate_text(prompt, system_instruction="You are a smart shopping analyst tailored for the Indian market. Use Indian currency (INR / ₹) and think from an Indian consumer's perspective (value for money, local availability). Use terms like Rs, Lakhs, Crores where appropriate.")
        return {"analysis": analysis}

class OrchestratorAgent(BaseAgent):
    def __init__(self, llm_service: LLMService, search_agent: SearchAgent, analysis_agent: AnalysisAgent):
        super().__init__("OrchestratorAgent")
        self.llm_service = llm_service
        self.search_agent = search_agent
        self.analysis_agent = analysis_agent

    def execute_swarm(self, query: str) -> Dict[str, Any]:
        steps = []
        
        # Step 1: Orchestrator identifies search intent
        steps.append({"agent": self.name, "action": "Analyzing intent", "details": f"Received query: '{query}'"})
        
        # Step 2: Search Agent
        steps.append({"agent": self.search_agent.name, "action": "Searching Catalog", "details": f"Querying semantic database for '{query}'"})
        search_results = self.search_agent.run(query, {})
        found = len(search_results.get("found_products", []))
        steps.append({"agent": self.search_agent.name, "action": "Search Complete", "details": f"Found {found} relevant products."})
        
        # Step 3: Analysis Agent
        steps.append({"agent": self.analysis_agent.name, "action": "Analyzing Products", "details": "Comparing features, pros, and cons."})
        analysis_results = self.analysis_agent.run(query, search_results)
        
        # Step 4: Synthesis
        steps.append({"agent": self.name, "action": "Synthesizing Final Response", "details": "Generating comprehensive answer."})
        final_answer = analysis_results.get("analysis", "Unable to complete analysis.")
        
        return {
            "query": query,
            "steps": steps,
            "final_answer": final_answer,
            "products": search_results.get("found_products", [])[:5]
        }
