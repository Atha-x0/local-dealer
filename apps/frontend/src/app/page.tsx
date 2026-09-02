'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, 
  MapPin, 
  LayoutDashboard, 
  Database, 
  Activity, 
  ScanLine, 
  Globe, 
  Shield, 
  User, 
  Moon, 
  Sun, 
  CheckCircle, 
  Cpu, 
  Loader2, 
  Sparkles, 
  Server, 
  ChevronDown,
  Phone,
  ExternalLink,
  X,
  Award,
  Map,
  Store,
  Bell,
  Scale,
  Bot,
  Send
} from 'lucide-react';
import { usePriceAlerts } from '@/components/PriceAlertContext';
import { Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '@/lib/api';


function HomeContent() {
    const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') || '';
  const urlLoc = searchParams.get('loc') || '';
  
  const [history, setHistory] = useState<any[]>([]);

const [query, setQuery] = useState(urlQ);
  const [location, setLocation] = useState(urlLoc);
  const [results, setResults] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any>({});
  const [dealAnalysis, setDealAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const { setAlert } = usePriceAlerts();
  const [alertTargetPrice, setAlertTargetPrice] = useState<number | ''>('');
  
  const [compareList, setCompareList] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const [preferencesText, setPreferencesText] = useState('');
  const [forYouResults, setForYouResults] = useState<any[]>([]);
  const [loadingForYou, setLoadingForYou] = useState(false);

  const [swarmQuery, setSwarmQuery] = useState('');
  const [swarmResponse, setSwarmResponse] = useState<any>(null);
  const [loadingSwarm, setLoadingSwarm] = useState(false);
  
  const { clientId } = usePriceAlerts(); // Access clientId from context for profile

  const fetchRecommendations = async () => {
    if (!clientId) return;
    setLoadingForYou(true);
    try {
      const res = await fetch(API_BASE_URL + '/api/recommendations/' + clientId);
      const data = await res.json();
      setForYouResults(data.recommendations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForYou(false);
    }
  };

  const savePreferences = async () => {
    if (!clientId) return;
    setLoadingForYou(true);
    try {
      await fetch(API_BASE_URL + '/api/profile/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, preferences_text: preferencesText })
      });
      alert('Preferences saved!');
      fetchRecommendations();
    } catch (err) {
      console.error(err);
      setLoadingForYou(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'For You' && clientId) {
      fetchRecommendations();
    }
  }, [activeTab, clientId]);

  // Sync dark mode class with root html element
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const getFallbackImage = (title: string) => {
    if (!title) return "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=300&q=80";
    const keyword = encodeURIComponent(title.split(' ').slice(0, 2).join(','));
    return `https://loremflickr.com/300/300/${keyword}`;
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/search/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const removeHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(API_BASE_URL + '/api/search/history/' + id, { method: 'DELETE' });
      setHistory(history.filter(h => h.id !== id));
    } catch (err) {
      console.error('Failed to delete history', err);
    }
  };

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    loadHistory();
    if (urlQ) {
      handleSearch(urlQ, urlLoc, true); // true = skip URL update on mount to avoid infinite loop
    }
  }, [urlQ]);

  const handleSearch = async (searchQuery = query, searchLocation = location, skipUrlUpdate = false) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery) return;
    
    if (!skipUrlUpdate) {
      const params = new URLSearchParams();
      params.set('q', finalQuery);
      if (searchLocation) params.set('loc', searchLocation);
      router.push(`/?${params.toString()}`);
    }
    
    setLoading(true);
    setIsWakingUp(false);
    const wakeUpTimer = setTimeout(() => setIsWakingUp(true), 4000);
    let currentResults: any[] = [];
    
    // 1. Fetch Cached Data (Old Results)
    try {
      const cacheRes = await fetch(API_BASE_URL + '/api/search/cached?q=' + encodeURIComponent(finalQuery) + '&loc=' + encodeURIComponent(searchLocation));
      if (cacheRes.ok) {
        const cachedData = await cacheRes.json();
        if (cachedData.results) {
          setResults(cachedData.results);
          currentResults = cachedData.results;
          setRecommendations(cachedData.recommendations || {});
          setDealAnalysis(cachedData.deal_analysis || null);
        }
      } else {
        setResults([]); // Clear if no cache for THIS exact query
      }
    } catch(e) {
      console.error('Cache fetch error', e);
      setResults([]);
    }

    // 2. Fetch Fresh Data (New Results) and merge
    try {
      const res = await fetch(API_BASE_URL + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery, location: searchLocation, mode: 'Best Match' })
      });
      const data = await res.json();
      
      const newResults = data.results || [];
      const existingIds = new Set(currentResults.map(r => r.id));
      const mergedResults = [...currentResults];
      
      for (const item of newResults) {
        if (!existingIds.has(item.id)) {
          mergedResults.push(item);
          existingIds.add(item.id);
        }
      }
      
      setResults(mergedResults);
      setRecommendations(data.recommendations || {});
      setDealAnalysis(data.deal_analysis || null);
      loadHistory(); // refresh history panel
    } catch (err) {
      console.error(err);
    } finally {
      clearTimeout(wakeUpTimer);
      setLoading(false);
      setIsWakingUp(false);
    }
  };

  const handleCompare = async () => {
    if (compareList.length < 2) return;
    setLoadingComparison(true);
    setShowComparison(true);
    try {
      const res = await fetch(API_BASE_URL + '/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: compareList })
      });
      const data = await res.json();
      setComparisonData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComparison(false);
    }
  };

  const toggleCompare = (productId: string) => {
    setCompareList(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleQuickQuery = (term: string) => {
    setQuery(term);
    handleSearch(term, location);
  };

  const formatPrice = (product: any) => {
    if (!product) return "Contact Dealer";
    const dealerName = product.metadata_json?.seller_name || "Contact Dealer";
    const price = product.price;
    const currency = product.currency || 'USD';
    
    if (price === null || price === undefined || price === 0) {
      return dealerName;
    }
    const symbol = currency === 'INR' ? '₹' : '$';
    return dealerName + ' - ' + symbol + price.toLocaleString('en-IN');
  };

  // Stats calculation
  const totalOffersCount = results.length;
  const canonicalProductsCount = results.reduce((acc, curr) => {
    if (!acc.includes(curr.id)) acc.push(curr.id);
    return acc;
  }, [] as string[]).length;
  
  // Extract active dealers
  const activeDealersCount = results.length > 0 ? 4 : 0;  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* 2. Top Header Bar - E-commerce Style */}
        <header className="sticky top-0 z-30 py-4 md:py-0 md:h-20 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-md px-4 md:px-8 flex flex-wrap md:flex-nowrap items-center justify-between shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
              <Database className="h-5 w-5" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-800 dark:text-white">DealerHub</span>
          </div>

          {/* Central Search Bar */}
          <div className="flex w-full md:flex-1 md:max-w-2xl md:mx-8 order-3 md:order-none mt-4 md:mt-0">
            <div className="flex flex-col md:flex-row w-full bg-slate-100 dark:bg-slate-900/50 rounded-2xl md:rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50 transition-all">
              <div className="flex-1 flex items-center px-4 relative">
                <Search className="h-5 w-5 text-slate-400 shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-transparent border-0 text-sm focus:ring-0 focus:outline-none placeholder-slate-400 text-slate-800 dark:text-slate-100 py-3"
                />
                
                {/* Search History Dropdown */}
                {isSearchFocused && history.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="h-3 w-3" /> Recent Searches
                      </span>
                    </div>
                    <ul className="max-h-60 overflow-y-auto py-1">
                      {history.map((h: any, idx: number) => (
                        <li key={idx} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer group">
                          <div 
                            className="flex-1 flex items-center gap-3 overflow-hidden"
                            onClick={() => {
                              setQuery(h.query);
                              setLocation(h.location || '');
                              setIsSearchFocused(false);
                              handleSearch(h.query, h.location || '');
                            }}
                          >
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">{h.query}</span>
                            {h.location && <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0"><MapPin className="h-3 w-3" /> {h.location}</span>}
                          </div>
                          <button 
                            onClick={(e) => removeHistoryItem(e, h.id)}
                            className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition opacity-0 group-hover:opacity-100"
                            title="Remove from history"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="h-px md:h-6 w-full md:w-px bg-slate-200 dark:bg-slate-700 my-0 md:my-auto"></div>
              <div className="flex items-center px-4 md:w-48">
                <MapPin className="h-5 w-5 text-slate-400 shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-transparent border-0 text-sm focus:ring-0 focus:outline-none placeholder-slate-400 text-slate-800 dark:text-slate-100 py-3"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 md:py-0 font-bold transition-colors flex items-center justify-center"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
              </button>
            </div>
          </div>
          



          {/* Actions */}
          <div className="flex items-center gap-4 order-2 md:order-none">
            <Link
              href="/register"
              className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-sm font-bold rounded-full transition"
            >
              <Store className="h-4 w-4" />
              Sell with Us
            </Link>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="h-10 w-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* 3. Primary Page Body */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto max-w-7xl w-full mx-auto">
          
          {/* AI Swarm Assistant Popup */}
          {activeTab === 'AI Swarm Assistant' && (
            <div className="fixed right-4 md:right-6 bottom-[140px] md:bottom-36 w-[calc(100vw-2rem)] md:w-[400px] max-h-[calc(100vh-160px)] md:max-h-[70vh] bg-white dark:bg-[#0f172a] shadow-2xl shadow-orange-500/20 border border-slate-200 dark:border-slate-800 rounded-3xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 fade-in duration-300">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#0f172a]">
                <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <Bot className="h-5 w-5 text-orange-500" />
                  Multi-Agent Swarm
                </h2>
                <button onClick={() => setActiveTab('Dashboard')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ask complex questions and watch specialized AI agents collaborate to answer them.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={swarmQuery}
                    onChange={(e) => setSwarmQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setLoadingSwarm(true);
                        fetch(API_BASE_URL + '/api/swarm/ask', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ query: swarmQuery })
                        })
                        .then(res => res.json())
                        .then(data => { setSwarmResponse(data); setLoadingSwarm(false); })
                        .catch(err => { console.error(err); setLoadingSwarm(false); });
                      }
                    }}
                    placeholder="e.g. Find laptops under ₹50,000 and compare their processors..."
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button 
                    onClick={() => {
                      setLoadingSwarm(true);
                      fetch(API_BASE_URL + '/api/swarm/ask', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: swarmQuery })
                      })
                      .then(res => res.json())
                      .then(data => { setSwarmResponse(data); setLoadingSwarm(false); })
                      .catch(err => { console.error(err); setLoadingSwarm(false); });
                    }}
                    disabled={loadingSwarm || !swarmQuery}
                    className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    {loadingSwarm ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>

                {swarmResponse && (
                  <div className="mt-6 space-y-6">
                    <details className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 [&_svg.chevron]:open:-rotate-180">
                      <summary className="text-sm font-bold text-slate-700 dark:text-slate-300 p-4 flex items-center justify-between cursor-pointer list-none select-none hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors rounded-xl">
                        <span className="flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Swarm Execution Trace
                        </span>
                        <ChevronDown className="chevron h-4 w-4 text-slate-500 transition-transform duration-200" />
                      </summary>
                      <div className="p-4 pt-0 space-y-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                        {swarmResponse.steps?.map((step: any, idx: number) => (
                          <div key={idx} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs">
                                {idx + 1}
                              </div>
                              {idx < swarmResponse.steps.length - 1 && <div className="w-px h-full bg-slate-200 dark:bg-slate-700 my-1"></div>}
                            </div>
                            <div className="pb-4">
                              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{step.agent}</div>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{step.action}</div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{step.details}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>

                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-6 rounded-xl">
                      <h3 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-3">
                        <Sparkles className="h-5 w-5" /> Swarm Final Synthesis
                      </h3>
                      <div className="prose prose-sm prose-orange dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 [&>p]:leading-relaxed">
                        <ReactMarkdown>{swarmResponse.final_answer}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* For You Popup */}
          {activeTab === 'For You' && (
            <div className="fixed right-4 md:right-6 bottom-[140px] md:bottom-36 w-[calc(100vw-2rem)] md:w-[450px] max-h-[calc(100vh-160px)] md:max-h-[75vh] bg-white dark:bg-[#0f172a] shadow-2xl shadow-orange-500/20 border border-slate-200 dark:border-slate-800 rounded-3xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 fade-in duration-300">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#0f172a]">
                <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  Personalized Matches
                </h2>
                <button onClick={() => setActiveTab('Dashboard')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-8">
                
                {/* Preferences Form */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Preferences</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tell our AI what you usually look for, favorite brands, or general requirements.</p>
                  </div>
                  <textarea 
                    value={preferencesText}
                    onChange={(e) => setPreferencesText(e.target.value)}
                    placeholder="e.g. I love Apple products, prefer dark colors, and usually look for electronics under $1000..."
                    className="w-full h-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none transition-shadow"
                  />
                  <button 
                    onClick={savePreferences}
                    disabled={loadingForYou}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-sm text-sm disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {loadingForYou ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    {loadingForYou ? 'Saving...' : 'Update & Find Matches'}
                  </button>
                </div>

                {/* Recommendations Results */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    Top Semantic Matches For You
                  </h3>
                  
                  {loadingForYou ? (
                    <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                      <span className="text-sm font-medium">Finding perfect matches...</span>
                    </div>
                  ) : forYouResults.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 shadow-sm flex flex-col items-center gap-3">
                      <Database className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                      <span className="text-sm font-medium">No recommendations yet. Update your preferences above!</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {forYouResults.map((product) => (
                        <div key={product.id} className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl hover:border-orange-500/50 transition-colors flex gap-4 group shadow-sm">
                          {product.images?.[0] && (
                            <div className="h-20 w-20 shrink-0 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden">
                              <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-md tracking-wider truncate">
                                  {product.brand || 'Match'}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors truncate">
                                {product.title}
                              </h4>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                              <span className="text-sm font-black text-slate-800 dark:text-white truncate">
                                {formatPrice(product)}
                              </span>
                              <button 
                                onClick={() => setSelectedProduct(product)}
                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-600 dark:hover:bg-orange-600 text-slate-700 dark:text-slate-300 hover:text-white py-1.5 px-3 rounded-lg font-bold transition-colors shrink-0"
                              >
                                Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

            <div className="space-y-10">
              {/* Quick Categories & Promoted */}
              <section className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {['Samsung Galaxy', 'Logitech Mouse', 'Dell Laptop', 'Type-C Charger', 'Smart Watches', 'Headphones'].map((term) => (
                  <button
                    key={term}
                    onClick={() => handleQuickQuery(term)}
                    className="whitespace-nowrap px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-slate-700 dark:text-slate-300 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-all font-semibold shadow-sm"
                  >
                    {term}
                  </button>
                ))}
              </section>



              {/* Highlight Deals (Horizontal) */}
              {recommendations && recommendations.best_overall && (
                <section>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Sparkles className="h-6 w-6 text-orange-500" />
                    Top Recommendations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Best Option Card */}
                    <div 
                      onClick={() => setSelectedProduct(recommendations.best_overall)}
                      className="group bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-3xl p-6 flex gap-6 cursor-pointer hover:shadow-lg transition-all"
                    >
                      <div className="h-32 w-32 shrink-0 bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden relative">
                        <img src={recommendations.best_overall.images?.[0] || getFallbackImage(recommendations.best_overall.title)} alt="" className="object-cover h-full w-full rounded-xl mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform" />
                        <span className="absolute top-2 left-2 bg-orange-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Top Pick</span>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight group-hover:text-orange-600 transition-colors truncate">
                          {recommendations.best_overall.title}
                        </h4>
                        <span className="text-base font-bold text-orange-600 dark:text-orange-400 mt-2 truncate">
                          {formatPrice(recommendations.best_overall)}
                        </span>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full font-semibold border border-slate-200 dark:border-slate-700 truncate max-w-full">{recommendations.best_overall.brand}</span>
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-bold whitespace-nowrap">Verified Stock</span>
                        </div>
                      </div>
                    </div>

                    {/* Nearest Store Option */}
                    {recommendations.best_local && (
                      <div 
                        onClick={() => setSelectedProduct(recommendations.best_local)}
                        className="group bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-3xl p-6 flex gap-6 cursor-pointer hover:shadow-lg transition-all"
                      >
                        <div className="h-32 w-32 shrink-0 bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden relative">
                          <img src={recommendations.best_local.images?.[0] || getFallbackImage(recommendations.best_local.title)} alt="" className="object-cover h-full w-full rounded-xl mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform" />
                          <span className="absolute top-2 left-2 bg-orange-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Nearest</span>
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                          <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight group-hover:text-orange-600 transition-colors truncate">
                            {recommendations.best_local.title}
                          </h4>
                          <span className="text-base font-bold text-orange-600 dark:text-orange-400 mt-2 truncate">
                            {formatPrice(recommendations.best_local)}
                          </span>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1 truncate max-w-full"><MapPin className="h-3 w-3 shrink-0"/> <span className="truncate">{recommendations.best_local.metadata_json?.distance_miles ? ((recommendations.best_local.metadata_json.distance_miles * 1.60934).toFixed(1) + ' km') : 'Local'}</span></span>
                            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-bold whitespace-nowrap">In Store Today</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Main Catalog Grid */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {results.length > 0 ? 'Search Results' : 'Explore Catalog'}
                  </h3>
                  {results.length > 0 && <span className="text-sm font-semibold text-slate-500">{results.length} items found</span>}
                </div>

                {results.length === 0 ? (
                  <div className="bg-white dark:bg-[#0f172a] border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-sm">
                    <Search className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Ready to find something?</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Use the search bar above to browse products and compare local vs online prices.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {results.map((product) => (
                      <div key={product.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
                        
                        {/* Image Header */}
                        <div className="aspect-square bg-slate-50 dark:bg-slate-800/50 p-6 relative flex items-center justify-center cursor-pointer" onClick={() => setSelectedProduct(product)}>
                          <img 
                            src={product.images?.[0] || getFallbackImage(product.title)}
                            alt={product.title}
                            className="object-contain h-full w-full mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-500"
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleCompare(product.id); }}
                            className={"absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center transition-colors shadow-sm " + (compareList.includes(product.id) ? 'bg-orange-600 text-white' : 'bg-white text-slate-400 hover:text-orange-600')}
                          >
                            <Scale className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Card Body */}
                        <div className="p-5 flex flex-col flex-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider">
                              {product.brand}
                            </span>
                            {product.metadata_json?.is_local && (
                              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {product.metadata_json.distance_miles ? ((product.metadata_json.distance_miles * 1.60934).toFixed(1) + ' km') : 'Local'}
                              </span>
                            )}
                          </div>
                          
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug cursor-pointer group-hover:text-orange-600 transition-colors" onClick={() => setSelectedProduct(product)}>
                            {product.title}
                          </h4>
                          
                          <div className="mt-auto pt-4 flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                              {formatPrice(product)}
                            </span>
                            <button 
                              onClick={() => setSelectedProduct(product)}
                              className="bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

      </main>
    </div>

      {/* 7. Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#0f172a] z-10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 rounded-md">
                  {selectedProduct.brand}
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Product Specifications</span>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-8">
              
              {/* Grid 1: Basic Info & Picture */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Product Image Panel */}
                <div className="space-y-4">
                  <div className="aspect-square bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 relative flex items-center justify-center">
                    <img 
                      src={selectedProduct.images?.[0] || getFallbackImage(selectedProduct.title)}
                      alt={selectedProduct.title}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute top-3 left-3 bg-orange-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-lg shadow-orange-500/20 truncate max-w-[85%]">
                      {formatPrice(selectedProduct)}
                    </div>
                  </div>
                  
                  {/* Quick specs metadata summary list */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500 block font-bold">Category</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProduct.category}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500 block font-bold">Availability</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedProduct.availability}</span>
                    </div>
                  </div>
                </div>

                {/* Description & Concept info */}
                <div className="flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-orange-500 tracking-wider">Product Concept</span>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                      {selectedProduct.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-450 leading-relaxed pt-2">
                      {selectedProduct.description}
                    </p>
                  </div>
                  
                  {/* Dynamic specs details */}
                  {selectedProduct.attributes && Object.keys(selectedProduct.attributes).length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-orange-500" /> Technical Specifications
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(selectedProduct.attributes).map(([key, val]: any) => (
                          <div key={key} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">{key}</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{val.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Grid 3: Dealer Details & Contact (Dynamic if local) */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    {selectedProduct.metadata_json?.is_local ? '🏬 Local Dealer Contact & Location' : '🌐 Online Vendor Trace'}
                  </h4>
                  {selectedProduct.metadata_json?.is_local ? (
                    <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 rounded-full uppercase tracking-wider">
                      Physical Store
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-950/40 text-[9px] font-extrabold text-orange-700 dark:text-orange-400 rounded-full uppercase tracking-wider">
                      Digital Vendor
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Dealer Info Block */}
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="text-slate-400 block">Vendor Name</span>
                      <span className="text-sm font-extrabold text-slate-800 dark:text-white">
                        {selectedProduct.metadata_json?.seller_name || 'Online Marketplace'}
                      </span>
                    </div>

                    {selectedProduct.metadata_json?.is_local && (
                      <>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <Phone className="h-4.5 w-4.5 text-orange-600 dark:text-orange-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 block">Phone Support</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProduct.metadata_json.seller_phone}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <MapPin className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 block">Physical Address</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{selectedProduct.metadata_json.seller_address}</span>
                          </div>
                        </div>
                      </>
                    )}

                    {!selectedProduct.metadata_json?.is_local && (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <Globe className="h-4.5 w-4.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block">Domain Host</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProduct.metadata_json?.seller_name || 'Online Portal'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dealer Action Panel / Simulated Mini-Map */}
                  <div className="flex flex-col justify-between space-y-4">
                    {selectedProduct.metadata_json?.is_local ? (
                      <div className="flex-1 min-h-[100px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 opacity-10">
                          <Map className="h-32 w-32 text-slate-500" />
                        </div>
                        <div className="space-y-1 z-10">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">GPS Coordinates Mapping</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Latitude: {selectedProduct.metadata_json.seller_lat?.toFixed(5)}</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Longitude: {selectedProduct.metadata_json.seller_lng?.toFixed(5)}</span>
                        </div>
                        <div className="z-10 pt-2 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            GPS Node Active
                          </span>
                          {selectedProduct.metadata_json.distance_miles && (
                            <span className="text-slate-500 font-semibold bg-slate-200/50 dark:bg-slate-900 px-2 py-0.5 rounded-md">
                              {(selectedProduct.metadata_json.distance_miles * 1.60934).toFixed(1)} km away
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
                        <Globe className="h-8 w-8 text-slate-400 mb-2" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Online Platform Only</span>
                        <span className="text-[10px] text-slate-400 mt-1">No physical store mapping required.</span>
                      </div>
                    )}

                    <div className="flex gap-2 w-full">
                      <a 
                        href={selectedProduct.metadata_json?.seller_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Trace Source
                      </a>
                      
                      <div className="flex-1 flex gap-1">
                        <input 
                          type="number" 
                          placeholder="Target $" 
                          value={alertTargetPrice} 
                          onChange={(e) => setAlertTargetPrice(e.target.value ? Number(e.target.value) : '')}
                          className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <button 
                          onClick={() => {
                            if (alertTargetPrice && typeof alertTargetPrice === 'number') {
                              setAlert(selectedProduct.id, alertTargetPrice)
                                .then(() => {
                                  alert("Price alert set successfully!");
                                  setAlertTargetPrice('');
                                })
                                .catch(err => alert("Failed to set price alert: " + err.message));
                            }
                          }}
                          className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs py-3 px-2 rounded-xl flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                        >
                          <Bell className="h-4 w-4 shrink-0" />
                          Set Alert
                        </button>
                      </div>
                    </div>
                  </div>


                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* Floating Action Buttons for Swarm & For You */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        {/* For You FAB */}
        <div className="group relative flex items-center justify-end">
          <span className="absolute right-14 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap origin-right">
            For You
          </span>
          <button 
            onClick={() => setActiveTab(activeTab === 'For You' ? 'Dashboard' : 'For You')}
            className={"h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 " + (activeTab === 'For You' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-slate-800 text-orange-500 border border-slate-200 dark:border-slate-700')}
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </div>

        {/* AI Swarm Assistant FAB */}
        <div className="group relative flex items-center justify-end">
          <span className="absolute right-14 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap origin-right">
            AI Swarm Assistant
          </span>
          <button 
            onClick={() => setActiveTab(activeTab === 'AI Swarm Assistant' ? 'Dashboard' : 'AI Swarm Assistant')}
            className={"h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 " + (activeTab === 'AI Swarm Assistant' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-slate-800 text-orange-500 border border-slate-200 dark:border-slate-700')}
          >
            <Bot className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Floating Compare Button */}
      {compareList.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-5">
          <button
            onClick={handleCompare}
            className="bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-600/30 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Scale className="h-5 w-5" />
            Compare {compareList.length} Items
          </button>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">
            
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-[#0f172a] z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="h-6 w-6 text-orange-500" />
                Smart Product Comparison
              </h2>
              <button 
                onClick={() => setShowComparison(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {loadingComparison ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  <p className="text-slate-500">AI is analyzing and comparing products...</p>
                </div>
              ) : comparisonData ? (
                <div className="space-y-8">
                  {/* Verdict */}
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-2">
                      <Sparkles className="h-5 w-5" /> AI Verdict
                    </h3>
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                      {comparisonData.analysis?.verdict}
                    </p>
                  </div>

                  {/* Side-by-side Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase w-1/4">Feature</th>
                          {comparisonData.products?.map((p: any) => (
                            <th key={p.id} className="p-4 border-l border-slate-200 dark:border-slate-800 w-1/4">
                              <span className="block text-sm font-black text-slate-800 dark:text-white truncate">{p.title}</span>
                              <span className="block text-[11px] font-bold text-emerald-600 mt-1 truncate">{formatPrice(p)}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Pros */}
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="p-4 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/50">Pros</td>
                          {comparisonData.products?.map((p: any) => (
                            <td key={p.id} className="p-4 border-l border-slate-200 dark:border-slate-800 align-top">
                              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                                {comparisonData.analysis?.pros_cons?.[p.id]?.pros?.map((pro: string, i: number) => <li key={i}>{pro}</li>) || <li>-</li>}
                              </ul>
                            </td>
                          ))}
                        </tr>
                        {/* Cons */}
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="p-4 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/50">Cons</td>
                          {comparisonData.products?.map((p: any) => (
                            <td key={p.id} className="p-4 border-l border-slate-200 dark:border-slate-800 align-top">
                              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                                {comparisonData.analysis?.pros_cons?.[p.id]?.cons?.map((con: string, i: number) => <li key={i}>{con}</li>) || <li>-</li>}
                              </ul>
                            </td>
                          ))}
                        </tr>
                        {/* Features Comparison */}
                        {comparisonData.analysis?.features_comparison?.map((f: any, i: number) => (
                          <tr key={i} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
                            <td className="p-4 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/20">{f.feature_name}</td>
                            <td colSpan={comparisonData.products?.length} className="p-4 border-l border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                              {f.differences}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-red-500">Failed to load comparison data.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
