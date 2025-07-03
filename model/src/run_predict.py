import requests

def load_domains(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        domains = [line.strip().lower() for line in f if line.strip()]
    return list(set(domains))  # 去重

def to_urls(domains):
    return [f"http://{d}" if not d.startswith("http") else d for d in domains]

def predict_batch(urls, api_url="http://127.0.0.1:5000/api/v1/predict/batch"):
    try:
        resp = requests.post(api_url, json={"urls": urls})
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"API请求失败: 状态码 {resp.status_code}")
            print(resp.text)
            return None
    except Exception as e:
        print("调用API出错:", e)
        return None

def main():
    file_path = "domains.txt"  # 你的域名文件
    domains = load_domains(file_path)
    urls = to_urls(domains)

    print(f"读取到 {len(urls)} 个URL，开始批量检测...")

    result = predict_batch(urls)
    if result and "results" in result:
        print("\n检测结果：")
        for item in result["results"]:
            mark = "⚠️ 钓鱼" if item["is_phishing"] else "✅ 安全"
            print(f"{item['url']:50} -> {mark}  (score: {item['phishing_score']:.2f})")
    else:
        print("没有得到有效的预测结果。")

if __name__ == "__main__":
    main()
