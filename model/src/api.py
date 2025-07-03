from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
import json
from datetime import datetime
import re
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 启用CORS，允许跨域请求

# 配置
MAX_LEN = 200
MAX_BATCH_SIZE = 100

# 获取项目根目录路径（相对于src目录向上一级）
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# 使用项目根目录的绝对路径
MODEL_PATH = os.path.join(PROJECT_ROOT, 'models', 'phishing_detector_model.keras')
CHAR_TO_IDX_PATH = os.path.join(PROJECT_ROOT, 'data', 'processed', 'char_to_idx.json')

# 全局变量
model = None
char_to_idx = None
prediction_count = 0

# 白名单域名
trusted_sites = [
    "bistu.edu.cn",
    "tsinghua.edu.cn",
    "pku.edu.cn",
    "moe.gov.cn",
    "gov.cn",
    "edu.cn"
]

def load_model():
    """加载模型和字符字典"""
    global model, char_to_idx

    # 加载字符字典
    with open(CHAR_TO_IDX_PATH, 'r', encoding='utf-8') as f:
        char_to_idx = json.load(f)

    # 加载模型
    model = tf.keras.models.load_model(MODEL_PATH)

    print("模型和字符字典加载完成")

def url_to_seq(url):
    """将URL转换为序列"""
    seq = [char_to_idx.get(c, 0) for c in url[:MAX_LEN]]
    seq += [0] * (MAX_LEN - len(seq))
    return np.array([seq])

def is_valid_url(url):
    """检查URL是否有效"""
    # 简单的URL验证，可以根据需要调整
    pattern = re.compile(
        r'^(?:http|https)://'  # http:// 或 https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # 域名
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP地址
        r'(?::\d+)?'  # 可选的端口
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return bool(pattern.match(url))

def predict_url(url):
    """预测单个URL"""
    global prediction_count

    # 检查URL长度
    if len(url) > MAX_LEN:
        return {
            "url": url,
            "error": "URL_TOO_LONG",
            "message": f"URL超过最大长度（{MAX_LEN}字符）"
        }

    # 检查URL格式
    if not is_valid_url(url):
        return {
            "url": url,
            "error": "INVALID_URL",
            "message": "URL格式无效"
        }

    # 白名单检测
    if any(site in url for site in trusted_sites):
        prediction_count += 1
        return {
            "url": url,
            "is_phishing": False,
            "confidence": 0.05,  # 给白名单网站一个很低的钓鱼概率
            "prediction_time": datetime.now().isoformat()
        }

    try:
        # 模型预测
        seq = url_to_seq(url)
        pred = float(model.predict(seq)[0][0])
        prediction_count += 1

        return {
            "url": url,
            "is_phishing": pred > 0.5,
            "confidence": pred if pred > 0.5 else 1 - pred,
            "prediction_time": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "url": url,
            "error": "MODEL_ERROR",
            "message": f"模型预测出错: {str(e)}"
        }

@app.route('/api/v1/predict', methods=['POST'])
def api_predict_url():
    """单个URL预测API端点"""
    data = request.get_json()

    if not data or 'url' not in data:
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "请求必须包含url字段"
            }
        }), 400

    url = data['url']
    result = predict_url(url)

    if "error" in result:
        return jsonify({
            "success": False,
            "error": {
                "code": result["error"],
                "message": result["message"]
            }
        }), 400 if result["error"] in ["INVALID_URL", "URL_TOO_LONG"] else 500

    return jsonify({
        "success": True,
        "data": result
    })

@app.route('/api/v1/predict/batch', methods=['POST'])
def api_predict_batch():
    """批量URL预测API端点"""
    data = request.get_json()

    if not data or 'urls' not in data or not isinstance(data['urls'], list):
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "请求必须包含urls数组"
            }
        }), 400

    urls = data['urls']

    if len(urls) > MAX_BATCH_SIZE:
        return jsonify({
            "success": False,
            "error": {
                "code": "BATCH_TOO_LARGE",
                "message": f"批量请求URL数量超过限制（最大{MAX_BATCH_SIZE}个）"
            }
        }), 400

    results = [predict_url(url) for url in urls]

    # 检查是否所有请求都失败了
    all_errors = all("error" in result for result in results)
    if all_errors:
        return jsonify({
            "success": False,
            "error": {
                "code": "BATCH_FAILED",
                "message": "所有URL预测均失败"
            },
            "details": results
        }), 500

    # 分离成功和失败的结果
    success_results = [r for r in results if "error" not in r]
    error_results = [r for r in results if "error" in r]

    return jsonify({
        "success": True,
        "data": success_results,
        "errors": error_results if error_results else None
    })

