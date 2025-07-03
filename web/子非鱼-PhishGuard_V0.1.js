// ==UserScript==
// @name         子非鱼 - PhishGuard 目前最好的版本
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  企业级钓鱼检测解决方案，支持三引擎检测与实时防护
// @author       Manus AI
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      127.0.0.1
// @connect      api.deepseek.com
// @connect      phishguard-api.example.com
// ==/UserScript==

(function() {
'use strict';

if (window.top !== window.self) return;

// ================== 全局配置 ==================
const CONFIG = {
    LOCAL_MODEL_URL: 'http://localhost:5000/models/4.7.2.ubj',
    CLOUD_API: 'https://phishguard-api.example.com/v1/detect',
    LOCAL_THRESHOLD: 0.68,
    ALLOWED_KEY: 'allowed_urls_v5',
    SINGLE_DOMAINS: GM_getValue('phishguard_single_domains', ["gov.cn", "12377.cn", "baidu.com"]),
    WILDCARD_DOMAINS: GM_getValue('phishguard_wildcard_domains', ["*.google.com", "*.microsoft.com"]),
    MUSIC_URL: 'https://www.soundjay.com/button/sounds/button-3.mp3',
    CACHE_TIME: 3600 * 24 * 7,
    REQUEST_TIMEOUT: 10000,
    DEBUG_MODE: true,
    // 已添加提供的DeepSeek API密钥
    DEEPSEEK_API_KEY: GM_getValue('phishguard_deepseek_api_key', 'sk-53a951f38a694799b7f8864a4ce01623'),
    CLOUD_API_KEY: GM_getValue('phishguard_cloud_api_key', ''), // 新增云端API密钥
    LANGUAGE: GM_getValue('phishguard_language', 'zh-CN') // 'zh-CN' or 'en-US'
};

// ================== 调试系统 ==================
const Logger = {
    log(...args) { CONFIG.DEBUG_MODE && console.log('[Security]', ...args) },
    error(...args) { console.error('[Security]', ...args) },
    warn(...args) { console.warn('[Security]', ...args) }
};

// ================== UBJSON 解析器 ==================
const UBJSONParser = (() => {
    const decoders = {
        'U': data => new Uint8Array(data),
        'i': data => new Int32Array(data),
        'l': data => new BigInt64Array(data),
        'f': data => new Float32Array(data),
        'd': data => new Float64Array(data)
    };

    const readValue = (view, offset) => {
        const type = String.fromCharCode(view.getUint8(offset++));
        switch(type) {
            case '{': return parseObject(view, offset);
            case '[': return parseArray(view, offset);
            case 'U': return parseTypedArray(view, offset, 'U');
            case 'i': return parseTypedArray(view, offset, 'i');
            case 'S': return parseString(view, offset);
            default: throw new Error(`Unsupported type: ${type}`);
        }
    };

    const parseObject = (view, offset) => {
        const obj = {};
        while (true) {
            if (view.getUint8(offset) === 0x7D) {
                offset++;
                break;
            }
            const key = readValue(view, offset);
            offset = key.offset;
            const value = readValue(view, offset);
            offset = value.offset;
            obj[key.value] = value.value;
        }
        return { value: obj, offset };
    };

    const parseArray = (view, offset) => {
        const arr = [];
        while (true) {
            if (view.getUint8(offset) === 0x5D) {
                offset++;
                break;
            }
            const element = readValue(view, offset);
            offset = element.offset;
            arr.push(element.value);
        }
        return { value: arr, offset };
    };

    const parseTypedArray = (view, offset, type) => {
        const length = view.getUint32(offset, true);
        offset += 4;
        const data = new DataView(view.buffer, offset, length * getTypeSize(type));
        offset += length * getTypeSize(type);
        return { value: decoders[type](data), offset };
    };

    const parseString = (view, offset) => {
        const length = view.getUint32(offset, true);
        offset += 4;
        const decoder = new TextDecoder();
        const str = decoder.decode(new DataView(view.buffer, offset, length));
        offset += length;
        return { value: str, offset };
    };

    const getTypeSize = (type) => {
        const sizes = { 'U': 1, 'i': 4, 'l': 8, 'f': 4, 'd': 8 };
        return sizes[type] || 1;
    };

    return {
        parse: buffer => readValue(new DataView(buffer), 0).value
    };
})();

// ================== 模型加载系统 ==================
class ModelManager {
    static CACHE_KEY = 'ai_model_v5';
    static retries = 0;

    static async load() {
        try {
            const cached = GM_getValue(this.CACHE_KEY);
            if (cached && this.isValidCache(cached)) {
                Logger.log('使用缓存模型');
                return cached.data;
            }
            return await this.fetchModel();
        } catch (e) {
            if (this.retries++ < 3) {
                Logger.warn(`模型加载失败，尝试重试 (${this.retries}/3)`);
                return this.load();
            }
            throw new Error(`模型加载失败: ${e.message}`);
        }
    }

    static isValidCache(cached) {
        return Date.now() - cached.timestamp < 86400000 && // 24小时
               cached.data?.layers?.length === 5;
    }

    static fetchModel() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: CONFIG.LOCAL_MODEL_URL,
                timeout: CONFIG.REQUEST_TIMEOUT,
                responseType: "arraybuffer",
                onload: res => {
                    if (res.status === 200) {
                        try {
                            const model = UBJSONParser.parse(res.response);
                            GM_setValue(this.CACHE_KEY, {
                                data: model,
                                timestamp: Date.now()
                            });
                            resolve(model);
                        } catch (e) {
                            reject(new Error('模型解析失败'));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.status}`));
                    }
                },
                onerror: err => reject(new Error(err.details)),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });
    }
}

// ================== 特征工程系统 ==================
class FeatureExtractor {
    static extract(url) {
        try {
            const parsed = new URL(url);
            return {
                domainLength: parsed.hostname.length,
                specialCharRatio: this.calculateSpecialChars(parsed.href),
                tldType: this.detectTLD(parsed.hostname),
                pathDepth: parsed.pathname.split('/').filter(p => p).length,
                hasPort: !!parsed.port,
                isHTTPS: parsed.protocol === 'https:'
            };
        } catch {
            return this.extractFromMalformed(url);
        }
    }

    static calculateSpecialChars(str) {
        const specials = str.match(/[^a-zA-Z0-9-.]/g) || [];
        return specials.length / str.length;
    }

    static detectTLD(hostname) {
        const tld = hostname.split('.').pop() || '';
        return ['com', 'org', 'net'].includes(tld) ? 0 :
               ['cn', 'gov', 'edu'].includes(tld) ? 1 : 2;
    }

    static extractFromMalformed(url) {
        return {
            domainLength: url.length,
            specialCharRatio: 0.5,
            tldType: 2,
            pathDepth: 0,
            hasPort: false,
            isHTTPS: false
        };
    }
}

// ================== 检测引擎核心 ==================
class DetectionEngine {
    static model = null;

    static async initialize() {
        if (!this.model) {
            this.model = await ModelManager.load();
            Logger.log('AI引擎初始化完成');
        }
    }

    static async analyze(url) {
        await this.initialize();
        const features = FeatureExtractor.extract(url);
        return this.predict(features);
    }

    static predict(features) {
        const normalized = this.normalizeFeatures(features);
        let result = normalized;
        this.model.layers.forEach(layer => {
            result = this.matrixMultiply(result, layer.weights);
            result = layer.activation === 'relu' ?
                     result.map(x => Math.max(0, x)) :
                     result.map(x => 1 / (1 + Math.exp(-x)));
        });
        const confidence = result[0];
        return {
            isPhishing: confidence > CONFIG.LOCAL_THRESHOLD,
            confidence: Number(confidence.toFixed(2))
        };
    }

    static normalizeFeatures(features) {
        return [
            features.domainLength / 100,
            features.specialCharRatio * 10,
            features.tldType / 2,
            features.pathDepth / 5,
            features.hasPort ? 1 : 0,
            features.isHTTPS ? 0 : 1
        ];
    }

    static matrixMultiply(a, b) {
        return b[0].map((_, col) =>
            b.reduce((sum, row, idx) => sum + a[idx] * row[col], 0)
        );
    }
}

// ================== 云端检测系统 ==================
class CloudDetector {
    static async check(url) {
        return new Promise((resolve, reject) => {
            // 检查API密钥是否配置
            if (!CONFIG.CLOUD_API_KEY) {
                reject(new Error(getLocalizedText('cloud_api_key_missing')));
                return;
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: CONFIG.CLOUD_API,
                data: JSON.stringify({
                    url: url,
                    timestamp: Date.now(),
                    features: FeatureExtractor.extract(url)
                }),
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": CONFIG.CLOUD_API_KEY  // 使用配置的API密钥
                },
                timeout: CONFIG.REQUEST_TIMEOUT,
                onload: res => {
                    try {
                        if (res.status === 200) {
                            const data = JSON.parse(res.responseText);
                            resolve({
                                isPhishing: data.is_phishing,
                                confidence: data.confidence,
                                details: data.details
                            });
                        } else if (res.status === 401) {
                            reject(new Error(getLocalizedText('cloud_api_key_invalid')));
                        } else {
                            reject(new Error(`${getLocalizedText('cloud_detection_failed')}: HTTP ${res.status}`));
                        }
                    } catch (e) {
                        reject(new Error(getLocalizedText('invalid_cloud_response')));
                    }
                },
                onerror: err => reject(new Error(`${getLocalizedText('network_error')}: ${err}`)),
                ontimeout: () => reject(new Error(getLocalizedText('request_timeout')))
            });
        });
    }
}

// ================== DeepSeek 检测系统 ==================
function askDeepSeek(userMessage) {
    const apiKey = CONFIG.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error(getLocalizedText('deepseek_api_key_missing'));
    }

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.deepseek.com/v1/chat/completions",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            data: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content:
                        "你是一个网络安全专家，专门分析URL是否是钓鱼网站。请严格分析提供的URL，并给出结论：是钓鱼网站、不是钓鱼网站或不确定。"
                    },
                    {
                        role: "user",
                        content:
                        `请分析以下URL是否为钓鱼网站：${userMessage}。请提供简要分析过程和最终结论 并且如果是的话输出111在最后。，并且输出一个置信度百分之多少 根据你的判断在百分之八十到百分之百之间`
                    }
                ],
                max_tokens: 500,
                temperature: 0.2
            }),
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.choices?.[0]?.message?.content) {
                        const content = data.choices[0].message.content;
                        // 分析DeepSeek的回复
                        const isPhishing = content.includes('111')
                                                                  // 提取置信度（如果有）
                        let confidenceMatch = content.match(/置信度[:：]?\s*(\d+\.?\d*)/);
                        let confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 :
                                          (isPhishing ? 0.85 : 0.15);
                        resolve({
                            isPhishing: isPhishing,
                            confidence: confidence,
                            response: content
                        });
                    } else {
                        reject(new Error('DeepSeek API 返回无效响应'));
                    }
                } catch (e) {
                    reject(new Error("解析响应时出错：" + e.message));
                }
            },
            onerror: err => reject(new Error('DeepSeek API 请求失败: ' + err)),
            ontimeout: () => reject(new Error('DeepSeek API 请求超时'))
        });
    });
}

// ================== 智能防护系统 ==================
class SecuritySystem {
    static async fullCheck(url) {
        // 在这里不再直接跳过，而是根据UI状态决定是否显示
        // if (this.isWhitelisted(url)) {
        //     Logger.log('白名单跳过检测:', url);
        //     return {
        //         isPhishing: false,
        //         confidence: 1.0,
        //         source: 'whitelist'
        //     };
        // }


        const mode = GM_getValue('phishguard_detection_mode', 'online');

        try {
            // 根据用户选择的模式执行检测
            if (mode === 'online') {
                // 仅使用云端检测
                const cloudResult = await CloudDetector.check(url);
                return {
                    ...cloudResult,
                    source: 'cloud'
                };
            } else if (mode === 'dual') {
                // 双模检测：同时使用云端和DeepSeek
                const [cloudResult, deepseekResult] = await Promise.all([
                    CloudDetector.check(url).catch(e => {
                        Logger.error('云端检测失败:', e);
                        return null;
                    }),
                    askDeepSeek(url).catch(e => {
                        Logger.error('DeepSeek检测失败:', e);
                        return null;
                    })
                ]);

                // 综合两个检测结果
                return this.combineResults(cloudResult, deepseekResult, url);
            } else {
                // 默认使用DeepSeek
                const result = await askDeepSeek(url);
                return {
                    ...result,
                    source: 'deepseek'
                };
            }
        } catch (e) {
            Logger.error('主要检测方法失败:', e);
            // 回退到本地模型
            try {
                const localResult = await DetectionEngine.analyze(url);
                return {
                    ...localResult,
                    source: 'local',
                    response: '检测失败，使用本地模型分析'
                };
            } catch (localError) {
                Logger.error('本地模型也失败:', localError);
                return {
                    isPhishing: true,
                    confidence: 0.99,
                    response: '所有检测方法均失败，建议谨慎访问',
                    source: 'fallback'
                };
            }
        }
    }

    // 综合两个检测结果
    static combineResults(cloudResult, deepseekResult, url) {
        // 如果只有一个结果可用
        if (!cloudResult && !deepseekResult) {
            throw new Error('所有检测方法均失败');
        }

        if (!cloudResult) return deepseekResult;
        if (!deepseekResult) return cloudResult;

        // 综合两个结果（更保守的策略：任一引擎判定为钓鱼则视为钓鱼）
        const isPhishing = cloudResult.isPhishing || deepseekResult.isPhishing;
        const confidence = Math.max(cloudResult.confidence, deepseekResult.confidence);

        return {
            isPhishing,
            confidence,
            source: 'dual',
            response: `云端检测: ${cloudResult.isPhishing ? '钓鱼' : '安全'} (置信度:${cloudResult.confidence.toFixed(2)}),
                      DeepSeek: ${deepseekResult.isPhishing ? '钓鱼' : '安全'} (置信度:${deepseekResult.confidence.toFixed(2)})`
        };
    }

    static isWhitelisted(url) {
        try {
            const hostname = new URL(url).hostname.toLowerCase();

            // 检查单域名列表
            const singleDomains = GM_getValue('phishguard_single_domains', CONFIG.SINGLE_DOMAINS);
            const singleMatch = singleDomains.some(domain =>
                hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`)
            );

            if (singleMatch) return true;

            // 检查泛域名列表
            const wildcardDomains = GM_getValue('phishguard_wildcard_domains', CONFIG.WILDCARD_DOMAINS);
            const wildcardMatch = wildcardDomains.some(pattern => {
                // pattern 格式为 *.example.com
                const baseDomain = pattern.substring(2).toLowerCase(); // 提取 example.com
                // 检查当前 hostname 是否等于 baseDomain (如 baidu.com 匹配 *.baidu.com)
                // 或者当前 hostname 是否以 .baseDomain 结尾 (如 pan.baidu.com 匹配 *.baidu.com)
                return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
            });

            return wildcardMatch;
        } catch {
            return false;
        }
    }
}

