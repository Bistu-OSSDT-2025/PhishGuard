import tensorflow as tf
import numpy as np
import json

max_len = 200

# 加载字符字典
with open('char_to_idx.json', 'r', encoding='utf-8') as f:
    char_to_idx = json.load(f)

# 加载模型
model = tf.keras.models.load_model('phishing_detector_model.keras')

# 白名单域名
trusted_sites = [
    "bistu.edu.cn",
    "tsinghua.edu.cn",
    "pku.edu.cn",
    "moe.gov.cn",
    "gov.cn",
    "edu.cn"
]

def url_to_seq(url):
    seq = [char_to_idx.get(c, 0) for c in url[:max_len]]
    seq += [0] * (max_len - len(seq))
    return np.array([seq])

while True:
    url = input("请输入网址（输入exit退出）：").strip()
    if url.lower() == 'exit':
        break

    # 白名单检测
    if any(site in url for site in trusted_sites):
        print(f"{url} -> 经检测，为正常网站")
        continue

    # 模型预测
    seq = url_to_seq(url)
    pred = model.predict(seq)[0][0]
    print(f"{url} -> 钓鱼概率: {pred:.4f}")
    print("预测结果:", "钓鱼网站" if pred > 0.5 else "正常网站")


