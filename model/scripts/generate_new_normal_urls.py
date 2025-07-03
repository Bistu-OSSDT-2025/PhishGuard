import random

def generate_normal_url():
    domains = ['com', 'net', 'org', 'cn', 'xyz']
    prefix = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz', k=7))
    suffix_num = random.randint(1, 99999)
    domain = random.choice(domains)
    return f"http://www.{prefix}{suffix_num}.{domain}"

with open('new_normal_urls.txt', 'w', encoding='utf-8') as f:
    for _ in range(100000):
        url = generate_normal_url()
        f.write(url + '\n')

print("生成10万条模拟正常网址完成，保存到 new_normal_urls.txt")