// ================== 翻译系统 ==================
const translations = {
    'zh-CN': {
        'app_title': '子非鱼 - PhishGuard',
        'is_phishing_text': '该网站是：',
        'phishing_status_yes': '是钓鱼网站',
        'phishing_status_no': '否为钓鱼网站',
        'confidence': '置信度：',
        'show_details': '显示详情',
        'settings': '设置',
        'add_to_single_whitelist': '加入单域白名单',
        'add_to_wildcard_whitelist': '加入泛域白名单',
        'mode_selection': '模式选择',
        'local_detection': '本地检测',
        'online_detection': '联网检测',
        'dual_mode_detection': '双模检测',
        'trust_websites': '信任网站',
        'single_domain_trust': '单域信任',
        'wildcard_domain_trust': '泛域信任',
        'deepseek_api_config': 'DeepSeek API 配置',
        'cloud_api_config': '云端API配置',
        'language_settings': '语言设置',
        'chinese_cn': '中文 CN',
        'english_en': '英语 EN',
        'delay_detection': '延迟检测',
        'ms': '毫秒',
        'local_model_not_ready': '本地模型尚未训练好。',
        'deepseek_api_key_missing': 'DeepSeek API Key 未设置，请在设置中配置。',
        'cloud_api_key_missing': '云端API Key未配置',
        'cloud_api_key_invalid': '云端API Key无效',
        'cloud_detection_failed': '云端检测失败',
        'invalid_cloud_response': '无效的云端响应',
        'network_error': '网络错误',
        'request_timeout': '请求超时',
        'deepseek_response': 'DeepSeek 回复：',
        'deepseek_parse_error': '解析 DeepSeek 响应时出错：',
        'url_detection': 'URL 检测：',
        'certificate_detection': '证书检测：',
        'domain_registration_time': '域名注册时间：',
        'add_to_whitelist_success': '已添加到白名单。',
        'add_to_blacklist_success': '已添加到黑名单。',
        'invalid_domain_format': '请输入有效的域名。',
        'online_detection_failed': '联网检测失败。',
        'whitelist_title': '白名单',
        'blacklist_title': '黑名单',
        'judging': '判断中...',
        'detection_source': '检测来源：',
        'deepseek_source': 'DeepSeek AI',
        'cloud_source': '云端检测',
        'local_source': '本地模型',
        'whitelist_source': '白名单',
        'blacklist_source': '黑名单',
        'enter_cloud_api_key': '输入云端API Key',
        'get_cloud_api_key_instruction': '请从您的PhishGuard控制台获取API Key'
    },
    'en-US': {
        'app_title': 'PhishGuard',
        'is_phishing_text': 'This site is: ',
        'phishing_status_yes': 'a phishing site',
        'phishing_status_no': 'not a phishing site',
        'confidence': 'Confidence: ',
        'show_details': 'Show Details',
        'settings': 'Settings',
        'add_to_single_whitelist': 'Add to Single Domain Whitelist',
        'add_to_wildcard_whitelist': 'Add to Wildcard Whitelist',
        'mode_selection': 'Mode Selection',
        'local_detection': 'Local Detection',
        'online_detection': 'Online Detection',
        'dual_mode_detection': 'Dual Mode Detection',
        'trust_websites': 'Trusted Websites',
        'single_domain_trust': 'Single Domain Trust',
        'wildcard_domain_trust': 'Wildcard Domain Trust',
        'deepseek_api_config': 'DeepSeek API Config',
        'cloud_api_config': 'Cloud API Config',
        'language_settings': 'Language Settings',
        'chinese_cn': 'Chinese CN',
        'english_en': 'English EN',
        'delay_detection': 'Delay Detection',
        'ms': 'ms',
        'local_model_not_ready': 'Local model not ready yet.',
        'deepseek_api_key_missing': 'DeepSeek API Key is missing. Please configure it in settings.',
        'cloud_api_key_missing': 'Cloud API Key is missing',
        'cloud_api_key_invalid': 'Cloud API Key is invalid',
        'cloud_detection_failed': 'Cloud detection failed',
        'invalid_cloud_response': 'Invalid cloud response',
        'network_error': 'Network error',
        'request_timeout': 'Request timeout',
        'deepseek_response': 'DeepSeek Response: ',
        'deepseek_parse_error': 'Error parsing DeepSeek response: ',
        'url_detection': 'URL Detection: ',
        'certificate_detection': 'Certificate Detection: ',
        'domain_registration_time': 'Domain Registration Time: ',
        'add_to_whitelist_success': 'Added to whitelist.',
        'add_to_blacklist_success': 'Added to blacklist.',
        'invalid_domain_format': 'Please enter a valid domain.',
        'online_detection_failed': 'Online detection failed.',
        'whitelist_title': 'Whitelist',
        'blacklist_title': 'Blacklist',
        'judging': 'Judging...',
        'detection_source': 'Detection Source: ',
        'deepseek_source': 'DeepSeek AI',
        'cloud_source': 'Cloud Detection',
        'local_source': 'Local Model',
        'whitelist_source': 'Whitelist',
        'blacklist_source': 'Blacklist',
        'enter_cloud_api_key': 'Enter Cloud API Key',
        'get_cloud_api_key_instruction': 'Get API Key from your PhishGuard console'
    }
};

