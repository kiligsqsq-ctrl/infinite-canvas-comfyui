const dns = require("node:dns").promises;
const net = require("node:net");

function isPrivateIp(input) {
    const ip = input.toLowerCase().replace(/^\[|\]$/g, "");
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number);
        return a === 10
            || a === 127
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168);
    }
    if (!net.isIPv6(ip)) return false;
    if (ip === "::1") return true;
    if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true;
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    return Boolean(mapped && isPrivateIp(mapped[1]));
}

async function assertLocalTarget(value, lookup = dns.lookup) {
    let target;
    try {
        target = new URL(value);
    } catch {
        throw new Error("本地服务地址无效");
    }
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
        throw new Error("只允许访问不含账号密码的 HTTP/HTTPS 本地服务");
    }
    const hostname = target.hostname.replace(/^\[|\]$/g, "");
    if (hostname.toLowerCase() === "localhost") return target;
    if (net.isIP(hostname)) {
        if (!isPrivateIp(hostname)) throw new Error("桌面代理只允许访问本机或局域网地址");
        return target;
    }
    let addresses;
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw new Error(`无法解析本地服务地址：${hostname}`);
    }
    if (!addresses.length || addresses.some(({ address }) => !isPrivateIp(address))) {
        throw new Error("桌面代理只允许访问解析到本机或局域网的地址");
    }
    return target;
}

module.exports = { assertLocalTarget, isPrivateIp };
