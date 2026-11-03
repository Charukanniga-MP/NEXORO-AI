import axios from 'axios';

export const API_BASE = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT token (Admin or Customer), checking tab-isolated sessionStorage first
apiClient.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem('nexora_token') ||
    sessionStorage.getItem('nexora_customer_token') ||
    localStorage.getItem('nexora_token') ||
    localStorage.getItem('nexora_customer_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API Service Interfaces
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  department: string;
  status: string;
  extension: string;
}

export interface CustomerProfile {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  preferred_language: string;
  total_orders_count: number;
  avatar_url?: string;
  upi_id?: string;
  wallet_balance?: number;
  pay_later_limit?: number;
  pay_later_available?: number;
  created_at: string;
}

export interface DashboardKPIs {
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  answered_calls: number;
  missed_calls: number;
  active_calls: number;
  avg_duration_seconds: number;
  avg_latency_ms: number;
  csat_score: number;
  handoff_rate_percent: number;
  resolved_by_ai_percent: number;
  peak_concurrency?: number;
  queue_size?: number;
  data_source: string;
  // E-Commerce KPIs
  total_customers?: number;
  total_orders?: number;
  today_orders?: number;
  successful_payments?: number;
  pending_payments?: number;
  cancelled_orders?: number;
  total_revenue?: number;
  ai_calls_completed?: number;
  ai_calls_pending?: number;
  ai_calls_failed?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  product_count?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  original_price?: number;
  discount_pct?: number;
  currency: string;
  image_url?: string;
  rating?: number;
  reviews_count?: number;
  stock_quantity?: number;
  reorder_level?: number;
  in_stock?: boolean;
  delivery_estimate?: string;
  specifications?: Record<string, any>;
  source_marketplace?: string; // Only present in admin views
  is_active: boolean;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  image_url?: string;
  price: number;
  quantity: number;
  total: number;
}

export interface CartData {
  items: CartItem[];
  items_count: number;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  coupon_code?: string;
  final_amount: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: Array<{ sku: string; name: string; quantity: number; unit_price: number; total: number; image_url?: string }>;
  subtotal?: number;
  delivery_fee?: number;
  discount_amount?: number;
  coupon_code?: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  payment_method: string;
  transaction_id?: string;
  tracking_number?: string;
  courier_name?: string;
  estimated_delivery?: string;
  shipping_address?: string;
  ai_call_status?: string;
  ai_call_id?: string;
  ai_call_summary?: string;
  customer_confirmed?: boolean;
  preferred_language?: string;
  created_at: string;
  updated_at?: string;
}

export interface AICallLog {
  id: string;
  order_id?: string;
  order_number?: string;
  customer_id?: string;
  customer_code?: string;
  customer_name?: string;
  phone_number: string;
  preferred_language: string;
  call_initiation_time: string;
  duration_seconds: number;
  call_status: string;
  confirmation_status?: string;
  summary?: string;
  transcript: Array<{ speaker: string; text: string; timestamp: string; language?: string }>;
  recording_url?: string;
  retry_count: number;
}

export interface AICallingStats {
  total_calls: number;
  completed_calls: number;
  confirmed_orders: number;
  cancelled_orders: number;
  unanswered_calls: number;
  failed_calls: number;
  avg_duration_seconds: number;
  language_distribution: Record<string, number>;
}

