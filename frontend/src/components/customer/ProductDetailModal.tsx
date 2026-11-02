import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  Heart,
  Share2,
  Check,
  Copy,
  Truck,
  ShieldCheck,
  RotateCcw,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Clock,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  BadgeCheck,
  MapPin,
  CreditCard,
  ArrowRight
} from 'lucide-react';
import { Product } from '../../services/api';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variant?: { color: string; size: string }) => void;
  onBuyNow: (product: Product, quantity: number, variant?: { color: string; size: string }) => void;
}

interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
  helpfulCount: number;
  userVoted?: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow
}) => {
  if (!isOpen || !product) return null;

  // 1. IMAGES & GALLERY STATE
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1.5);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isHoveringImage, setIsHoveringImage] = useState<boolean>(false);

  // 2. MODEL & COPIED STATE
  const [copiedSku, setCopiedSku] = useState<boolean>(false);

  // 3. VARIANTS STATE
  const [selectedColor, setSelectedColor] = useState<string>('Midnight Black');
  const [selectedSize, setSelectedSize] = useState<string>('');

  // 4. QUANTITY STATE
  const [quantity, setQuantity] = useState<number>(1);

  // 5. DELIVERY PIN CODE STATE
  const [pinCode, setPinCode] = useState<string>('600001');
  const [pinChecked, setPinChecked] = useState<boolean>(true);
  const [pinStatus, setPinStatus] = useState<string>('Deliverable to Chennai, Tamil Nadu - 600001');

  // 6. TABS / ACTIVE SECTION
  const [activeTab, setActiveTab] = useState<'overview' | 'specifications' | 'reviews'>('overview');

  // 7. WISHLIST & SHARE
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // 8. CUSTOMER REVIEWS STATE
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [showWriteReview, setShowWriteReview] = useState<boolean>(false);
  const [newReviewName, setNewReviewName] = useState<string>('');
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewTitle, setNewReviewTitle] = useState<string>('');
  const [newReviewComment, setNewReviewComment] = useState<string>('');

  // Calculate pricing & savings
  const price = Number(product.price) || 0;
  const originalPrice = Number(product.original_price) || Math.round(price * 1.35);
  const discountPct = product.discount_pct || (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 15);
  const savings = Math.max(0, originalPrice - price);
  const stockQuantity = product.stock_quantity ?? 38;
  const inStock = product.in_stock !== false && stockQuantity > 0;
  const isLimitedStock = inStock && stockQuantity <= 8;

  // Model number / SKU
  const modelNumber = product.sku || `NXR-${product.id.slice(0, 8).toUpperCase()}`;

  // Build curated 4-5 images for ANY product
  const galleryImages = React.useMemo(() => {
    const list: string[] = [];
    if (product.image_url) list.push(product.image_url);

    // If specifications contains images list from API
    if (product.specifications?.images && Array.isArray(product.specifications.images)) {
      for (const img of product.specifications.images) {
        if (typeof img === 'string' && !list.includes(img)) {
          list.push(img);
        }
      }
    }

    // High quality angle fallbacks based on category so EVERY product has 4+ rich angles
    const categoryAngles: Record<string, string[]> = {
      Mobiles: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800&auto=format&fit=crop'
      ],
      Laptops: [
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop'
      ],
      Fashion: [
        'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop'
      ],
      Electronics: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop'
      ]
    };

    const fallbackAngles = categoryAngles[product.category] || [
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop'
    ];

    for (const fb of fallbackAngles) {
      if (list.length >= 5) break;
      if (!list.includes(fb)) list.push(fb);
    }

    return list.length > 0 ? list : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop'];
  }, [product]);

  // Dynamic variants based on category
  const availableColors = [
    { name: 'Midnight Black', hex: '#0f172a' },
    { name: 'Titanium Silver', hex: '#94a3b8' },
    { name: 'Royal Navy Blue', hex: '#1e40af' },
    { name: 'Crimson Red', hex: '#dc2626' },
    { name: 'Forest Emerald', hex: '#047857' }
  ];

  const availableSizes = React.useMemo(() => {
    const cat = (product.category || '').toLowerCase();
    if (cat.includes('laptop') || cat.includes('mobile') || cat.includes('electronic')) {
      return ['128 GB', '256 GB', '512 GB', '1 TB'];
    }
    if (cat.includes('fashion') || cat.includes('clothing') || cat.includes('shirt') || cat.includes('shoe')) {
      return ['S (38)', 'M (40)', 'L (42)', 'XL (44)', 'XXL (46)'];
    }
    if (cat.includes('beauty') || cat.includes('fragrance') || cat.includes('skin')) {
      return ['30 ml', '50 ml', '100 ml', '200 ml'];
    }
    return ['Standard Pack', 'Pro Edition', 'Family Bundle'];
  }, [product.category]);

  // Initialize selected size
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSize) {
      setSelectedSize(availableSizes[0]);
    }
  }, [availableSizes]);

  // Reset active image on product switch
  useEffect(() => {
    setActiveImageIndex(0);
    setQuantity(1);
  }, [product.id]);

  // Initialize reviews
  useEffect(() => {
    const seedReviews: ReviewItem[] = [
      {
        id: 'rev-1',
        name: 'Rajesh Kumar',
        rating: 5,
        date: '28 October 2026',
        title: 'Outstanding quality and super fast delivery!',
        comment: 'Exceeded my expectations! Build quality is top notch and the product was delivered within 24 hours. The AI order confirmation call was also super smooth.',
        verified: true,
        helpfulCount: 34
      },
      {
        id: 'rev-2',
        name: 'Priya Sundaram',
        rating: 5,
        date: '25 October 2026',
        title: 'Completely authentic and genuine product',
        comment: 'Verified the serial number with the manufacturer. 100% genuine. The packaging was completely shockproof with tamper-evident seal.',
        verified: true,
        helpfulCount: 21
      },
      {
        id: 'rev-3',
        name: 'Vikramaditya R.',
        rating: 4,
        date: '21 October 2026',
        title: 'Value for money in this price segment',
        comment: 'Great performance and very reliable. Battery/performance holds up nicely. Would definitely recommend to anyone looking for premium value.',
        verified: true,
        helpfulCount: 15
      }
    ];
    setReviews(seedReviews);
  }, [product.id]);

  // Copy SKU handler
  const handleCopySku = () => {
    navigator.clipboard.writeText(modelNumber);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  // Share handler
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // Image mouse move for hover zoom
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  };

  // PIN code check handler
  const handleCheckPin = () => {
    if (!pinCode || pinCode.length !== 6 || !/^\d+$/.test(pinCode)) {
      setPinChecked(false);
      setPinStatus('Please enter a valid 6-digit Indian PIN code.');
      return;
    }
    setPinChecked(true);
    setPinStatus(`Deliverable to PIN ${pinCode} • Fastest Express Delivery by Tomorrow 2:00 PM`);
  };

  // Helpful vote handler
  const handleHelpfulVote = (id: string) => {
    setReviews(prev =>
      prev.map(r => {
        if (r.id === id) {
          const nextVoted = !r.userVoted;
          return {
            ...r,
            helpfulCount: nextVoted ? r.helpfulCount + 1 : r.helpfulCount - 1,
            userVoted: nextVoted
          };
        }
        return r;
      })
    );
  };

  // Add review submission
  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewName.trim() || !newReviewComment.trim()) return;
    const newRev: ReviewItem = {
      id: `rev-${Date.now()}`,
      name: newReviewName.trim(),
      rating: newReviewRating,
      date: 'Today, Just now',
      title: newReviewTitle.trim() || 'Verified Customer Review',
      comment: newReviewComment.trim(),
      verified: true,
      helpfulCount: 1,
      userVoted: true
    };
    setReviews([newRev, ...reviews]);
    setNewReviewName('');
    setNewReviewTitle('');
    setNewReviewComment('');
    setShowWriteReview(false);
  };

  // Standard specifications
  const standardSpecs: Record<string, string> = {
    'Brand': product.specifications?.Brand || `Nexora Signature (${product.category})`,
    'Model / SKU': modelNumber,
    'Category': product.category,
    'Material / Build': product.specifications?.Material || 'Aerospace-Grade Alloy & High-Impact Polymer',
    'Dimensions': product.specifications?.Dimensions || '14.8 x 7.2 x 0.8 cm (Retail Pack)',
    'Net Weight': product.specifications?.Weight || '380 grams',
    'Connectivity / Input': product.specifications?.Connectivity || 'Universal Standard USB-C / High Speed',
    'Included in Box': `1x ${product.name}, Rapid Charge Adapter, User Guide, Official Warranty Card`,
    'Country of Origin': 'India',
    'Certifications': 'BIS Certified • CE • RoHS Standard Compliant'
  };

  // Merge extra specifications
  if (product.specifications) {
    Object.entries(product.specifications).forEach(([k, v]) => {
      if (k !== 'images' && k !== 'customer_reviews' && typeof v !== 'object') {
        standardSpecs[k] = String(v);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 my-auto flex flex-col max-h-[92vh]">
        
        {/* HEADER BAR */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="bg-blue-600 text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center shadow-xs">
              <Sparkles className="w-3 h-3 mr-1.5" /> {product.category}
            </span>
            <span className="hidden sm:inline-flex items-center bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
              <BadgeCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Nexora Verified Genuine
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsWishlisted(!isWishlisted)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isWishlisted ? 'bg-rose-50 text-rose-600' : 'hover:bg-slate-200/70 text-slate-500'
              }`}
              title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            >
              <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 hover:bg-slate-200/70 rounded-xl text-slate-500 cursor-pointer transition-colors relative"
              title="Share Product Link"
            >
              <Share2 className="w-5 h-5" />
              {shareCopied && (
                <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">
                  Link Copied!
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-400 cursor-pointer transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE CONTENT BODY */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto space-y-8 flex-1">
          
          {/* MAIN PRODUCT GRID (Images + Core Buy Box) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* 1. PRODUCT IMAGES SECTION (5 Columns) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Main Image with Zoom Lens */}
              <div 
                className="relative aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/80 shadow-inner group cursor-crosshair select-none"
                onMouseEnter={() => setIsHoveringImage(true)}
                onMouseLeave={() => setIsHoveringImage(false)}
                onMouseMove={handleMouseMove}
              >
                <img
                  src={galleryImages[activeImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-contain p-4 transition-transform duration-200"
                />

                {/* Hover Zoom Magnifier Overlay */}
                {isHoveringImage && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-blue-500/40 hidden md:block"
                    style={{
                      backgroundImage: `url(${galleryImages[activeImageIndex]})`,
                      backgroundPosition: `${mousePos.x}% ${mousePos.y}%`,
                      backgroundSize: '240%',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                )}

                {/* Discount Ribbon */}
                {discountPct > 0 && (
                  <div className="absolute top-3 left-3 bg-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider flex items-center">
                    {discountPct}% OFF
                  </div>
                )}

                {/* Click to Zoom / Lightbox Button */}
                <button
                  onClick={() => setIsZoomOpen(true)}
                  className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-slate-700 p-2 rounded-xl shadow-md border border-slate-200 cursor-pointer transition-all flex items-center space-x-1 text-xs font-semibold"
                  title="Open Fullscreen Zoom"
                >
                  <ZoomIn className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline text-[11px]">Zoom Preview</span>
                </button>

                {/* Left / Right Carousel Controls */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-md border border-slate-200 cursor-pointer transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-md border border-slate-200 cursor-pointer transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Image Index Pill */}
                <div className="absolute bottom-3 left-3 bg-slate-900/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-md">
                  {activeImageIndex + 1} / {galleryImages.length}
                </div>
              </div>

              {/* Gallery Thumbnails */}
              {galleryImages.length > 1 && (
                <div className="flex items-center space-x-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer bg-slate-50 ${
                        activeImageIndex === idx
                          ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md scale-102'
                          : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`Angle ${idx + 1}`} className="w-full h-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              )}

              {/* Autonomous AI Voice Call Banner */}
              <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100 text-xs text-blue-900 flex items-start space-x-2.5 shadow-xs">
                <PhoneCall className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-950">Autonomous AI Voice Confirmation</p>
                  <p className="text-[11px] text-blue-700/90 leading-relaxed mt-0.5">
                    Free automated phone call in your preferred language will confirm your order details & delivery address instantly.
                  </p>
                </div>
              </div>
            </div>

            {/* 2 - 12. RIGHT DETAILS & ACTION PANEL (7 Columns) */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* 2. PRODUCT NAME & MODEL NUMBER */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md flex items-center space-x-1">
                    <span>Model / SKU:</span>
                    <span className="text-slate-800 font-black">{modelNumber}</span>
                    <button
                      onClick={handleCopySku}
                      className="ml-1 hover:text-blue-600 cursor-pointer transition-colors"
                      title="Copy Model Number"
                    >
                      {copiedSku ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">• HSN: 8517 / Tax ID: GST-18%</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h1>

                {/* 4. RATING SECTION */}
                <div className="flex items-center space-x-3 pt-1 flex-wrap gap-y-1 text-xs">
                  <div className="flex items-center bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    <div className="flex text-amber-500 mr-1.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.floor(product.rating || 4.5) ? 'fill-current' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-extrabold text-amber-900 text-xs">{product.rating || 4.8}</span>
                  </div>
                  <span className="text-slate-400">•</span>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer"
                  >
                    {product.reviews_count || 184} verified ratings & {reviews.length} customer reviews
                  </button>
                </div>
              </div>

              {/* 3. PRICE SECTION */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-baseline space-x-3 flex-wrap gap-y-1">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  {originalPrice > price && (
                    <span className="text-sm text-slate-400 line-through font-medium">
                      M.R.P.: ₹{originalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {discountPct > 0 && (
                    <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full">
                      Save ₹{savings.toLocaleString('en-IN')} ({discountPct}% OFF)
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 font-medium">
                  Inclusive of all taxes • No Cost EMI starting at ₹{Math.round(price / 6).toLocaleString('en-IN')}/mo
                </p>

                {/* Nexoro Pay Later & Festive Offer Pills */}
                <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
                  <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200 flex items-center">
                    <CreditCard className="w-3 h-3 mr-1 text-indigo-600" /> Nexoro Pay Later: 0% Interest
                  </span>
                  <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-amber-600" /> Code DIWALI2026 for Extra 25% Off
                  </span>
                </div>
              </div>

              {/* 5. AVAILABILITY SECTION */}
              <div className="flex items-center space-x-3 text-xs">
                {inStock ? (
                  isLimitedStock ? (
                    <div className="flex items-center space-x-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-bold">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Limited Stock - Only {stockQuantity} left! Order soon</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span>In Stock ({stockQuantity} units available) • Ready to Dispatch</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Currently Out of Stock</span>
                  </div>
                )}
                <span className="text-slate-400 text-[11px]">Fulfilled by Nexora Warehouse</span>
              </div>

              {/* 8. VARIANTS SECTION (Colours & Sizes/Capacities/Models) */}
              <div className="space-y-3.5 pt-1 border-t border-slate-100">
                {/* Available Colours */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Select Colour:</span>
                    <span className="text-slate-500 font-medium">{selectedColor}</span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    {availableColors.map(c => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColor(c.name)}
                        className={`group relative p-1 rounded-full border-2 transition-all cursor-pointer ${
                          selectedColor === c.name
                            ? 'border-blue-600 scale-110 shadow-sm'
                            : 'border-transparent hover:scale-105'
                        }`}
                        title={c.name}
                      >
                        <span
                          className="block w-5 h-5 rounded-full shadow-inner border border-slate-300"
                          style={{ backgroundColor: c.hex }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available Sizes / Capacities / Models */}
                {availableSizes.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {product.category?.toLowerCase().includes('fashion') ? 'Select Size:' : 'Select Model / Capacity:'}
                      </span>
                      <span className="text-slate-500 font-medium">{selectedSize}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map(s => (
                        <button
                          key={s}
                          onClick={() => setSelectedSize(s)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedSize === s
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 9. QUANTITY & TOTAL SUB-CALCULATION */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-800">Quantity:</span>
                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-xs">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="px-3 py-1.5 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 py-1 font-black text-slate-900 text-sm">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(Math.min(stockQuantity, 10), quantity + 1))}
                      disabled={quantity >= Math.min(stockQuantity, 10)}
                      className="px-3 py-1.5 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">Subtotal ({quantity} {quantity > 1 ? 'items' : 'item'}):</span>
                  <span className="font-black text-slate-900 text-base">
                    ₹{(price * quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* ACTION BUTTONS (Add to Cart / Buy Now) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    onAddToCart(product, quantity, { color: selectedColor, size: selectedSize });
                    onClose();
                  }}
                  disabled={!inStock}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:opacity-50 text-slate-900 font-extrabold text-xs sm:text-sm rounded-xl cursor-pointer disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center space-x-2"
                >
                  <span>Add to Cart</span>
                </button>
                <button
                  onClick={() => {
                    onBuyNow(product, quantity, { color: selectedColor, size: selectedSize });
                    onClose();
                  }}
                  disabled={!inStock}
                  className="py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/25 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  <span>Instant Buy Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* 10. DELIVERY ESTIMATE BASED ON PIN CODE */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Delivery Estimate:
                  </span>
                  <span className="text-emerald-700 font-bold text-[11px]">Free Delivery Available</span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    maxLength={6}
                    placeholder="Enter 6-digit PIN"
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                  />
                  <button
                    onClick={handleCheckPin}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Check
                  </button>
                </div>

                <div className="pt-1 space-y-1 text-[11px]">
                  <p className="text-slate-700 font-medium flex items-center">
                    <Truck className="w-3 h-3 text-slate-500 mr-1.5 shrink-0" />
                    <span>{pinStatus}</span>
                  </p>
                  <p className="text-slate-500 pl-4.5">
                    Cash on Delivery (COD) available • 100% Contactless Doorstep Delivery
                  </p>
                </div>
              </div>

              {/* 11 & 12. WARRANTY & RETURNS TILES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                {/* 11. WARRANTY */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center text-slate-900 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5 shrink-0" />
                    <span>Warranty Duration & Coverage</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    1 Year Comprehensive Brand Replacement Warranty against manufacturing defects & hardware faults.
                  </p>
                </div>

                {/* 12. RETURNS */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center text-slate-900 font-bold">
                    <RotateCcw className="w-4 h-4 text-blue-600 mr-1.5 shrink-0" />
                    <span>Return & Replacement</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    7-Day Hassle-Free Doorstep Replacement & 10-Second Instant UPI / Bank Refund upon courier pickup.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* LOWER SECTION: TABS FOR (Description, Specifications, Customer Reviews) */}
          <div className="pt-4 border-t border-slate-200 space-y-5">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                6. Product Overview & Description
              </button>
              <button
                onClick={() => setActiveTab('specifications')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'specifications'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                7. Technical Specifications & Features
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'reviews'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                4. Verified Customer Reviews ({reviews.length})
              </button>
            </div>

            {/* TAB CONTENT 1: DESCRIPTION & HIGHLIGHTS */}
            {activeTab === 'overview' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Detailed Product Information
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {product.description ||
                      `${product.name} is meticulously engineered with industry-grade quality standards, bringing unparalleled reliability, sleek ergonomic styling, and superior efficiency. Whether for daily consumer convenience or demanding professional workflows, it delivers consistently outstanding output.`}
                  </p>
                </div>

                {/* Key Highlights */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Key Highlights & Features:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>100% Authentic Brand Certified directly sourced from verified factory partners.</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>High-Performance & Low-Energy footprint compliant with international standards.</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Nexora AI Voice Receptionist integration for automated tracking and instant multilingual help.</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Reinforced multi-tier shockproof tamper-evident transit packaging.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: SPECIFICATIONS */}
            {activeTab === 'specifications' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Technical Specifications & Features
                </h3>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
                  {Object.entries(standardSpecs).map(([key, value], idx) => (
                    <div
                      key={key}
                      className={`grid grid-cols-1 sm:grid-cols-3 p-3 gap-1 ${
                        idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                      }`}
                    >
                      <span className="font-bold text-slate-700 sm:col-span-1">{key}</span>
                      <span className="text-slate-600 sm:col-span-2 font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: CUSTOMER REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                
                {/* Rating summary bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="md:col-span-4 text-center md:text-left space-y-1">
                    <div className="text-4xl font-black text-slate-900">{product.rating || 4.8}</div>
                    <div className="flex justify-center md:justify-start text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Based on {product.reviews_count || 184} verified customer ratings</p>
                  </div>

                  <div className="md:col-span-5 space-y-1.5 text-xs">
                    {[
                      { star: 5, pct: 78 },
                      { star: 4, pct: 14 },
                      { star: 3, pct: 5 },
                      { star: 2, pct: 2 },
                      { star: 1, pct: 1 }
                    ].map(r => (
                      <div key={r.star} className="flex items-center space-x-2">
                        <span className="w-10 text-slate-600 font-bold">{r.star} Star</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="w-8 text-slate-400 text-right">{r.pct}%</span>
                      </div>
                    ))}
                  </div>

                  <div className="md:col-span-3 text-center md:text-right">
                    <button
                      onClick={() => setShowWriteReview(!showWriteReview)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-xs"
                    >
                      Write a Review
                    </button>
                  </div>
                </div>

                {/* Inline Write Review Form */}
                {showWriteReview && (
                  <form onSubmit={handleAddReview} className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3 text-xs animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900">Write Your Verified Review</span>
                      <button
                        type="button"
                        onClick={() => setShowWriteReview(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newReviewName}
                        onChange={(e) => setNewReviewName(e.target.value)}
                        placeholder="Your Full Name *"
                        required
                        className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-xl px-3 py-2">
                        <span className="text-slate-500 font-medium">Rating:</span>
                        <div className="flex text-amber-500">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setNewReviewRating(val)}
                              className="p-0.5 cursor-pointer"
                            >
                              <Star className={`w-4 h-4 ${val <= newReviewRating ? 'fill-current' : 'text-slate-200'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={newReviewTitle}
                      onChange={(e) => setNewReviewTitle(e.target.value)}
                      placeholder="Review Title (e.g. Excellent sound & build!)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <textarea
                      value={newReviewComment}
                      onChange={(e) => setNewReviewComment(e.target.value)}
                      placeholder="Write your honest experience with this product... *"
                      required
                      rows={3}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowWriteReview(false)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Submit Verified Review
                      </button>
                    </div>
                  </form>
                )}

                {/* Customer Reviews List */}
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2 text-xs shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs">
                            {r.name.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{r.name}</span>
                            {r.verified && (
                              <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                ✓ Verified Buyer
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-slate-400 text-[11px]">{r.date}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="flex text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-current' : 'text-slate-200'}`} />
                          ))}
                        </div>
                        <span className="font-bold text-slate-900 text-xs">{r.title}</span>
                      </div>

                      <p className="text-slate-600 leading-relaxed font-normal text-xs">
                        {r.comment}
                      </p>

                      <div className="pt-1 flex items-center space-x-2 text-[11px] text-slate-500">
                        <button
                          onClick={() => handleHelpfulVote(r.id)}
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                            r.userVoted
                              ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Helpful ({r.helpfulCount})</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* FULLSCREEN LIGHTBOX / HIGH-RES ZOOM MODAL */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute top-4 right-4 flex items-center space-x-3 z-70">
            <div className="bg-white/10 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-xl border border-white/20 font-mono">
              Scale: {Math.round(zoomScale * 100)}%
            </div>
            <button
              onClick={() => setZoomScale(prev => Math.min(prev + 0.5, 3.5))}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl cursor-pointer"
              title="Zoom In"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setZoomScale(prev => Math.max(prev - 0.5, 1.0))}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setIsZoomOpen(false);
                setZoomScale(1.5);
              }}
              className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer transition-colors ml-2"
              title="Close Zoom"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative max-w-4xl max-h-[85vh] overflow-auto rounded-3xl p-4 flex items-center justify-center">
            <img
              src={galleryImages[activeImageIndex]}
              alt={product.name}
              style={{ transform: `scale(${zoomScale})`, transition: 'transform 0.2s ease-out' }}
              className="max-h-[80vh] object-contain rounded-2xl cursor-grab active:cursor-grabbing select-none"
            />
          </div>

          <div className="absolute bottom-6 flex items-center space-x-2 overflow-x-auto p-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10">
            {galleryImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  activeImageIndex === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60'
                }`}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-contain bg-white/10" />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
