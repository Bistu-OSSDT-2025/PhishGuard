import random

def generate_phishing_url():
    domains = ['com', 'net', 'org', 'cn', 'xyz']
    phishing_words = ['login', 'secure', 'update', 'verify', 'account', 'bank', 'confirm', 'webscr']
    prefix = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz', k=5))
    phishing_part = random.choice(phishing_words)
    suffix_num = random.randint(10, 9999)
    domain = random.choice(domains)
    # 拼接成像钓鱼的URL，比如 www.login1234secure.com
    return f"http://www.{phishing_part}{suffix_num}{prefix}.{domain}"

with open('phishing_urls.txt', 'w', encoding='utf-8') as f:
    for _ in range(100000):
        url = generate_phishing_url()
        f.write(url + '\n')

print("生成10万条模拟钓鱼网址完成，保存到 phishing_urls.txt")
