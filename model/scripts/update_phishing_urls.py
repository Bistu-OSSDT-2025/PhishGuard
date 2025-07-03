import os

def load_urls(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

def save_urls(urls, file_path):
    with open(file_path, 'w', encoding='utf-8') as f:
        for url in sorted(urls):
            f.write(url + '\n')

def update_phishing_urls(old_file, new_file):
    old_urls = set(load_urls(old_file))
    new_urls = set(load_urls(new_file))
    combined = old_urls.union(new_urls)
    print(f"旧数据条数: {len(old_urls)}")
    print(f"新增条数: {len(new_urls)}")
    print(f"合并后总条数: {len(combined)}")
    save_urls(combined, old_file)
    print(f"已更新文件: {old_file}")

if __name__ == "__main__":
    old_file = 'data/phishing_urls.txt'        # 原数据库文件
    new_file = 'data/new_phishing_urls.txt'    # 新增钓鱼网址文件

    update_phishing_urls(old_file, new_file)
