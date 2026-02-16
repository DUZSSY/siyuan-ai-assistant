/**
 * 环境检测工具
 * 用于检测当前运行环境，判断是否需要在浏览器/移动端使用代理模式
 */

/**
 * 检测是否在浏览器环境（网络伺服器模式）
 */
export function isBrowserEnvironment(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    
    // 通过协议判断：http:// 或 https:// 表示在浏览器地址栏中访问
    const protocol = window.location.protocol;
    return protocol === 'http:' || protocol === 'https:';
}

/**
 * 检测是否在移动端环境（手机/平板浏览器或App）
 */
export function isMobileEnvironment(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
}

/**
 * 检测是否在 Docker 容器环境（通过思源配置）
 */
export function isDockerEnvironment(): boolean {
    try {
        const siyuan = (window as any).siyuan;
        return siyuan?.config?.system?.container === 'docker';
    } catch {
        return false;
    }
}

/**
 * 检测是否在受限环境（需要代理转发）
 * 包括：浏览器、移动端App
 * 注意：Docker 环境本身不需要代理，但如果通过浏览器访问 Docker 部署的思源，
 * 则会被 isBrowserEnvironment() 捕获
 */
export function isRestrictedEnvironment(): boolean {
    return isBrowserEnvironment() || isMobileEnvironment();
}

/**
 * 检测是否是局域网 Ollama 地址
 */
export function isLanOllama(baseURL: string): boolean {
    return /^(http:\/\/)?(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(baseURL);
}

/**
 * 获取当前环境信息（用于调试）
 */
export function getEnvironmentInfo(): {
    isBrowser: boolean;
    isMobile: boolean;
    isRestricted: boolean;
    protocol: string;
    userAgent: string;
    origin: string;
} {
    return {
        isBrowser: isBrowserEnvironment(),
        isMobile: isMobileEnvironment(),
        isRestricted: isRestrictedEnvironment(),
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown'
    };
}