function getLocalizedText(key) {
    const lang = CONFIG.LANGUAGE;
    return translations[lang]?.[key] ||
           translations['zh-CN'][key] ||
           key;
}

// ================== UI 交互逻辑 ==================
let uiContainer;
let isDragging = false;
let dragStartX, dragStartY;
let initialMouseX, initialMouseY;
let detectionResult = null;
let isMinimized = false;
let isMaximized = false;
let originalPosition = null;

function createUI() {
    // 如果UI已存在，先移除
    if (document.getElementById('phishGuardUI')) {
        document.getElementById('phishGuardUI').remove();
    }

    uiContainer = document.createElement('div');
    uiContainer.id = 'phishGuardUI';
    uiContainer.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: #f0f0f0 !important;
        border: 1px solid #ccc !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        color: #333 !important;
        z-index: 99999 !important;
        display: flex !important;
        flex-direction: column !important;
        min-width: 350px !important;
        min-height: 200px !important;
        resize: both !important;
        overflow: auto !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    `;

    document.body.appendChild(uiContainer);
    updateUIContent(); // 初始内容加载

    // 优化的拖动逻辑
    const header = document.getElementById('phishGuardHeader');

    header.addEventListener('mousedown', (e) => {
        // 排除窗口控制按钮
        if (e.target.id === 'closeBtn' ||
            e.target.id === 'minimizeBtn' ||
            e.target.id === 'maximizeBtn') {
            return;
        }

        isDragging = true;

        // 记录初始位置
        const rect = uiContainer.getBoundingClientRect();
        dragStartX = rect.left;
        dragStartY = rect.top;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;

        // 设置拖动状态样式
        header.style.cursor = 'grabbing';
        uiContainer.style.transition = 'none'; // 拖动时禁用过渡动画

        // 防止文本选择
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // 计算新位置
        const deltaX = e.clientX - initialMouseX;
        const deltaY = e.clientY - initialMouseY;

        const newX = dragStartX + deltaX;
        const newY = dragStartY + deltaY;

        // 边界检查，防止窗口拖出屏幕
        const maxX = window.innerWidth - uiContainer.offsetWidth;
        const maxY = window.innerHeight - uiContainer.offsetHeight;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        // 应用新位置
        uiContainer.style.left = `${constrainedX}px`;
        uiContainer.style.top = `${constrainedY}px`;
        uiContainer.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
            uiContainer.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'; // 恢复过渡动画
        }
    });

    // 窗口控制按钮
    document.getElementById('closeBtn').addEventListener('click', () => {
        try {
            uiContainer.style.opacity = '0';
            uiContainer.style.transform = 'scale(0.8)';
            setTimeout(() => {
                uiContainer.remove();
            }, 200);
        } catch (e) {
            console.error('关闭按钮错误:', e);
        }
    });

    document.getElementById('minimizeBtn').addEventListener('click', () => {
        if (isMinimized) {
            // 恢复
            document.getElementById('phishGuardContent').style.display = 'flex';
            document.getElementById('phishGuardFooter').style.display = 'flex';
            uiContainer.style.height = '';
            isMinimized = false;
        } else {
            // 最小化
            document.getElementById('phishGuardContent').style.display = 'none';
            document.getElementById('phishGuardFooter').style.display = 'none';
            uiContainer.style.height = '40px';
            isMinimized = true;
        }
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
        if (isMaximized) {
            // 恢复原始大小
            uiContainer.style.width = '';
            uiContainer.style.height = '';
            uiContainer.style.top = '50%';
            uiContainer.style.left = '50%';
            uiContainer.style.transform = 'translate(-50%, -50%)';
            isMaximized = false;
        } else {
            // 最大化时限制为屏幕的80%高度和宽度
            uiContainer.style.top = '10%';
            uiContainer.style.left = '10%';
            uiContainer.style.width = '80%';
            uiContainer.style.height = '80%';
            uiContainer.style.transform = 'none';
            isMaximized = true;
        }
    });

    const showDetailsBtn = document.getElementById('showDetailsBtn');
    showDetailsBtn.addEventListener('click', showDetailsPage);
    // 初始禁用详情按钮
    showDetailsBtn.disabled = true;
    showDetailsBtn.style.opacity = '0.5';
    showDetailsBtn.style.cursor = 'not-allowed';

    document.getElementById('settingsBtn').addEventListener('click', showSettingsPage);

    // 初始显示主页面
    showMainPage();
}

function updateUIContent() {
    uiContainer.innerHTML = `
        <div id="phishGuardHeader" style="
            background: #e0e0e0;
            padding: 8px 15px;
            border-bottom: 1px solid #ccc;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: grab;
            user-select: none;
            position: relative;
            transition: background-color 0.2s ease;
        ">
            <span id="phishGuardTitle" style="
                font-weight: bold;
            ">${getLocalizedText('app_title')}</span>
            <div id="windowControls" style="
                position: absolute;
                top: 8px;
                right: 15px;
                display: flex;
                gap: 6px;
            ">
                <div id="closeBtn" style="
                    width: 16px;
                    height: 16px;
                    background-color: #ff605c;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 10px;
                    transition: all 0.2s ease;
                ">×</div>
                <div id="minimizeBtn" style="
                    width: 16px;
                    height: 16px;
                    background-color: #ffbd4a;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 12px;
                    transition: all 0.2s ease;
                ">---</div>
                <div id="maximizeBtn" style="
                    width: 16px;
                    height: 16px;
                    background-color: #00ca4e;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 10px;
                    transition: all 0.2s ease;
                ">□</div>
            </div>
        </div>
        <div id="phishGuardContent" style="
            flex-grow: 1;
            padding: 15px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            max-height: 80vh;
            overflow-y: auto;
            transition: all 0.3s ease;
        ">
            <!-- 内容将动态加载 -->
        </div>
        <div id="phishGuardFooter" style="
            padding: 10px 15px;
            border-top: 1px solid #ccc;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            background: #e0e0e0;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
            transition: all 0.3s ease;
        ">
            <button id="showDetailsBtn" style="
                padding: 8px 15px;
                border: 1px solid #ccc;
                border-radius: 5px;
                background-color: #fff;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            ">${getLocalizedText('show_details')}</button>
            <button id="settingsBtn" style="
                padding: 8px 15px;
                border: 1px solid #ccc;
                border-radius: 5px;
                background-color: #fff;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            ">${getLocalizedText('settings')}</button>
        </div>
    `;

    // 重新绑定事件监听器
    document.getElementById('closeBtn').addEventListener('click', () => {
        try {
            uiContainer.style.opacity = '0';
            uiContainer.style.transform = 'scale(0.8)';
            setTimeout(() => {
                uiContainer.remove();
            }, 200);
        } catch (e) {
            console.error('关闭按钮错误:', e);
        }
    });

    document.getElementById('minimizeBtn').addEventListener('click', () => {
        if (isMinimized) {
            document.getElementById('phishGuardContent').style.display = 'flex';
            document.getElementById('phishGuardFooter').style.display = 'flex';
            uiContainer.style.height = '';
            isMinimized = false;
        } else {
            document.getElementById('phishGuardContent').style.display = 'none';
            document.getElementById('phishGuardFooter').style.display = 'none';
            uiContainer.style.height = '40px';
            isMinimized = true;
        }
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
        if (isMaximized) {
            uiContainer.style.width = '';
            uiContainer.style.height = '';
            uiContainer.style.top = '50%';
            uiContainer.style.left = '50%';
            uiContainer.style.transform = 'translate(-50%, -50%)';
            isMaximized = false;
        } else {
            uiContainer.style.top = '10%';
            uiContainer.style.left = '10%';
            uiContainer.style.width = '80%';
            uiContainer.style.height = '80%';
            uiContainer.style.transform = 'none';
            isMaximized = true;
        }
    });

    const showDetailsBtn = document.getElementById('showDetailsBtn');
    showDetailsBtn.addEventListener('click', showDetailsPage);
    // 根据 detectionResult 状态启用或禁用详情按钮
    if (detectionResult) {
        showDetailsBtn.disabled = false;
        showDetailsBtn.style.opacity = '1';
        showDetailsBtn.style.cursor = 'pointer';
    } else {
        showDetailsBtn.disabled = true;
        showDetailsBtn.style.opacity = '0.5';
        showDetailsBtn.style.cursor = 'not-allowed';
    }

    document.getElementById('settingsBtn').addEventListener('click', showSettingsPage);
}

function showMainPage() {
    updateUIContent(); // 确保UI结构是最新的
    const contentDiv = document.getElementById('phishGuardContent');
    const showDetailsBtn = document.getElementById('showDetailsBtn');

    let statusText = getLocalizedText('judging');
    let confidenceText = '';
    let statusClass = '';

    if (detectionResult) {
        statusText = detectionResult.isPhishing ?
                     getLocalizedText('phishing_status_yes') :
                     getLocalizedText('phishing_status_no');
        confidenceText = `${getLocalizedText('confidence')} ${(detectionResult.confidence * 100).toFixed(1)}%`;
        statusClass = detectionResult.isPhishing ? 'phishing' : 'safe';

        // 检测结果出来后启用详情按钮
        showDetailsBtn.disabled = false;
        showDetailsBtn.style.opacity = '1';
        showDetailsBtn.style.cursor = 'pointer';
    } else {
        // 检测结果未出时禁用详情按钮
        showDetailsBtn.disabled = true;
        showDetailsBtn.style.opacity = '0.5';
        showDetailsBtn.style.cursor = 'not-allowed';
    }

    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 5px;
                    background-color: #fff; width: 80%; transition: all 0.3s ease;" class="${statusClass}">
            <p style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                ${getLocalizedText('is_phishing_text')}${statusText}
            </p>
            <p style="font-size: 16px;">${confidenceText}</p>
            ${detectionResult ? `<p style="font-size: 14px; margin-top: 10px; color: #666;">
                ${getLocalizedText('detection_source')}${getDetectionSourceText(detectionResult.source)}
            </p>` : ''}

            ${detectionResult && detectionResult.source !== 'whitelist' ? `
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button id="addToSingleWhitelistBtn" style="
                        padding: 8px 12px;
                        border: 1px solid #28a745;
                        border-radius: 4px;
                        background-color: #28a745;
                        color: white;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.2s ease;
                    ">${getLocalizedText('add_to_single_whitelist')}</button>
                    <button id="addToWildcardWhitelistBtn" style="
                        padding: 8px 12px;
                        border: 1px solid #17a2b8;
                        border-radius: 4px;
                        background-color: #17a2b8;
                        color: white;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.2s ease;
                    ">${getLocalizedText('add_to_wildcard_whitelist')}</button>
                </div>
            ` : ''}
        </div>
    `;

    // 添加快捷白名单按钮事件监听器
    if (detectionResult && detectionResult.source !== 'whitelist') {
        const singleBtn = document.getElementById('addToSingleWhitelistBtn');
        const wildcardBtn = document.getElementById('addToWildcardWhitelistBtn');

        if (singleBtn) {
            singleBtn.addEventListener('click', () => addToWhitelist('single'));
        }

        if (wildcardBtn) {
            wildcardBtn.addEventListener('click', () => addToWhitelist('wildcard'));
        }
    }
}