@app.route('/api/v1/model/status', methods=['GET'])
def api_model_status():
    """获取模型状态API端点"""
    if model is None:
        return jsonify({
            "success": False,
            "error": {
                "code": "MODEL_NOT_LOADED",
                "message": "模型尚未加载"
            }
        }), 500

    # 获取模型文件的最后修改时间
    last_updated = datetime.fromtimestamp(os.path.getmtime(MODEL_PATH)).isoformat()

    return jsonify({
        "success": True,
        "data": {
            "model_version": "1.0.0",  # 可以根据实际情况修改
            "last_updated": last_updated,
            "total_predictions": prediction_count,
            "status": "active"
        }
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "success": False,
        "error": {
            "code": "NOT_FOUND",
            "message": "请求的资源不存在"
        }
    }), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({
        "success": False,
        "error": {
            "code": "METHOD_NOT_ALLOWED",
            "message": "请求方法不允许"
        }
    }), 405

@app.errorhandler(500)
def server_error(e):
    return jsonify({
        "success": False,
        "error": {
            "code": "SERVER_ERROR",
            "message": "服务器内部错误"
        }
    }), 500

# 添加根路径端点
@app.route('/', methods=['GET'])
def index():
    """API首页，提供API信息"""
    return jsonify({
        "name": "钓鱼网站检测API服务",
        "version": "1.0.0",
        "status": "running",
        "model_status": {
            "loaded": model is not None,
            "predictions_made": prediction_count
        },
        "endpoints": {
            "/": "API信息（当前页面）",
            "/api/v1/init": "初始化/重新加载模型",
            "/api/v1/predict": "预测单个URL（POST请求，参数：url）",
            "/api/v1/predict/batch": "批量预测URL（POST请求，参数：urls）",
            "/api/v1/model/status": "获取模型状态"
        }
    })

# 添加初始化端点
@app.route('/api/v1/init', methods=['GET'])
def init_model():
    """初始化模型API端点"""
    try:
        if model is not None:
            return jsonify({
                "success": True,
                "message": "模型已经加载"
            })
            
        load_model()
        
        if model is not None:
            return jsonify({
                "success": True,
                "message": "模型加载成功"
            })
        else:
            return jsonify({
                "success": False,
                "error": {
                    "code": "MODEL_LOAD_ERROR",
                    "message": "模型加载失败，请查看服务器日志"
                }
            }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": {
                "code": "MODEL_LOAD_ERROR",
                "message": f"模型加载失败: {str(e)}"
            }
        }), 500

if __name__ == '__main__':
    try:
        # 检查模型文件是否存在
        if not os.path.exists(MODEL_PATH):
            print(f"警告: 模型文件 '{MODEL_PATH}' 不存在")
            print(f"当前工作目录: {os.getcwd()}")
            print("服务器将继续启动，但需要通过 /api/v1/init 端点手动初始化模型")
        elif not os.path.exists(CHAR_TO_IDX_PATH):
            print(f"警告: 字符映射文件 '{CHAR_TO_IDX_PATH}' 不存在")
            print(f"当前工作目录: {os.getcwd()}")
            print("服务器将继续启动，但需要通过 /api/v1/init 端点手动初始化模型")
        else:
            # 直接启动时预加载模型
            try:
                load_model()
                if model is not None:
                    print("模型加载成功，服务器启动中...")
                else:
                    print("模型加载失败，服务器将继续启动，但需要通过 /api/v1/init 端点手动初始化模型")
            except Exception as e:
                print(f"模型加载失败: {str(e)}")
                print("服务器将继续启动，但需要通过 /api/v1/init 端点手动初始化模型")
        
        # 启动服务器
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"服务器启动失败: {str(e)}")
        import traceback
        traceback.print_exc()
