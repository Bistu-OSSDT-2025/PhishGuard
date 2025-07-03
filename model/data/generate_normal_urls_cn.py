import random
import os

def generate_cn_edu_gov_urls(count=5000):
    second_level = ['jwgl', 'oa', 'news', 'portal', 'login', 'bbs', 'mail', 'vpn', 'hr', 'info']
    bases = [
        'bistu', 'tsinghua', 'pku', 'nju', 'fudan', 'cqu', 'scu', 'zju', 'ruc',
        'beijing', 'shanghai', 'tianjin', 'guangdong', 'hebei', 'mofcom', 'moe',
        'gov', 'sdut', 'hzau', 'ncepu', 'bupt', 'xjtu', 'xmu', 'nankai', 'hust'
    ]
    domains = ['edu.cn', 'gov.cn', 'org.cn', 'com.cn']
    paths = ['', '/index.jsp', '/index.html', '/portal', '/login', '/jwgl', '/home', '/news']

    urls = []
    for _ in range(count):
        protocol = random.choice(['http', 'https'])
        sub = random.choice(second_level)
        base = random.choice(bases)
        domain = random.choice(domains)
        path = random.choice(paths)
        query = random.choice(['', '?id=123', '?lang=zh', '?user=admin', '?page=1'])
        urls.append(f"{protocol}://{sub}.{base}.{domain}{path}{query}")
    return urls

# 确保 data/raw 目录存在
os.makedirs("data/raw", exist_ok=True)

# 保存到文件中（覆盖方式）
output_path = 'data/raw/normal_urls.txt'
with open(output_path, 'w', encoding='utf-8') as f:
    for url in generate_cn_edu_gov_urls():
        f.write(url + '\n')

print(f"✅ 已成功生成 5000 条中国教育/政府风格网址到 {output_path}")