// 辅助函数：获取主域名
function getMainDomain(hostname) {
    const parts = hostname.split('.');
    // 简单的判断，如果域名部分大于2，取最后两部分作为主域名
    // 更复杂的判断需要考虑TLD列表，例如.co.uk
    if (parts.length > 2) {
        // 检查是否是常见的二级域名，如com.cn, gov.cn等
        const tld = parts[parts.length - 1];
        const secondLevelDomain = parts[parts.length - 2];
        if (['com', 'net', 'org', 'gov', 'edu'].includes(secondLevelDomain) && ['cn', 'uk', 'au'].includes(tld)) {
            return parts.slice(parts.length - 3).join('.');
        }
        return parts.slice(parts.length - 2).join('.');
    } else {
        return hostname;
    }
}

// 添加到白名单的函数
function addToWhitelist(type) {
    try {
        const hostname = new URL(window.location.href).hostname.toLowerCase();

        if (type === 'single') {
            const singleDomains = GM_getValue('phishguard_single_domains', CONFIG.SINGLE_DOMAINS);
            if (!singleDomains.includes(hostname)) {
                singleDomains.push(hostname);
                GM_setValue('phishguard_single_domains', singleDomains);
                showNotification(`已将 ${hostname} 添加到单域白名单`, 'success');
            } else {
                showNotification(`${hostname} 已在单域白名单中`, 'info');
            }
        } else if (type === 'wildcard') {
            const mainDomain = getMainDomain(hostname);
            const wildcardPattern = `*.${mainDomain}`;
            const wildcardDomains = GM_getValue('phishguard_wildcard_domains', CONFIG.WILDCARD_DOMAINS);
            if (!wildcardDomains.includes(wildcardPattern)) {
                wildcardDomains.push(wildcardPattern);
                GM_setValue('phishguard_wildcard_domains', wildcardDomains);
                showNotification(`已将 ${wildcardPattern} 添加到泛域白名单`, 'success');
            } else {
                showNotification(`${wildcardPattern} 已在泛域白名单中`, 'info');
            }
        }
    } catch (e) {
        showNotification('添加白名单失败：无效的URL', 'error');
    }
}

