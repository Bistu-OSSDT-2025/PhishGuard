import pandas as pd

def load_urls(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

def merge_to_csv(normal_file, phishing_file, output_csv):
    # 读取正常网址
    normal_urls = load_urls(normal_file)
    normal_labels = [0] * len(normal_urls)

    # 读取钓鱼网址
    phishing_urls = load_urls(phishing_file)
    phishing_labels = [1] * len(phishing_urls)

    # 合并数据
    urls = normal_urls + phishing_urls
    labels = normal_labels + phishing_labels

    # 生成DataFrame
    df = pd.DataFrame({'url': urls, 'label': labels})

    # 打乱
    df = df.sample(frac=1).reset_index(drop=True)

    # 保存
    df.to_csv(output_csv, index=False)
    print(f"合并完成！保存为 {output_csv}")
    print(f"共 {len(df)} 条数据，其中正常：{len(normal_urls)}，钓鱼：{len(phishing_urls)}")

if __name__ == "__main__":
    # 文件名可根据你的实际文件改
    merge_to_csv('normal_urls_5000.txt', 'clean_openphish_urls.txt', 'urls.csv')
