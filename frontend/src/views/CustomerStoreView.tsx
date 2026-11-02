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
  PhoneCall
} from 'lucide-react';
import { api, Product, Category, CartData } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CustomerNavbar } from '../components/customer/CustomerNavbar';
import { CartDrawer } from '../components/customer/CartDrawer';
import { CheckoutModal } from '../components/customer/CheckoutModal';
import { CustomerAuthModal } from '../components/customer/CustomerAuthModal';
import { OrderConfirmationModal } from '../components/customer/OrderConfirmationModal';
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
        const [catsRes, prodsRes] = await Promise.all([
          api.getCategories(),
          api.getPublicProducts({ limit: PAGE_SIZE, offset: 0 })
        ]);
        setCategories(catsRes.data);
        setProducts(prodsRes.data);

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

  const handleAddToCart = async (product: Product) => {
    if (!customerToken) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const res = await api.addToCart(product.id, 1);
      setCart(res.data);
      setCartCount(res.data.items_count);
      setIsCartOpen(true);
    } catch (e) {
      console.error("Failed to add to cart", e);
    }
  };

  const handleBuyNow = async (product: Product) => {
    if (!customerToken) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const res = await api.addToCart(product.id, 1);
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
          {/* Hero Promotional Banner */}
          <div className="container mx-auto px-4 pt-6">
            <div className="relative rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 text-white p-6 sm:p-10 shadow-xl overflow-hidden">
              <div className="relative z-10 max-w-xl space-y-3">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider text-blue-100">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Grand Festival Season • Up to 55% Off</span>
                </span>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                  Unified Shopping with Instant <span className="text-sky-300">AI Voice Calling</span>
                </h2>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-md">
                  Shop top-rated products from trusted suppliers. Confirm orders seamlessly with our automated AI assistant speaking fluent Tamil, Telugu, Kannada, Malayalam, and English.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-xs">
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                    <Truck className="w-4 h-4 text-emerald-300" />
                    <span>Free Shipping &gt; ₹499</span>
                  </span>
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                    <PhoneCall className="w-4 h-4 text-sky-300" />
                    <span>Autonomous Confirmation Call</span>
                  </span>
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-teal-300" />
                    <span>7-Day Hassle-Free Returns</span>
                  </span>
                </div>
              </div>

              {/* Decorative Circle Elements */}
              <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute right-12 bottom-6 hidden lg:block opacity-90 pointer-events-none">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl text-left space-y-1.5 w-64">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Live Voice Agent</p>
                  </div>
                  <p className="text-xs font-bold leading-tight">"வணக்கம்! உங்கள் ஆர்டர் உறுதியானது. நன்றி!"</p>
                  <p className="text-[10px] text-blue-200">5 Languages Supported Contextually</p>
                </div>
              </div>
            </div>
          </div>

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
      {selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="bg-blue-50 text-blue-700 font-bold text-xs px-2.5 py-0.5 rounded-full">
                {selectedProduct.category}
              </span>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <img
                  src={selectedProduct.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'}
                  alt={selectedProduct.name}
                  className="w-full aspect-square rounded-2xl object-cover border border-slate-200 shadow-xs"
                />
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-center space-x-2">
                  <PhoneCall className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Free AI Voice Confirmation call triggered in your language upon order.</span>
                </div>
              </div>

              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-extrabold text-base text-slate-900 leading-snug">{selectedProduct.name}</h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded-md flex items-center">
                      <Star className="w-3 h-3 fill-current mr-1" /> {selectedProduct.rating || 4.5}
                    </span>
                    <span className="text-slate-400">({selectedProduct.reviews_count || 120} verified ratings)</span>
                  </div>

                  <div className="flex items-baseline space-x-2.5 pt-1">
                    <span className="text-2xl font-black text-slate-900">₹{Number(selectedProduct.price).toFixed(2)}</span>
                    {selectedProduct.original_price && (
                      <span className="text-sm text-slate-400 line-through">
                        ₹{Number(selectedProduct.original_price).toFixed(2)}
                      </span>
                    )}
                    {selectedProduct.discount_pct && (
                      <span className="text-xs text-rose-600 font-bold">({selectedProduct.discount_pct}% off)</span>
                    )}
                  </div>

                  <p className="text-slate-600 leading-relaxed pt-1 text-xs">{selectedProduct.description}</p>

                  {/* Specifications Table */}
                  {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                    <div className="pt-2">
                      <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1.5">
                        Product Specifications:
                      </p>
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 divide-y divide-slate-200/60 text-[11px]">
                        {Object.entries(selectedProduct.specifications).map(([k, v]) => (
                          <div key={k} className="py-1 flex justify-between">
                            <span className="text-slate-500 font-medium">{k}</span>
                            <span className="font-bold text-slate-800 text-right">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleAddToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={() => {
                      handleBuyNow(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                  >
                    Instant Buy Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