// 显示通知的函数
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        z-index: 100000;
        transition: all 0.3s ease;
        transform: translateX(100%);
        opacity: 0;
    `;

    // 根据类型设置颜色
    const colors = {
        'success': '#28a745',
        'error': '#dc3545',
        'info': '#17a2b8',
        'warning': '#ffc107'
    };

    notification.style.backgroundColor = colors[type] || colors['info'];
    notification.textContent = message;

    document.body.appendChild(notification);

    // 动画显示
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);

    // 3秒后自动消失
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function getDetectionSourceText(source) {
    const sources = {
        'deepseek': getLocalizedText('deepseek_source'),
        'cloud': getLocalizedText('cloud_source'),
        'local': getLocalizedText('local_source'),
        'whitelist': getLocalizedText('whitelist_source'),
        'blacklist': getLocalizedText('blacklist_source'),
        'dual': '双模检测',
        'fallback': getLocalizedText('local_source') + ' (备用)'
    };
    return sources[source] || source;
}

function showDetailsPage() {
    updateUIContent(); // 确保UI结构是最新的
    const contentDiv = document.getElementById('phishGuardContent');
    contentDiv.innerHTML = `
        <div style="text-align: left; padding: 20px; border: 1px solid #ddd; border-radius: 5px;
                    background-color: #fff; width: 90%; max-height: 70vh; overflow-y: auto;">
            <button id="backToMainBtn" style="padding: 8px 15px; border: 1px solid #ccc; border-radius: 5px;
                background-color: #fff; cursor: pointer; margin-bottom: 15px; transition: all 0.2s ease;">
                返回主页面
            </button>
            <h3 style="margin-top: 0;">${getLocalizedText("is_phishing_text")}
                <span style="color: ${detectionResult.isPhishing ? "#e74c3c" : "#2ecc71"}">
                    ${detectionResult.isPhishing ?
                      getLocalizedText("phishing_status_yes") :
                      getLocalizedText("phishing_status_no")}
                </span>
            </h3>
            <p><strong>${getLocalizedText("confidence")}</strong>
                ${(detectionResult.confidence * 100).toFixed(1)}%</p>
            <p><strong>${getLocalizedText("detection_source")}</strong>
                ${getDetectionSourceText(detectionResult.source)}</p>

            ${detectionResult.response ? `
                <div style="margin-top: 15px;">
                    <h4>${detectionResult.source === "deepseek" ?
                          getLocalizedText("deepseek_response") :
                          "检测详情"}</h4>
                    <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; border-left: 3px solid #3498db; max-height: 200px; overflow-y: auto;">
                        ${detectionResult.response.replace(/\n/g, ",<br>")}
                    </div>
                </div>
            ` : ""}

            <div style="margin-top: 15px;">
                <h4>${getLocalizedText("url_detection")}</h4>
                <p>${window.location.href}</p>
            </div>

            <div style="margin-top: 15px;">
                <h4>${getLocalizedText("certificate_detection")}</h4>
                <p>${location.protocol === "https:" ?
                    "安全连接 (HTTPS)" :
                    "不安全连接 (HTTP)"}</p>
            </div>
        </div>
    `;

    // 添加返回按钮事件监听器
    document.getElementById("backToMainBtn").addEventListener("click", showMainPage);
}

function showSettingsPage() {
    updateUIContent(); // 确保UI结构是最新的
    const contentDiv = document.getElementById("phishGuardContent");
    const detectionMode = GM_getValue("phishguard_detection_mode", "online");
    contentDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; max-height: 70vh; overflow-y: auto;">
            <button id="backToMainBtn" style="padding: 8px 15px; border: 1px solid #ccc; border-radius: 5px;
                background-color: #fff; cursor: pointer; transition: all 0.2s ease; align-self: flex-start;">
                返回主页面
            </button>

            <!-- 模式选择 -->
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="margin-top: 0;">${getLocalizedText('mode_selection')}</h3>
                <label style="display: block; margin-bottom: 8px;">
                    <input type="radio" name="detectionMode" value="online" ${detectionMode === 'online' ? 'checked' : ''}>
                    ${getLocalizedText('online_detection')}
                </label>
                <label style="display: block; margin-bottom: 8px;">
                    <input type="radio" name="detectionMode" value="dual" ${detectionMode === 'dual' ? 'checked' : ''}>
                    ${getLocalizedText('dual_mode_detection')}
                </label>
                <label style="display: block;">
                    <input type="radio" name="detectionMode" value="deepseek" ${detectionMode === 'deepseek' ? 'checked' : ''}>
                    ${getLocalizedText('deepseek_api_config')}
                </label>
            </div>

            <!-- 云端API配置 -->
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="margin-top: 0;">${getLocalizedText('cloud_api_config')}</h3>
                <input type="password" id="cloudApiKey"
                       placeholder="${CONFIG.CLOUD_API_KEY ? '••••••••' : getLocalizedText('enter_cloud_api_key')}"
                       style="width: calc(100% - 22px); padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
                       value="${CONFIG.CLOUD_API_KEY}">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    ${getLocalizedText('get_cloud_api_key_instruction')}
                </p>
            </div>

            <!-- DeepSeek API配置 -->
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="margin-top: 0;">${getLocalizedText('deepseek_api_config')}</h3>
                <input type="password" id="deepseekApiKey"
                       placeholder="${CONFIG.DEEPSEEK_API_KEY ? '••••••••' : getLocalizedText('deepseek_api_key_missing')}"
                       style="width: calc(100% - 22px); padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
                       value="${CONFIG.DEEPSEEK_API_KEY}">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    可在 <a href="https://platform.deepseek.com/api-keys" target="_blank">DeepSeek平台</a> 获取API Key
                </p>
            </div>

            <!-- 信任网站 -->
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="margin-top: 0;">${getLocalizedText('trust_websites')}</h3>
                <input type="text" id="singleDomainInput" placeholder="example.com"
                       style="width: calc(100% - 22px); padding: 8px; margin-bottom: 10px;
                              border: 1px solid #ccc; border-radius: 4px;">
                <button id="addSingleDomainBtn"
                        style="width: 100%; padding: 8px 15px; border: 1px solid #ccc; border-radius: 5px;
                               background-color: #fff; cursor: pointer; margin-bottom: 15px; transition: all 0.2s ease;">
                    ${getLocalizedText('single_domain_trust')}
                </button>
                <input type="text" id="wildcardDomainInput" placeholder="*.example.com"
                       style="width: calc(100% - 22px); padding: 8px; margin-bottom: 10px;
                              border: 1px solid #ccc; border-radius: 4px;">
                <button id="addWildcardDomainBtn"
                        style="width: 100%; padding: 8px 15px; border: 1px solid #ccc; border-radius: 5px;
                               background-color: #fff; cursor: pointer; transition: all 0.2s ease;">
                    ${getLocalizedText('wildcard_domain_trust')}
                </button>
                <div style="margin-top: 15px;">
                    <h4 style="margin-top: 0;">${getLocalizedText('whitelist_title')}</h4>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 4px; max-height: 180px; overflow-y: auto; background-color: #fafafa;">
                            <h5>单域名</h5>
                            <ul id="singleDomainList" style="list-style: none; padding: 0; margin: 0;"></ul>
                        </div>
                        <div style="flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 4px; max-height: 180px; overflow-y: auto; background-color: #fafafa;">
                            <h5>泛域名</h5>
                            <ul id="wildcardDomainList" style="list-style: none; padding: 0; margin: 0;"></ul>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 语言设置 -->
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="margin-top: 0;">${getLocalizedText('language_settings')}</h3>
                <label style="display: block; margin-bottom: 8px;">
                    <input type="radio" name="language" value="zh-CN" ${CONFIG.LANGUAGE === 'zh-CN' ? 'checked' : ''}>
                    ${getLocalizedText('chinese_cn')}
                </label>
                <label style="display: block;">
                    <input type="radio" name="language" value="en-US" ${CONFIG.LANGUAGE === 'en-US' ? 'checked' : ''}>
                    ${getLocalizedText('english_en')}
                </label>
            </div>
        </div>
    `;

    // 添加返回按钮事件监听器
    document.getElementById('backToMainBtn').addEventListener('click', showMainPage);

    // 设置事件监听器
    document.querySelectorAll('input[name="detectionMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            GM_setValue('phishguard_detection_mode', e.target.value);
            Logger.log('Detection mode set to:', e.target.value);
        });
    });

    document.querySelectorAll('input[name="language"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            GM_setValue('phishguard_language', e.target.value);
            CONFIG.LANGUAGE = e.target.value;
            updateUIContent(); // 重新创建UI以应用新语言
            showSettingsPage(); // 重新显示设置页面以更新内容
        });
    });

    document.getElementById('deepseekApiKey').addEventListener('change', (e) => {
        GM_setValue('phishguard_deepseek_api_key', e.target.value);
        CONFIG.DEEPSEEK_API_KEY = e.target.value;
        Logger.log('DeepSeek API Key updated.');
    });

    // 新增云端API密钥保存功能
    document.getElementById('cloudApiKey').addEventListener('change', (e) => {
        GM_setValue('phishguard_cloud_api_key', e.target.value);
        CONFIG.CLOUD_API_KEY = e.target.value;
        Logger.log('Cloud API Key updated.');
    });

    // 白名单管理
    const singleDomainInput = document.getElementById('singleDomainInput');
    const wildcardDomainInput = document.getElementById('wildcardDomainInput');
    const addSingleDomainBtn = document.getElementById('addSingleDomainBtn');
    const addWildcardDomainBtn = document.getElementById('addWildcardDomainBtn');
    const singleDomainList = document.getElementById('singleDomainList');
    const wildcardDomainList = document.getElementById('wildcardDomainList');

    function renderLists() {
        const currentSingleDomains = GM_getValue('phishguard_single_domains', CONFIG.SINGLE_DOMAINS);
        const currentWildcardDomains = GM_getValue('phishguard_wildcard_domains', CONFIG.WILDCARD_DOMAINS);

        singleDomainList.innerHTML = '';
        currentSingleDomains.forEach((domain, index) => {
            const li = document.createElement('li');
            li.style.cssText = `
                padding: 5px 8px;
                margin: 2px 0;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: white;
                border-radius: 3px;
                font-size: 13px;
            `;

            const domainSpan = document.createElement('span');
            domainSpan.textContent = domain;
            li.appendChild(domainSpan);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.style.cssText = `
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 3px;
                padding: 2px 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            `;
            removeBtn.onmouseover = () => removeBtn.style.backgroundColor = '#ff2222';
            removeBtn.onmouseout = () => removeBtn.style.backgroundColor = '#ff4444';
            removeBtn.onclick = () => {
                currentSingleDomains.splice(index, 1);
                GM_setValue('phishguard_single_domains', currentSingleDomains);
                renderLists();
            };
            li.appendChild(removeBtn);

            singleDomainList.appendChild(li);
        });

        wildcardDomainList.innerHTML = '';
        currentWildcardDomains.forEach((domain, index) => {
            const li = document.createElement('li');
            li.style.cssText = `
                padding: 5px 8px;
                margin: 2px 0;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: white;
                border-radius: 3px;
                font-size: 13px;
            `;

            const domainSpan = document.createElement('span');
            domainSpan.textContent = domain;
            li.appendChild(domainSpan);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.style.cssText = `
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 3px;
                padding: 2px 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            `;
            removeBtn.onmouseover = () => removeBtn.style.backgroundColor = '#ff2222';
            removeBtn.onmouseout = () => removeBtn.style.backgroundColor = '#ff4444';
            removeBtn.onclick = () => {
                currentWildcardDomains.splice(index, 1);
                GM_setValue('phishguard_wildcard_domains', currentWildcardDomains);
                renderLists();
            };
            li.appendChild(removeBtn);

            wildcardDomainList.appendChild(li);
        });
    }

    addSingleDomainBtn.addEventListener('click', () => {
        const domain = singleDomainInput.value.trim().toLowerCase();
        if (domain) {
            const currentSingleDomains = GM_getValue('phishguard_single_domains', CONFIG.SINGLE_DOMAINS);
            if (!currentSingleDomains.includes(domain)) {
                currentSingleDomains.push(domain);
                GM_setValue('phishguard_single_domains', currentSingleDomains);
                showNotification(getLocalizedText('add_to_whitelist_success'), 'success');
                singleDomainInput.value = '';
                renderLists();
            }
        } else {
            showNotification(getLocalizedText('invalid_domain_format'), 'error');
        }
    });

    addWildcardDomainBtn.addEventListener('click', () => {
        const domain = wildcardDomainInput.value.trim().toLowerCase();
        if (domain.startsWith('*.') && domain.length > 2) {
            const currentWildcardDomains = GM_getValue('phishguard_wildcard_domains', CONFIG.WILDCARD_DOMAINS);
            if (!currentWildcardDomains.includes(domain)) {
                currentWildcardDomains.push(domain);
                GM_setValue('phishguard_wildcard_domains', currentWildcardDomains);
                showNotification(getLocalizedText('add_to_whitelist_success'), 'success');
                wildcardDomainInput.value = '';
                renderLists();
            }
        } else {
            showNotification('请输入有效的泛域名格式，如: *.example.com', 'error');
        }
    });

    renderLists(); // 初始渲染列表
}

