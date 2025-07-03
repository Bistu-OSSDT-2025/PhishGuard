import requests
import csv
import zipfile
import io
import os

def download_openphish(output_file='data/raw/openphish_urls.txt'):
    print("Downloading OpenPhish data...")
    url = 'https://openphish.com/feed.txt'
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            urls = r.text.strip().split('\n')
            # 确保输出目录存在
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                for u in urls:
                    f.write(u + '\n')
            print(f"OpenPhish URLs saved to {output_file}, total: {len(urls)}")
        else:
            print(f"Failed to download OpenPhish data. Status code: {r.status_code}")
    except Exception as e:
        print(f"Error downloading OpenPhish data: {e}")

def download_phishtank(output_file='data/raw/phishtank_urls.txt'):
    print("Downloading PhishTank data requires registration and manual download.")
    print("This script cannot download PhishTank data automatically due to API and login requirements.")
    print("You can manually download from https://www.phishtank.com/developer_info.php")
    # 这里暂时不自动下载，提示用户手动操作

def clean_urls(input_file, output_file):
    import os
    print(f"Cleaning URLs from {input_file} ...")
    urls = set()
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            url = line.strip()
            if url and url.startswith('http'):
                urls.add(url)
    with open(output_file, 'w', encoding='utf-8') as f:
        for url in sorted(urls):
            f.write(url + '\n')
    print(f"Cleaned URLs saved to {output_file}, total: {len(urls)}")

def main():
    # 确保目录存在
    os.makedirs('data/raw', exist_ok=True)
    
    # 下载OpenPhish数据
    download_openphish()
    # PhishTank需手动下载
    download_phishtank()
    
    # 清洗数据
    clean_urls('data/raw/openphish_urls.txt', 'data/raw/phishing_urls.txt')
    # 你也可以把PhishTank数据手动放到文件，再用clean_urls清洗
    
if __name__ == '__main__':
    main()