export interface CallRecord {
  id: string;
  caller_number: string;
  receiver_number: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  language: string;
  detected_languages: string[];
  duration_seconds: number;
  latency_ms: number;
  transcript: Array<{ speaker: string; text: string; timestamp: string; language?: string; grounded?: boolean }>;
  summary?: string;
  intent?: string;
  sentiment?: string;
  outcome?: string;
  transferred_to_user_id?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  customer_code?: string;
  phone: string;
  name: string;
  email?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  preferred_language: string;
  company_name?: string;
  notes?: string;
  tags: string[];
  consent_for_outbound: boolean;
  dnd_opt_out: boolean;
  total_calls_count: number;
  total_orders_count?: number;
  last_contacted_at?: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  appointment_number: string;
  customer_id: string;
  employee_id?: string;
  service_name: string;
  scheduled_time: string;
  duration_minutes: number;
  status: string;
  location_type: string;
  location_details?: string;
  notes?: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  ticket_number: string;
  customer_id: string;
  order_id?: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to_id?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

export interface HandoffTicket {
  id: string;
  call_id: string;
  customer_id?: string;
  assigned_user_id?: string;
  target_department: string;
  status: string;
  reason: string;
  ai_summary: string;
  context_notes: Record<string, any>;
  customer_name: string;
  customer_phone: string;
  customer_language: string;
  created_at: string;
  resolved_at?: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  doc_category: string;
  chunks_count: number;
  status: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  script_prompt: string;
  target_language: string;
  scheduled_at?: string;
  status: string;
  total_leads: number;
  completed_calls: number;
  successful_outcomes: number;
  failed_calls: number;
  respect_dnd: boolean;
  require_prior_consent: boolean;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  industry?: string;
  phone?: string;
  email?: string;
  address?: string;
  receptionist_name: string;
  default_language: string;
  supported_languages: string[];
  greeting_template?: string;
  telephony_mode: string;
  handoff_phone?: string;
  sip_server?: string;
  auto_handoff_on_low_confidence?: boolean;
}

// API Methods
export const api = {
  // Admin & Agent Auth
  login: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
  userLogin: (data: { name: string; email: string; phone: string }) => apiClient.post('/auth/user-login', data),
  customerPortalRegister: (data: { name: string; email: string; phone: string; password: string; preferred_language?: string }) =>
    apiClient.post<{ access_token: string; token_type: string; user: User }>('/auth/customer-register', data),
  customerPortalLogin: (data: { identifier: string; password: string }) =>
    apiClient.post<{ access_token: string; token_type: string; user: User }>('/auth/customer-login', data),
  register: (data: any) => apiClient.post('/auth/register', data),
  getMe: () => apiClient.get<User>('/auth/me'),

  // Customer Auth
  customerRegister: (data: {
    name: string;
    phone: string;
    email?: string;
    password: string;
    address_line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    preferred_language?: string;
  }) => apiClient.post<{ access_token: string; token_type: string; customer: CustomerProfile }>('/customer/auth/register', data),

  customerLogin: (data: { identifier: string; password: string }) =>
    apiClient.post<{ access_token: string; token_type: string; customer: CustomerProfile }>('/customer/auth/login', data),

  customerGetMe: () => apiClient.get<CustomerProfile>('/customer/auth/me'),
  customerUpdateProfile: (data: Partial<CustomerProfile>) => apiClient.put<CustomerProfile>('/customer/auth/profile', data),

  // Public E-Commerce Store & Catalog
  getFestivalOffer: (month?: number) => apiClient.get<any>('/products/festival-offer', { params: { month } }),
  getCategories: () => apiClient.get<Category[]>('/products/categories'),
  getPublicProducts: (params?: { search?: string; category?: string; sort_by?: string; min_price?: number; max_price?: number; limit?: number; offset?: number }) =>
    apiClient.get<Product[]>('/products/public', { params }),
  getPublicProduct: (productId: string) => apiClient.get<Product>(`/products/public/${productId}`),
  askAIAboutProduct: (productId: string, question: string, language: string = 'en') =>
    apiClient.post<{ answer: string; language: string; product_id: string; product_name: string; status: string }>(
      `/products/public/${productId}/ask-ai`,
      { question, language }
    ),
  addProductReview: (productId: string, data: { name: string; rating: number; title: string; comment: string }) =>
    apiClient.post<{ status: string; review: any; rating: number; reviews_count: number }>(
      `/products/public/${productId}/reviews`,
      data
    ),

  // Shopping Cart
  getCart: () => apiClient.get<CartData>('/cart'),
  addToCart: (productId: string, quantity: number = 1) => apiClient.post<CartData>('/cart/add', { product_id: productId, quantity }),
  updateCartItem: (productId: string, quantity: number) => apiClient.put<CartData>('/cart/item', { product_id: productId, quantity }),
  removeFromCart: (productId: string) => apiClient.delete<CartData>(`/cart/item/${productId}`),
  applyCoupon: (couponCode: string) => apiClient.post<CartData>('/cart/apply-coupon', { coupon_code: couponCode }),
  clearCart: () => apiClient.delete('/cart/clear'),

  // Checkout & Customer Orders
  checkoutCart: (data: {
    shipping_address: string;
    city?: string;
    state?: string;
    pincode?: string;
    payment_method: string;
    preferred_language?: string;
    delivery_notes?: string;
  }) => apiClient.post<{ success: boolean; message: string; order: any; ai_call: any }>('/orders/checkout', data),

  getMyOrders: () => apiClient.get<Order[]>('/orders/my-orders'),

  // Payments
  createPaymentOrder: (orderId: string) => apiClient.post('/payments/create-order', { order_id: orderId }),
  verifyPayment: (data: {
    order_id: string;
    payment_method: string;
    gateway_payment_id?: string;
    gateway_order_id?: string;
    gateway_signature?: string;
    simulate_call_outcome?: string;
  }) => apiClient.post('/payments/verify', data),

  // AI Outbound Voice Calling Management
  getAICallLogs: (params?: { status?: string; language?: string; search?: string }) =>
    apiClient.get<AICallLog[]>('/ai-calling/logs', { params }),
  retryAICall: (callId: string) => apiClient.post(`/ai-calling/retry/${callId}`),
  getAICallingStats: () => apiClient.get<AICallingStats>('/ai-calling/stats'),
  triggerAIOrderCall: (orderId: string, outcome: string = 'CONFIRMED') =>
    apiClient.post(`/orders/${orderId}/trigger-ai-call`, null, { params: { outcome } }),

  // Admin Dashboard & Telemetry
  getDashboardKPIs: () => apiClient.get<DashboardKPIs>('/dashboard/kpis'),
  getKPIs: () => apiClient.get<DashboardKPIs>('/dashboard/kpis'),
  getTelephonyStatus: () => apiClient.get('/dashboard/telephony-status'),
  // Analytics & Metrics
  getAnalyticsSummary: () => apiClient.get('/analytics/summary'),
  getLanguagesDistribution: () => apiClient.get<any[]>('/analytics/languages'),
  getLanguageDistribution: () => apiClient.get<any[]>('/analytics/languages'),
  getHourlyTrends: () => apiClient.get<any[]>('/analytics/hourly-trends'),
  getCallTrends: () => apiClient.get<any[]>('/analytics/trends'),
  getEmployeePerformance: () => apiClient.get<any[]>('/analytics/employee-performance'),
  getQueryCategories: () => apiClient.get<any[]>('/analytics/query-categories'),
  getQueueMetrics: () => apiClient.get<any>('/calls/queue-metrics'),
  simulateLoad: (callsCount: number = 100, concurrency: number = 10) =>
    apiClient.post<any>('/calls/simulate-load', null, { params: { calls_count: callsCount, concurrency } }),

  // Real-time Call Signaling & Requests


  // Calls
  getCalls: (params?: any) => apiClient.get<CallRecord[]>('/calls', { params }),
  listCalls: (params?: any) => apiClient.get<CallRecord[]>('/calls', { params }),
  getCall: (id: string) => apiClient.get<CallRecord>(`/calls/${id}`),
  getCallById: (id: string) => apiClient.get<CallRecord>(`/calls/${id}`),

  // Live Calls Interactive Studio
  startCall: (callerNumber: any, language?: string) =>
    typeof callerNumber === 'object'
      ? apiClient.post('/live-calls/start', callerNumber)
      : apiClient.post('/live-calls/start', null, { params: { caller_number: callerNumber, language } }),
  requestCall: (params?: { caller_number?: string; caller_name?: string; language?: string; customer_id?: string }) =>
    apiClient.post('/live-calls/request-call', null, { params }),
  acceptCall: (call_id: string, agent_id?: string) =>
    apiClient.post(`/live-calls/${call_id}/accept`, { agent_id, call_id }, { params: { agent_id, call_id } }),
  rejectCall: (call_id: string, reason?: string) =>
    apiClient.post(`/live-calls/${call_id}/reject`, null, { params: { reason } }),
  cancelCall: (call_id: string) =>
    apiClient.post(`/live-calls/${call_id}/cancel`),
  agentSpeak: (call_id: string, text: string, language?: string) =>
    apiClient.post('/live-calls/agent-speak', { call_id, text, language }),
  getPendingCallRequests: () =>
    apiClient.get<any[]>('/live-calls/pending-requests'),
  endCall: (callId: string, outcome?: string) => apiClient.post('/live-calls/end', null, { params: { call_id: callId, outcome } }),
  bargeIn: (callId: string) => apiClient.post('/live-calls/barge-in', null, { params: { call_id: callId } }),
  sendTurn: (callId: string | null, text: string, language?: string, imageUrls?: string[]) =>
    apiClient.post('/live-calls/turn', {
      call_id: callId,
      user_text: text,
      language: language || 'auto',
      image_urls: imageUrls || []
    }),
  uploadImages: (formData: FormData) =>
    apiClient.post('/live-calls/upload-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  synthesizeVoice: (text: string, language?: string, callId?: string) =>
    apiClient.post('/live-calls/synthesize-voice', { text, language, call_id: callId }),

  // Customers (Admin)
  getCustomers: (params?: any) => apiClient.get<Customer[]>('/customers', { params }),
  listCustomers: (params?: any) => apiClient.get<Customer[]>('/customers', { params }),
  getCustomerById: (id: string) => apiClient.get<Customer>(`/customers/${id}`),
  getCustomerOrders: (id: string) => apiClient.get<Order[]>(`/customers/${id}/orders`),
  createCustomer: (data: any) => apiClient.post<Customer>('/customers', data),
  updateCustomer: (id: string, data: any) => apiClient.put<Customer>(`/customers/${id}`, data),

  // Products (Admin)
  getProducts: (params?: any) => apiClient.get<Product[]>('/products', { params }),
  listProducts: (params?: any) => apiClient.get<Product[]>('/products', { params }),
  createProduct: (data: any) => apiClient.post<Product>('/products', data),
  updateProduct: (id: string, data: any) => apiClient.put<Product>(`/products/${id}`, data),
  deleteProduct: (id: string) => apiClient.delete(`/products/${id}`),
  syncMarketplaces: () => apiClient.post('/products/sync-marketplaces'),

  // Orders (Admin)
  getOrders: (params?: any) => apiClient.get<Order[]>('/orders', { params }),
  listOrders: (params?: any) => apiClient.get<Order[]>('/orders', { params }),
  getOrderById: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  updateOrder: (id: string, data: any) => apiClient.put<Order>(`/orders/${id}`, data),

  // Appointments Desk
  listAppointments: (params?: any) => apiClient.get<Appointment[]>('/appointments', { params }),
  checkAvailableSlots: (date: string, service?: string) => apiClient.get('/appointments/available-slots', { params: { date, service } }),
  createAppointment: (data: any) => apiClient.post<Appointment>('/appointments', data),
  updateAppointment: (id: string, data: any) => apiClient.put<Appointment>(`/appointments/${id}`, data),

  // Complaints Desk
  listComplaints: (params?: any) => apiClient.get<Complaint[]>('/complaints', { params }),
  createComplaint: (data: any) => apiClient.post<Complaint>('/complaints', data),
  updateComplaint: (id: string, data: any) => apiClient.put<Complaint>(`/complaints/${id}`, data),

  // Human Handoffs Desk
  listHandoffs: (params?: any) => apiClient.get<HandoffTicket[]>('/handoffs', { params }),
  acceptHandoff: (id: string, agentId?: string) => apiClient.post(`/handoffs/${id}/accept`, { agent_id: agentId }),
  rejectHandoff: (id: string, agentId?: string) => apiClient.post(`/handoffs/${id}/reject`, { agent_id: agentId }),
  resolveHandoff: (id: string, notes?: string) => apiClient.post(`/handoffs/${id}/resolve`, { notes }),

  // Outbound Campaigns
  listCampaigns: (params?: any) => apiClient.get<Campaign[]>('/campaigns', { params }),
  createCampaign: (data: any) => apiClient.post<Campaign>('/campaigns', data),
  launchCampaign: (id: string) => apiClient.post(`/campaigns/${id}/launch`),

  // Employees & Team
  listEmployees: () => apiClient.get<User[]>('/employees'),
  updateEmployeeStatus: (id: string, status: string) => apiClient.put(`/employees/${id}/status`, { status }),

  // Knowledge Base
  getKnowledgeDocs: () => apiClient.get<KnowledgeDoc[]>('/knowledge/docs'),
  listKnowledgeDocs: () => apiClient.get<KnowledgeDoc[]>('/knowledge/docs'),
  uploadKnowledgeDoc: (formData: FormData) => apiClient.post<KnowledgeDoc>('/knowledge/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteDoc: (id: string) => apiClient.delete(`/knowledge/docs/${id}`),
  testKnowledgeSearch: (query: string) => apiClient.post('/knowledge/search', { query }),
  getDocChunks: (id: string) => apiClient.get(`/knowledge/docs/${id}/chunks`),

  // AI Config & Settings
  getAIConfig: () => apiClient.get('/ai-config'),
  updateAIConfig: (data: any) => apiClient.put('/ai-config', data),
  testDetector: (text: string) => apiClient.post('/ai-config/test-detector', { text }),
  testGrounding: (query: string, threshold?: number) => apiClient.post('/ai-config/test-grounding', { query, threshold }),
  getSettings: () => apiClient.get<CompanySettings>('/settings'),
  updateSettings: (data: any) => apiClient.put<CompanySettings>('/settings', data),

  // Live Audio Streaming Turn
  sendAudioTurn: (formData: FormData) => apiClient.post('/live-calls/audio-turn', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
