import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User, CustomerProfile } from '../services/api';

interface AuthContextType {
  // Admin Session
  user: User | null;
  adminToken: string | null;
  adminLogin: (emailOrUsername: string, password: string) => Promise<boolean>;
  adminRegister: (data: any) => Promise<boolean>;
  adminLogout: () => void;

  // Customer Session
  customer: CustomerProfile | null;
  customerToken: string | null;
  customerLogin: (identifier: string, password: string) => Promise<boolean>;
  customerRegister: (data: any) => Promise<boolean>;
  customerPortalRegister: (data: { name: string; email: string; phone: string; password: string; preferred_language?: string }) => Promise<{ success: boolean; message?: string }>;
  customerPortalLogin: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
  customerLogout: () => void;
  refreshCustomer: () => Promise<void>;

  // Portal State & Navigation
  portalMode: 'admin' | 'customer' | 'store';
  setPortalMode: (mode: 'admin' | 'customer' | 'store') => void;
  cartCount: number;
  setCartCount: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
  pendingHandoffsCount: number;
  setPendingHandoffsCount: React.Dispatch<React.SetStateAction<number>>;

  // Backward compatible login/logout for existing views
  token: string | null;
  login: (emailOrUsername: string, password: string) => Promise<boolean>;
  userLogin: (data: { name: string; email: string; phone: string }) => Promise<boolean>;
  register: (data: any) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('nexora_token'));
  
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(localStorage.getItem('nexora_customer_token'));
  
  const [portalMode, setPortalModeState] = useState<'admin' | 'customer' | 'store'>(() => {
    // 1. Check URL parameters and hash first
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('portal');
    const hash = window.location.hash.toLowerCase();
    if (param === 'admin' || hash.includes('admin') || window.location.pathname.includes('/admin')) {
      return 'admin';
    }
    if (param === 'store' || hash.includes('store')) {
      return 'store';
    }
    if (param === 'customer' || hash.includes('customer')) {
      return 'customer';
    }
    const saved = localStorage.getItem('nexora_portal_mode') as 'admin' | 'customer' | 'store';
    if (saved === 'admin' || saved === 'customer' || saved === 'store') {
      return saved;
    }
    return 'customer';
  });
  
  const [cartCount, setCartCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingHandoffsCount, setPendingHandoffsCount] = useState<number>(0);

  const setPortalMode = (mode: 'admin' | 'customer' | 'store') => {
    localStorage.setItem('nexora_portal_mode', mode);
    window.location.hash = mode;
    setPortalModeState(mode);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('admin')) {
        setPortalModeState('admin');
      } else if (hash.includes('store')) {
        setPortalModeState('store');
      } else if (hash.includes('customer')) {
        setPortalModeState('customer');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const refreshCustomer = async () => {
    const cToken = localStorage.getItem('nexora_customer_token') || sessionStorage.getItem('nexora_customer_token');
    if (cToken) {
      try {
        const res = await api.customerGetMe();
        setCustomer(res.data);
      } catch {
        localStorage.removeItem('nexora_customer_token');
        sessionStorage.removeItem('nexora_customer_token');
        setCustomerToken(null);
        setCustomer(null);
      }
    }
  };

  useEffect(() => {
    const initSessions = async () => {
      // 1. Check Admin / Staff Session
      const savedAdminToken = localStorage.getItem('nexora_token') || sessionStorage.getItem('nexora_token');
      if (savedAdminToken) {
        try {
          const res = await api.getMe();
          if (res.data && ['ADMIN', 'SUPERADMIN', 'AGENT'].includes(res.data.role?.toUpperCase())) {
            setUser(res.data);
            setAdminToken(savedAdminToken);
          } else {
            // Not a staff role
            localStorage.removeItem('nexora_token');
            sessionStorage.removeItem('nexora_token');
            setAdminToken(null);
            setUser(null);
          }
        } catch {
          localStorage.removeItem('nexora_token');
          sessionStorage.removeItem('nexora_token');
          setAdminToken(null);
          setUser(null);
        }
      }

      // 2. Check Customer Session
      const savedCustomerToken = localStorage.getItem('nexora_customer_token') || sessionStorage.getItem('nexora_customer_token');
      if (savedCustomerToken) {
        try {
          const res = await api.customerGetMe();
          setCustomer(res.data);
          setCustomerToken(savedCustomerToken);
          
          // Fetch initial cart count
          try {
            const cartRes = await api.getCart();
            setCartCount(cartRes.data?.items_count || 0);
          } catch {
            // Cart might be empty
          }
        } catch {
          localStorage.removeItem('nexora_customer_token');
          sessionStorage.removeItem('nexora_customer_token');
          setCustomerToken(null);
          setCustomer(null);
        }
      }

      setLoading(false);
    };

    initSessions();
  }, []);

  // Admin Auth Handlers
  const adminLogin = async (emailOrUsername: string, password: string): Promise<boolean> => {
    try {
      const res = await api.login({ username_or_email: emailOrUsername, email: emailOrUsername, password });
      const { access_token, user: loggedUser } = res.data;
      localStorage.setItem('nexora_token', access_token);
      localStorage.setItem('nexora_admin_token', access_token);
      sessionStorage.setItem('nexora_token', access_token);
      setAdminToken(access_token);
      setUser(loggedUser);
      setPortalMode('admin');
      return true;
    } catch (err) {
      console.error("Admin login failed:", err);
      return false;
    }
  };

  const userLogin = async (data: { name: string; email: string; phone: string }): Promise<boolean> => {
    try {
      const res = await api.userLogin(data);
      const { access_token, user: loggedUser } = res.data;
      localStorage.setItem('nexora_token', access_token);
      localStorage.setItem('nexora_admin_token', access_token);
      sessionStorage.setItem('nexora_token', access_token);
      setAdminToken(access_token);
      setUser(loggedUser);
      return true;
    } catch (err) {
      console.error("User login failed:", err);
      return false;
    }
  };

  const adminRegister = async (data: any): Promise<boolean> => {
    try {
      const res = await api.register(data);
      const { access_token, user: registeredUser } = res.data;
      localStorage.setItem('nexora_token', access_token);
      localStorage.setItem('nexora_admin_token', access_token);
      sessionStorage.setItem('nexora_token', access_token);
      setAdminToken(access_token);
      setUser(registeredUser);
      setPortalMode('admin');
      return true;
    } catch (err) {
      console.error("Admin registration failed:", err);
      return false;
    }
  };

  const adminLogout = () => {
    localStorage.removeItem('nexora_token');
    localStorage.removeItem('nexora_admin_token');
    sessionStorage.removeItem('nexora_token');
    sessionStorage.removeItem('nexora_admin_token');
    setAdminToken(null);
    setUser(null);
    setPortalMode('customer');
  };

  // Customer Auth Handlers
  const customerLogin = async (identifier: string, password: string): Promise<boolean> => {
    try {
      const res = await api.customerLogin({ identifier, password });
      const { access_token, customer: loggedCustomer } = res.data;
      localStorage.setItem('nexora_customer_token', access_token);
      sessionStorage.setItem('nexora_customer_token', access_token);
      setCustomerToken(access_token);
      setCustomer(loggedCustomer);
      
      // Update cart count
      try {
        const cartRes = await api.getCart();
        setCartCount(cartRes.data.items_count || 0);
      } catch {}

      return true;
    } catch (err) {
      console.error("Customer login failed:", err);
      return false;
    }
  };

  const customerRegister = async (data: any): Promise<boolean> => {
    try {
      const res = await api.customerRegister(data);
      const { access_token, customer: regCustomer } = res.data;
      localStorage.setItem('nexora_customer_token', access_token);
      sessionStorage.setItem('nexora_customer_token', access_token);
      setCustomerToken(access_token);
      setCustomer(regCustomer);
      setCartCount(0);
      return true;
    } catch (err) {
      console.error("Customer registration failed:", err);
      return false;
    }
  };

  const customerPortalRegister = async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    preferred_language?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.customerPortalRegister(data);
      const { access_token, user: loggedUser } = res.data;
      localStorage.setItem('nexora_customer_token', access_token);
      sessionStorage.setItem('nexora_customer_token', access_token);
      setCustomerToken(access_token);
      try {
        const cRes = await api.customerGetMe();
        setCustomer(cRes.data);
      } catch {
        setCustomer({
          id: loggedUser.id,
          customer_code: `CUST-${loggedUser.id.slice(0, 6).toUpperCase()}`,
          name: loggedUser.full_name,
          phone: loggedUser.phone || data.phone,
          email: loggedUser.email,
          preferred_language: data.preferred_language || 'en',
          total_orders_count: 0,
          created_at: new Date().toISOString()
        });
      }
      return { success: true };
    } catch (err: any) {
      console.error("Customer registration failed:", err);
      const msg = err.response?.data?.detail || "Registration failed. Please verify your details.";
      return { success: false, message: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
  };

  const customerPortalLogin = async (identifier: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.customerPortalLogin({ identifier, password });
      const { access_token, user: loggedUser } = res.data;
      localStorage.setItem('nexora_customer_token', access_token);
      sessionStorage.setItem('nexora_customer_token', access_token);
      setCustomerToken(access_token);
      try {
        const cRes = await api.customerGetMe();
        setCustomer(cRes.data);
      } catch {
        setCustomer({
          id: loggedUser.id,
          customer_code: `CUST-${loggedUser.id.slice(0, 6).toUpperCase()}`,
          name: loggedUser.full_name,
          phone: loggedUser.phone || identifier,
          email: loggedUser.email,
          preferred_language: 'en',
          total_orders_count: 0,
          created_at: new Date().toISOString()
        });
      }
      return { success: true };
    } catch (err: any) {
      console.error("Customer login failed:", err);
      const msg = err.response?.data?.detail || "Invalid mobile number/email or password.";
      return { success: false, message: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
  };

  const customerLogout = () => {
    localStorage.removeItem('nexora_customer_token');
    sessionStorage.removeItem('nexora_customer_token');
    setCustomerToken(null);
    setCustomer(null);
    setCartCount(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        adminToken,
        adminLogin,
        adminRegister,
        adminLogout,

        customer,
        customerToken,
        customerLogin,
        customerRegister,
        customerPortalRegister,
        customerPortalLogin,
        customerLogout,
        refreshCustomer,

        portalMode,
        setPortalMode,
        cartCount,
        setCartCount,
        loading,
        pendingHandoffsCount,
        setPendingHandoffsCount,

        // Backward compatible mappings
        token: adminToken,
        login: adminLogin,
        userLogin,
        register: adminRegister,
        logout: adminLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
