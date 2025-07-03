import requests
import os

def download_top_sites_txt(output_file='normal_urls.txt', top_n=10000):
    print("当前工作目录是:", os.getcwd())
    print("Downloading common top sites list...")

    # 使用 Github 上的常用网站列表（每行一个域名）
    url = 'https://raw.githubusercontent.com/tenox7/wikidata-top-100000/master/top-100000.txt'
    r = requests.get(url)
    if r.status_code != 200:
        print("Failed to download top sites list")
        return

    lines = r.text.strip().splitlines()
    count = 0
    with open(output_file, 'w', encoding='utf-8') as f:
        for domain in lines:
            if count >= top_n:
                break
            f.write(f'https://{domain}\n')
            count += 1

    print(f"Saved top {count} normal URLs to {output_file}")

if __name__ == "__main__":
    download_top_sites_txt()
