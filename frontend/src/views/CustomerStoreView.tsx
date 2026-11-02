import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Star, 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  Sparkles, 
  ArrowUpDown, 
  ChevronRight, 
  Eye, 
  Check, 
  X,
  PhoneCall,
  Flame,
  Gift,
  Copy,
  Tag,
  Percent
} from 'lucide-react';
import { api, Product, Category, CartData } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CustomerNavbar } from '../components/customer/CustomerNavbar';
import { CartDrawer } from '../components/customer/CartDrawer';
import { CheckoutModal } from '../components/customer/CheckoutModal';
import { CustomerAuthModal } from '../components/customer/CustomerAuthModal';
import { OrderConfirmationModal } from '../components/customer/OrderConfirmationModal';
import { ProductDetailModal } from '../components/customer/ProductDetailModal';
import { CustomerOrdersView } from './CustomerOrdersView';

export const CustomerStoreView: React.FC = () => {
  const { customer, customerToken, cartCount, setCartCount } = useAuth();
  
  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const PAGE_SIZE = 36;
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [festivalOffer, setFestivalOffer] = useState<any>(null);
  const [copiedCoupon, setCopiedCoupon] = useState<boolean>(false);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en');

  // Modals
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeView, setActiveView] = useState<'catalog' | 'orders'>('catalog');

  // Completed Order State for Confirmation Modal
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [confirmedAICall, setConfirmedAICall] = useState<any>(null);

  // Initial Fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catsRes, prodsRes, festRes] = await Promise.all([
          api.getCategories(),
          api.getPublicProducts({ limit: PAGE_SIZE, offset: 0 }),
          api.getFestivalOffer()
        ]);
        setCategories(catsRes.data);
        setProducts(prodsRes.data);
        setFestivalOffer(festRes.data);

        // Fetch Cart if customer authenticated
        if (customerToken) {
          try {
            const cartRes = await api.getCart();
            setCart(cartRes.data);
            setCartCount(cartRes.data.items_count);
          } catch {}
        }
      } catch (err) {
        console.error("Failed to load store data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerToken]);

  // Dynamic filter query with pagination reset
  useEffect(() => {
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const res = await api.getPublicProducts({
          search: searchQuery || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          sort_by: sortBy,
          limit: PAGE_SIZE,
          offset: 0
        });
        const items = res.data || [];
        setProducts(items);
        setHasMore(items.length >= PAGE_SIZE);
      } catch (e) {
        console.error("Filter error", e);
      } finally {
        setLoading(false);
      }
    };
    const debounce = setTimeout(fetchFiltered, 250);
    return () => clearTimeout(debounce);
  }, [selectedCategory, searchQuery, sortBy]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.getPublicProducts({
        search: searchQuery || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        sort_by: sortBy,
        limit: PAGE_SIZE,
        offset: products.length
      });
      const newItems = res.data || [];
      setProducts((prev) => [...prev, ...newItems]);
      if (newItems.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Load more error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAddToCart = async (product: Product, quantity: number = 1, _variant?: any) => {
    if (!customerToken) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const res = await api.addToCart(product.id, quantity);
      setCart(res.data);
      setCartCount(res.data.items_count);
      setIsCartOpen(true);
    } catch (e) {
      console.error("Failed to add to cart", e);
    }
  };

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  const handleBuyNow = async (product: Product, quantity: number = 1, _variant?: any) => {
    if (!customerToken) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const res = await api.addToCart(product.id, quantity);
      setCart(res.data);
      setCartCount(res.data.items_count);
      setIsCheckoutOpen(true);
    } catch (e) {
      console.error("Failed to initiate buy now", e);
    }
  };

  const handleOrderSuccess = (order: any, aiCall: any) => {
    setConfirmedOrder(order);
    setConfirmedAICall(aiCall);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation Header */}
      <CustomerNavbar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={(slug) => setSelectedCategory(slug)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
        onOpenCart={() => {
          if (!customerToken) setIsAuthOpen(true);
          else setIsCartOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenOrders={() => {
          if (!customerToken) setIsAuthOpen(true);
          else setActiveView('orders');
        }}
        preferredLanguage={preferredLanguage}
        onLanguageChange={(l) => setPreferredLanguage(l)}
      />

      {/* Main View Switcher */}
      {activeView === 'orders' ? (
        <CustomerOrdersView onBackToStore={() => setActiveView('catalog')} />
      ) : (
        <main className="flex-1 pb-16 space-y-6">
          {/* Festive Diwali Mega Offer Hero Banner */}
          <div className="container mx-auto px-4 pt-6">
            <div className="relative rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700 text-white p-6 sm:p-10 shadow-2xl overflow-hidden border border-amber-300/30">
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-amber-900/40 backdrop-blur-md text-xs font-black uppercase tracking-wider text-yellow-200 border border-yellow-300/40 shadow-sm animate-pulse">
                    <span>🪔</span>
                    <span>{festivalOffer?.festival?.badge || 'DIWALI FESTIVE DHAMAKA 2026 LIVE'}</span>
                  </span>
                  <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white/20 text-xs font-bold text-white">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                    <span>Up to 75% OFF + Extra 25% Off</span>
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                  Grand Diwali Festival <span className="text-yellow-300 underline decoration-wavy decoration-yellow-400/60">Dhamaka Sale</span>
                </h2>

                <p className="text-xs sm:text-sm text-amber-100 leading-relaxed max-w-xl font-medium">
                  {festivalOffer?.festival?.subheading || 'Celebrate the Festival of Lights with trending Diwali deals across Electronics, Festive Kurtas & Sarees, Brass Diyas, Smart 4K TVs, and Royal Dry Fruit Hampers!'}
                </p>

                {/* Festival Coupon Box */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center bg-white/15 backdrop-blur-md border border-white/30 rounded-2xl p-2 px-3 shadow-inner space-x-3">
                    <Tag className="w-4 h-4 text-yellow-300" />
                    <div>
                      <p className="text-[10px] text-amber-200 font-bold uppercase tracking-wider">Diwali Festive Coupon</p>
                      <p className="text-sm font-black text-yellow-300 tracking-wider font-mono">
                        {festivalOffer?.festival?.coupon_code || 'DIWALI2026'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopyCoupon(festivalOffer?.festival?.coupon_code || 'DIWALI2026')}
                      className="ml-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 rounded-xl font-extrabold text-xs flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                    >
                      {copiedCoupon ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCoupon ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <span className="text-xs text-amber-100 font-semibold bg-black/20 px-3 py-2 rounded-xl">
                    Flat 25% Instant Off on Orders Above ₹499
                  </span>
                </div>

                <div className="pt-1 flex flex-wrap gap-2 text-xs">
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                    <Truck className="w-4 h-4 text-emerald-300" />
                    <span>Free Diwali Festive Express Delivery</span>
                  </span>
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                    <Gift className="w-4 h-4 text-yellow-300" />
                    <span>Free Festive Gift Wrapping</span>
                  </span>
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                    <PhoneCall className="w-4 h-4 text-sky-300" />
                    <span>AI Voice Confirmation in Your Language</span>
                  </span>
                </div>
              </div>

              {/* Decorative Diya / Glow Elements */}
              <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute right-8 bottom-6 hidden lg:block opacity-95 pointer-events-none">
                <div className="bg-black/30 backdrop-blur-md border border-amber-300/30 p-4 rounded-3xl shadow-2xl text-left space-y-2 w-72">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🪔</span>
                    <div>
                      <p className="text-[11px] font-black tracking-wide text-yellow-300 uppercase">Diwali Festival Offer Engine</p>
                      <p className="text-[10px] text-amber-200">Auto-detected for November Festive Season</p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white/10 rounded-2xl text-xs space-y-1">
                    <p className="font-bold text-white flex items-center justify-between">
                      <span>Trending Festival Deals:</span>
                      <span className="text-emerald-300 font-extrabold">Live Active</span>
                    </p>
                    <p className="text-[11px] text-amber-100">• Solid Brass Peacock Diya Sets</p>
                    <p className="text-[11px] text-amber-100">• Kaju Katli & Royal Dry Fruit Box</p>
                    <p className="text-[11px] text-amber-100">• Banarasi Silk Sarees & Kurtas</p>
                    <p className="text-[11px] text-amber-100">• 4K Smart TVs & Smart RGB Lights</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trending Festival Products Showcase */}
          {festivalOffer?.trending_products && festivalOffer.trending_products.length > 0 && (
            <div className="container mx-auto px-4 pt-2">
              <div className="bg-gradient-to-b from-amber-500/10 to-orange-500/5 p-6 rounded-3xl border border-amber-200/60 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">🪔</span>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        Trending Diwali Festive Picks & Special Offers
                      </h3>
                      <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Limited Festival Stock
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Most loved festive products across India for Diwali celebrations with verified express delivery
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {festivalOffer.trending_products.slice(0, 4).map((festProd: any) => (
                    <div
                      key={festProd.id || festProd.sku}
                      className="bg-white rounded-2xl border-2 border-amber-300/80 shadow-md hover:shadow-xl hover:border-amber-500 transition-all duration-200 flex flex-col overflow-hidden group"
                    >
                      <div
                        className="relative aspect-4/3 overflow-hidden bg-slate-100 cursor-pointer"
                        onClick={() => setSelectedProduct(festProd)}
                      >
                        <img
                          src={festProd.image_url || 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=500'}
                          alt={festProd.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <span className="absolute top-2.5 left-2.5 bg-gradient-to-r from-amber-500 to-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1">
                          <span>🪔</span>
                          <span>{festProd.festival_badge || 'Diwali Special'}</span>
                        </span>
                        <span className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-yellow-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                          {festProd.category}
                        </span>
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center space-x-1 text-amber-500 text-xs">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="font-extrabold">{festProd.rating}</span>
                            <span className="text-[10px] text-slate-400">({festProd.reviews_count} reviews)</span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-2 mt-1 group-hover:text-amber-700 transition-colors">
                            {festProd.name}
                          </h4>
                          <p className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1 mt-1">
                            <Truck className="w-3 h-3" />
                            <span className="truncate">{festProd.delivery_estimate || 'Festive Express Delivery'}</span>
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-baseline space-x-2">
                            <span className="text-base font-black text-slate-900">₹{Number(festProd.price).toFixed(2)}</span>
                            {festProd.original_price && festProd.original_price > festProd.price && (
                              <span className="text-xs text-slate-400 line-through">
                                ₹{Number(festProd.original_price).toFixed(2)}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              {festProd.discount_pct}% OFF
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                            <button
                              onClick={() => handleAddToCart(festProd)}
                              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                            >
                              <ShoppingBag className="w-3 h-3 text-amber-700" />
                              <span>Add</span>
                            </button>
                            <button
                              onClick={() => handleBuyNow(festProd)}
                              className="py-1.5 px-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-bold text-[11px] flex items-center justify-center cursor-pointer shadow-sm transition-all"
                            >
                              <span>Buy Now</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Catalog Toolbar & Sorting */}
          <div className="container mx-auto px-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-700 font-bold">
                <span className="text-blue-600 font-black">{products.length} Products</span>
                <span>in {selectedCategory === 'all' ? 'All 16 Categories' : selectedCategory}</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 font-medium">Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="featured">Featured Picks</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Highest Customer Rating</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="font-semibold text-slate-600">Loading catalog items...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-800 text-sm">No products found matching your search</p>
                <p className="text-xs text-slate-400">Try adjusting your filters or category selection.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 cursor-pointer"
                >
                  Reset Catalog Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-200 flex flex-col overflow-hidden group"
                  >
                    {/* Product Image & Badges */}
                    <div className="relative aspect-4/3 overflow-hidden bg-slate-100 cursor-pointer" onClick={() => setSelectedProduct(prod)}>
                      <img
                        src={prod.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {prod.discount_pct && prod.discount_pct > 0 && (
                        <span className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                          {prod.discount_pct}% OFF
                        </span>
                      )}
                      <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs">
                        {prod.category}
                      </span>
                    </div>

                    {/* Product Content Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        {/* Rating row */}
                        <div className="flex items-center space-x-1.5 text-xs">
                          <div className="flex items-center text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span className="font-black ml-1 text-slate-800">{prod.rating || 4.5}</span>
                          </div>
                          <span className="text-slate-400 text-[11px]">({prod.reviews_count || 120})</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-emerald-700 font-bold text-[10px] flex items-center">
                            <Check className="w-3 h-3 mr-0.5" /> In Stock
                          </span>
                        </div>

                        {/* Title */}
                        <h3
                          onClick={() => setSelectedProduct(prod)}
                          className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer leading-snug"
                        >
                          {prod.name}
                        </h3>

                        {/* Delivery Estimate */}
                        <p className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                          <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{prod.delivery_estimate || 'Delivery in 2 business days'}</span>
                        </p>
                      </div>

                      {/* Pricing Row */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-baseline space-x-2">
                          <span className="text-base font-black text-slate-900">₹{Number(prod.price).toFixed(2)}</span>
                          {prod.original_price && prod.original_price > prod.price && (
                            <span className="text-xs text-slate-400 line-through">
                              ₹{Number(prod.original_price).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button
                            onClick={() => handleAddToCart(prod)}
                            className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                            <span>Add</span>
                          </button>
                          <button
                            onClick={() => handleBuyNow(prod)}
                            className="py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer shadow-sm shadow-blue-500/20 transition-all"
                          >
                            <span>Buy Now</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unlimited Live Catalog Load More */}
            {!loading && products.length > 0 && hasMore && (
              <div className="flex flex-col items-center justify-center pt-10 pb-6 space-y-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all transform hover:scale-105 cursor-pointer flex items-center space-x-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Fetching Next Live Product Feed...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Load More Products (Unlimited Live Catalog)</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-500 font-medium">
                  Showing {products.length} products • Live Multi-Marketplace API Feed Active
                </p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateCart={(updated) => setCart(updated)}
        onOpenCheckout={() => {
          if (!customerToken) setIsAuthOpen(true);
          else setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Customer Auth Modal */}
      <CustomerAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      {/* Order Confirmed & AI Call Softphone Simulation Modal */}
      {confirmedOrder && (
        <OrderConfirmationModal
          isOpen={!!confirmedOrder}
          onClose={() => setConfirmedOrder(null)}
          orderData={confirmedOrder}
          aiCallData={confirmedAICall}
          onViewOrders={() => {
            setConfirmedOrder(null);
            setActiveView('orders');
          }}
        />
      )}
    </div>
  );
};

