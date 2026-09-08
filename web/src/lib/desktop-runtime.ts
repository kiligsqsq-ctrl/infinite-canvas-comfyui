import axios, { type InternalAxiosRequestConfig } from "axios";

const DESKTOP_PROXY_ORIGIN = "canvas-local://proxy/";
let installed = false;

export function isDesktopRuntime() {
    return window.infiniteCanvasDesktop?.isDesktop === true;
}

export function installDesktopNetworkBridge() {
    if (installed || !isDesktopRuntime()) return;
    installed = true;
    installFetchProxy();
    axios.interceptors.request.use(proxyAxiosRequest);
}

function installFetchProxy() {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const target = requestUrl(input);
        if (!target || !shouldProxy(target)) return nativeFetch(input, init);
        const proxyUrl = desktopProxyUrl(target);
        if (!(input instanceof Request)) return nativeFetch(proxyUrl, init);
        const request = new Request(input, init);
        return nativeFetch(new Request(proxyUrl, request));
    }) as typeof window.fetch;
}

function proxyAxiosRequest(config: InternalAxiosRequestConfig) {
    if (!config.url) return config;
    const target = absoluteUrl(axios.getUri(config));
    if (!target || !shouldProxy(target)) return config;
    config.url = desktopProxyUrl(target);
    config.baseURL = undefined;
    config.params = undefined;
    config.paramsSerializer = undefined;
    return config;
}

function requestUrl(input: RequestInfo | URL) {
    const value = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    return absoluteUrl(value);
}

function absoluteUrl(value: string) {
    try {
        return new URL(value, window.location.href).href;
    } catch {
        return "";
    }
}

function desktopProxyUrl(target: string) {
    const url = new URL(DESKTOP_PROXY_ORIGIN);
    url.searchParams.set("url", target);
    return url.href;
}

function shouldProxy(value: string) {
    try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && isLocalHostname(url.hostname);
    } catch {
        return false;
    }
}

function isLocalHostname(value: string) {
    const hostname = value.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".lan")) return true;
    if (!hostname.includes(".") && !hostname.includes(":")) return true;
    if (hostname.includes(":")) return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe8") || hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb");
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10
        || parts[0] === 127
        || (parts[0] === 169 && parts[1] === 254)
        || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
        || (parts[0] === 192 && parts[1] === 168);
}
