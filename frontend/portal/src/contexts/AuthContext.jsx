/**
 * AuthContext - 认证上下文
 * 管理用户认证状态、登录、注册和会话持久化
 * 为整个应用提供认证相关的功能和状态
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// API 基础 URL - 从环境变量读取或使用默认值 "/api"
const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

// localStorage 中存储凭证的键名
const STORAGE_KEY = "portal.auth.credentials";

// 创建认证上下文
const AuthContext = createContext(null);

/**
 * 从 localStorage 读取已存储的凭证
 * @returns {Object|null} 返回包含 token 和 user 的对象，或 null
 */
function readStoredCredentials() {
  // 服务端渲染时不执行
  if (typeof window === "undefined") return null;

  try {
    // 从 localStorage 读取原始数据
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // 解析 JSON 数据
    const parsed = JSON.parse(raw);

    // 验证数据格式是否正确（必须包含 token）
    if (parsed && typeof parsed === "object" && parsed.token) {
      return parsed;
    }
  } catch (error) {
    console.warn("Unable to parse stored credentials", error);
  }
  return null;
}

/**
 * 将凭证持久化到 localStorage
 * @param {Object|null} data - 要存储的凭证数据，或 null 表示清除
 */
function persistCredentials(data) {
  // 服务端渲染时不执行
  if (typeof window === "undefined") return;

  // 如果 data 为 null，则删除存储的凭证
  if (!data) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  // 将凭证序列化为 JSON 并存储
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * AuthProvider 组件
 * 认证状态提供者，包裹应用以提供认证功能
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 */
export function AuthProvider({ children }) {
  // 当前登录的用户信息
  const [user, setUser] = useState(null);

  // JWT 认证令牌
  const [token, setToken] = useState("");

  // 初始化状态标记（用于从 localStorage 恢复会话）
  const [initializing, setInitializing] = useState(true);

  // 操作状态：'idle'（空闲）或 'pending'（处理中）
  const [status, setStatus] = useState("idle");

  const sessionExpiredHandling = useRef(false);

  /**
   * 应用会话状态
   * 更新 token 和 user，并持久化到 localStorage
   * @param {string} nextToken - 新的 JWT token
   * @param {Object|null} nextUser - 新的用户信息
   */
  const applySession = useCallback((nextToken, nextUser) => {
    // 更新 token 状态
    if (nextToken) {
      setToken(nextToken);
    } else {
      setToken("");
    }

    // 更新用户状态
    setUser(nextUser || null);

    // 持久化到 localStorage
    if (nextToken) {
      persistCredentials({ token: nextToken, user: nextUser || null });
    } else {
      persistCredentials(null);
    }
  }, []);

  /**
   * 登出函数
   * 清除所有认证状态和存储的凭证
   */
  const logout = useCallback(() => {
    applySession("", null);
  }, [applySession]);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    window.location.replace(`${base}/login`);
  }, []);

  const handleSessionExpired = useCallback(
    () => {
      if (sessionExpiredHandling.current) return;
      sessionExpiredHandling.current = true;
      logout();
      redirectToLogin();
    },
    [logout, redirectToLogin]
  );

  /**
   * 从服务器获取用户资料
   * 用于刷新用户信息或验证 token 是否仍然有效
   * @param {string} sessionToken - 可选的 token，未提供时使用当前 token
   * @returns {Promise<Object|null>} 用户信息或 null
   */
  const fetchProfile = useCallback(
    async (sessionToken) => {
      // 使用提供的 token 或当前 token
      const activeToken = sessionToken || token;
      if (!activeToken) return null;

      try {
        // 向后端请求用户信息
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${activeToken}`,
            "X-Portal-Authorization": `Bearer ${activeToken}`,
            "X-Auth-Token": activeToken,
          },
        });

        // 检查响应是否成功
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }

        // 解析响应数据
        const data = await res.json();

        // 如果返回了用户信息，更新会话
        if (data?.user) {
          applySession(activeToken, data.user);
          return data.user;
        }
      } catch (error) {
        console.warn("Unable to refresh profile", error);
        // 不立即登出 - 只有在显式刷新调用时才登出
        // 初始化期间不自动登出
      }
      return null;
    },
    [applySession, token]
  );

  /**
   * 初始化效果：从 localStorage 恢复会话
   * 组件挂载时执行一次
   */
  useEffect(() => {
    // 读取缓存的凭证
    const cached = readStoredCredentials();

    if (cached?.token) {
      // 恢复会话状态
      applySession(cached.token, cached.user || null);

      // 如果缓存中没有用户数据，从服务器获取
      if (!cached.user) {
        fetchProfile(cached.token).finally(() => setInitializing(false));
      } else {
        setInitializing(false);
      }
    } else {
      // 没有缓存的凭证，初始化完成
      setInitializing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时运行一次

  /**
   * 登录函数
   * 使用邮箱和密码登录
   * @param {Object} credentials - 登录凭证
   * @param {string} credentials.email - 邮箱地址
   * @param {string} credentials.password - 密码
   * @returns {Promise<Object|null>} 用户信息或 null
   * @throws {Error} 登录失败时抛出错误
   */
  const login = useCallback(
    async ({ email, password }) => {
      setStatus("pending"); // 设置为处理中状态

      try {
        // 向后端发送登录请求
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        // 检查响应状态
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Invalid email or password");
        }

        // 解析响应数据
        const data = await res.json();

        // 验证响应中是否包含 token
        if (!data?.token) {
          throw new Error("Authentication response missing token");
        }

        // 应用新的会话
        applySession(data.token, data.user || null);
        return data.user || null;
      } finally {
        // 无论成功还是失败，都恢复为空闲状态
        setStatus("idle");
      }
    },
    [applySession]
  );

  const updateProfile = useCallback(
    async ({ name }) => {
      if (!token) throw new Error('Not authenticated');
      setStatus('pending');
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Portal-Authorization': `Bearer ${token}`,
            'X-Auth-Token': token,
          },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to update profile (${res.status})`);
        }
        const data = await res.json();
        if (data?.user) {
          applySession(token, data.user);
          return data.user;
        }
        return null;
      } finally {
        setStatus('idle');
      }
    },
    [applySession, token]
  );

  const changePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      if (!token) throw new Error('Not authenticated');
      setStatus('pending');
      try {
        const res = await fetch(`${API_BASE}/auth/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Portal-Authorization': `Bearer ${token}`,
            'X-Auth-Token': token,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to update password (${res.status})`);
        }
        return true;
      } finally {
        setStatus('idle');
      }
    },
    [token]
  );

  /**
   * 注册函数
   * 创建新用户账户
   * @param {Object} credentials - 注册信息
   * @param {string} credentials.email - 邮箱地址
   * @param {string} credentials.password - 密码
   * @param {string} credentials.name - 用户名（可选）
   * @returns {Promise<Object|null>} 用户信息或 null
   * @throws {Error} 注册失败时抛出错误
   */
  const register = useCallback(
    async ({ email, password, name }) => {
      setStatus("pending"); // 设置为处理中状态

      try {
        // 向后端发送注册请求
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        // 检查响应状态
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Unable to register");
        }

        // 解析响应数据
        const data = await res.json();

        // 验证响应中是否包含 token
        if (!data?.token) {
          throw new Error("Registration response missing token");
        }

        // 应用新的会话（自动登录）
        applySession(data.token, data.user || null);
        return data.user || null;
      } finally {
        // 无论成功还是失败，都恢复为空闲状态
        setStatus("idle");
      }
    },
    [applySession]
  );

  /**
   * 上下文值 - 使用 useMemo 优化性能
   * 包含所有认证相关的状态和方法
   */
  const value = useMemo(
    () => ({
      user, // 当前用户信息
      token, // JWT 认证令牌
      initializing, // 是否正在初始化
      status, // 操作状态（'idle' 或 'pending'）
      isAuthenticated: Boolean(user && token), // 是否已认证
      login, // 登录方法
      register, // 注册方法
      logout, // 登出方法
      refreshProfile: fetchProfile, // 刷新用户资料方法
      updateProfile,
      changePassword,
      handleSessionExpired,
    }),
    [
      changePassword,
      fetchProfile,
      handleSessionExpired,
      initializing,
      login,
      logout,
      register,
      status,
      token,
      updateProfile,
      user,
    ]
  );

  // 提供上下文给子组件
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook
 * 在任何组件中使用此 Hook 来访问认证上下文
 * @returns {Object} 认证上下文对象
 * @throws {Error} 如果在 AuthProvider 外部使用则抛出错误
 */
export function useAuth() {
  const context = useContext(AuthContext);

  // 确保在 AuthProvider 内部使用
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