// ================== 主逻辑 ==================
async function runDetection() {
    Logger.log('PhishGuard 开始检测...');
    const currentUrl = window.location.href;

    try {
        detectionResult = await SecuritySystem.fullCheck(currentUrl);
        Logger.log('检测结果:', detectionResult);

        // 如果是钓鱼网站，播放警告音
        if (detectionResult.isPhishing) {
            playWarningSound();
        }

        showMainPage();
    } catch (error) {
        Logger.error('检测过程中出错:', error);
        detectionResult = {
            isPhishing: true,
            confidence: 0.99,
            source: 'error',
            response: `检测失败: ${error.message}`
        };
        showMainPage();
    }
}

function playWarningSound() {
    const audio = new Audio(CONFIG.MUSIC_URL);
    audio.volume = 0.5;
    audio.play().catch(e => Logger.error('无法播放警告音:', e));
}

// ================== 初始化 ==================
function init() {
    // 始终创建UI容器，但如果网站在白名单中，则不自动弹出
    createUI();

    // 注册菜单命令
    GM_registerMenuCommand("打开 PhishGuard", () => {
        const ui = document.getElementById('phishGuardUI');
        if (ui) {
            ui.style.display = 'flex'; // 确保显示
            runDetection(); // 重新运行检测以更新内容
        } else {
            createUI();
            runDetection();
        }
    });

    GM_registerMenuCommand("关闭 PhishGuard", () => {
        const ui = document.getElementById('phishGuardUI');
        if (ui) ui.style.display = 'none';
    });

    // 如果不在白名单中，则自动开始检测
    if (!SecuritySystem.isWhitelisted(window.location.href)) {
        Logger.log('非白名单网站，自动开始检测:', window.location.href);
        setTimeout(runDetection, 1000);
    } else {
        Logger.log('白名单网站，等待手动触发检测:', window.location.href);
        // 隐藏UI，等待用户手动触发
        const ui = document.getElementById('phishGuardUI');
        if (ui) ui.style.display = 'none';
    }
}

