import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertCircle,
  CheckCircle,
  X,
  Edit,
  Trash2,
  Filter,
  Eye,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { api, Product } from '../services/api';

const ALL_CATEGORIES = [
  "Electronics",
  "Mobiles and Accessories",
  "Laptops and Computers",
  "Fashion and Clothing",
  "Men's Fashion",
  "Women's Fashion",
  "Home Appliances",
  "Kitchen Products",
  "Beauty and Personal Care",
  "Grocery",
  "Furniture",
  "Sports and Fitness",
  "Books",
  "Toys and Baby Products",
  "Automotive Accessories",
  "Health and Lifestyle Products"
];

export const ProductsInventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // Modal States
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState('999.00');
  const [originalPrice, setOriginalPrice] = useState('1499.00');
  const [stock, setStock] = useState('50');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [warranty, setWarranty] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [customSpecs, setCustomSpecs] = useState<Record<string, string>>({});

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.listProducts({
        search: searchTerm || undefined,
        category: selectedCategoryFilter !== 'All' ? selectedCategoryFilter : undefined
      });
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategoryFilter]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingProductId(null);
    setSku(`NXR-${Math.floor(1000 + Math.random() * 9000)}`);
    setName('');
    setCategory('Electronics');
    setPrice('999.00');
    setOriginalPrice('1499.00');
    setStock('50');
    setImageUrl('');
    setDescription('');
    setWarranty('1 Year Comprehensive Brand Replacement Warranty');
    setReturnPolicy('7-Day Hassle-Free Doorstep Replacement & 10-Second Instant UPI / Bank Refund');
    setCustomSpecs({});
    setShowModal(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setModalMode('edit');
    setEditingProductId(p.id);
    setSku(p.sku);
    setName(p.name);
    setCategory(p.category);
    setPrice(String(p.price));
    setOriginalPrice(String(p.original_price || Math.round(Number(p.price) * 1.3)));
    setStock(String(p.stock_quantity ?? 50));
    setImageUrl(p.image_url || '');
    setDescription(p.description || '');

    const specs = { ...(p.specifications || {}) };
    setWarranty(String(specs.Warranty || ''));
    setReturnPolicy(String(specs['Return Policy'] || ''));

    const filtered: Record<string, string> = {};
    Object.entries(specs).forEach(([k, v]) => {
      if (!['Warranty', 'Return Policy', 'images', 'customer_reviews', 'variants', 'colors', 'tax_rate'].includes(k) && typeof v !== 'object') {
        filtered[k] = String(v);
      }
    });
    setCustomSpecs(filtered);
    setShowModal(true);
  };

  const handleAddSpecItem = () => {
    if (specKey.trim() && specValue.trim()) {
      setCustomSpecs({ ...customSpecs, [specKey.trim()]: specValue.trim() });
      setSpecKey('');
      setSpecValue('');
    }
  };

  const handleRemoveSpecItem = (key: string) => {
    const updated = { ...customSpecs };
    delete updated[key];
    setCustomSpecs(updated);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pNum = parseFloat(price);
      const origNum = parseFloat(originalPrice) || pNum;
      const disc = origNum > pNum ? Math.round(((origNum - pNum) / origNum) * 100) : 0;

      const finalSpecs: Record<string, any> = {
        ...customSpecs,
        Warranty: warranty.trim() || '1 Year Brand Warranty',
        'Return Policy': returnPolicy.trim() || '7-Day Easy Returns'
      };

      if (imageUrl.trim()) {
        finalSpecs.images = [imageUrl.trim()];
      }

      if (modalMode === 'create') {
        await api.createProduct({
          sku,
          name,
          category,
          price: pNum,
          original_price: origNum,
          discount_pct: disc,
          currency: 'INR',
          stock_quantity: parseInt(stock, 10),
          image_url: imageUrl.trim() || undefined,
          description,
          specifications: finalSpecs,
          is_active: true
        });
      } else if (editingProductId) {
        await api.updateProduct(editingProductId, {
          sku,
          name,
          category,
          price: pNum,
          original_price: origNum,
          discount_pct: disc,
          stock_quantity: parseInt(stock, 10),
          image_url: imageUrl.trim() || undefined,
          description,
          specifications: finalSpecs
        });
      }

      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!window.confirm(`Are you sure you want to delete '${prodName}' from the store catalogue?`)) {
      return;
    }
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Products & Inventory Catalogue</h1>
          <p className="text-xs text-slate-500">
            Real-time verified inventory and category specifications synced autonomously with Nexora Storefront & AI Receptionist.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by SKU, product name, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-48"
          >
            <option value="All">All Categories</option>
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={fetchProducts}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Selling Price (INR)</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">Loading catalogue...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">No products found matching filters.</td>
                </tr>
              ) : (
                products.map((p) => {
                  const qty = p.stock_quantity ?? 0;
                  const isLow = qty <= 8 && qty > 0;
                  const isOut = qty === 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{p.sku}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800 line-clamp-1">{p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-xs">{p.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 font-semibold text-[10px] px-2 py-0.5 rounded-md">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        ₹{Number(p.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-semibold">
                        {qty} units
                      </td>
                      <td className="py-3 px-4">
                        {isOut ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Out of Stock</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Low Stock ({qty})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>In Stock</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Edit Product & Specifications"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-800">
                {modalMode === 'create' ? 'Add New Product to Store Catalogue' : `Edit Product: ${sku}`}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pure Cold-Pressed Virgin Coconut Oil (1 Litre)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Selling Price (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Original Price (M.R.P.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Description</label>
                <textarea
                  rows={2}
                  placeholder="Comprehensive description of product utility, benefits, and key features..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warranty Information</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Year Replacement / FSSAI Guarantee"
                    value={warranty}
                    onChange={(e) => setWarranty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Return & Replacement Policy</label>
                  <input
                    type="text"
                    placeholder="e.g. 7-Day Free Replacement / 24h on damage"
                    value={returnPolicy}
                    onChange={(e) => setReturnPolicy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Category-Specific Custom Specifications Table */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-800">
                  Category Specifications (Key-Value Technical Attributes)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Ingredients, Net Quantity, Processor, Fabric)"
                    value={specKey}
                    onChange={(e) => setSpecKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 100% Pure Organic, 1 Litre, Snapdragon 8 Gen 3)"
                    value={specValue}
                    onChange={(e) => setSpecValue(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSpecItem}
                    className="px-3 py-1.5 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-900 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {Object.keys(customSpecs).length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 mt-2">
                    {Object.entries(customSpecs).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-200">
                        <div>
                          <strong className="text-slate-700">{k}:</strong> <span className="text-slate-600">{v}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecItem(k)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {modalMode === 'create' ? 'Save Product' : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