// 确保页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ================== CSS 样式 ==================
GM_addStyle(`
    #phishGuardUI {
        display: block !important;
        max-width: 90%;
        max-height: 90%;
    }
    .phishing {
        background-color: #f8d7da !important;
        border-color: #f5c6cb !important;
        color: #721c24 !important;
    }
    .safe {
        background-color: #d4edda !important;
        border-color: #c3e6cb !important;
        color: #155724 !important;
    }
    #phishGuardHeader:hover {
        background-color: #d5d5d5 !important;
    }
    #showDetailsBtn:hover {
        background-color: #f0f0f0 !important;
        transform: translateY(-1px);
    }
    #settingsBtn:hover {
        background-color: #f0f0f0 !important;
        transform: translateY(-1px);
    }
    #closeBtn:hover {
        background-color: #ff3b30 !important;
        transform: scale(1.1);
    }
    #minimizeBtn:hover {
        background-color: #ff9500 !important;
        transform: scale(1.1);
    }
    #maximizeBtn:hover {
        background-color: #00ca4e !important;
        transform: scale(1.1);
    }
    #addToSingleWhitelistBtn:hover {
        background-color: #218838 !important;
        transform: translateY(-1px);
    }
    #addToWildcardWhitelistBtn:hover {
        background-color: #138496 !important;
        transform: translateY(-1px);
    }
    #backToMainBtn:hover {
        background-color: #f0f0f0 !important;
        transform: translateY(-1px);
    }
    #addSingleDomainBtn:hover, #addWildcardDomainBtn:hover {
        background-color: #f0f0f0 !important;
        transform: translateY(-1px);
    }
    #phishGuardContent {
        overflow-y: auto;
    }
    /* 滚动条样式 */
    #singleDomainList::-webkit-scrollbar,
    #wildcardDomainList::-webkit-scrollbar {
        width: 6px;
    }
    #singleDomainList::-webkit-scrollbar-track,
    #wildcardDomainList::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    #singleDomainList::-webkit-scrollbar-thumb,
    #wildcardDomainList::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    #singleDomainList::-webkit-scrollbar-thumb:hover,
    #wildcardDomainList::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
`);
})();