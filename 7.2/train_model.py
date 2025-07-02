import tensorflow as tf
import numpy as np
from sklearn.model_selection import train_test_split
import os
import json

max_len = 200  # URL最大长度

def load_urls(file_path):
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}，跳过加载。")
        return []
    with open(file_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

# 1. 读取旧数据和新数据（新数据文件可以先空着或者不存在）
old_phishing = load_urls('data/phishing_urls.txt')
old_normal = load_urls('data/normal_urls.txt')
new_phishing = load_urls('data/new_phishing_urls.txt')
new_normal = load_urls('data/new_normal_urls.txt')

# 2. 合并数据，去重
all_phishing = list(set(old_phishing + new_phishing))
all_normal = list(set(old_normal + new_normal))

# 3. 保存合并后的数据覆盖旧文件
os.makedirs('data', exist_ok=True)
with open('data/phishing_urls.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(all_phishing))
with open('data/normal_urls.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(all_normal))

# 4. 标签和数据合并
urls = all_phishing + all_normal
labels = [1]*len(all_phishing) + [0]*len(all_normal)
print(f"训练样本总数: {len(urls)}")

# 5. 生成字符字典并保存
all_chars = sorted(list(set(''.join(urls))))
char_to_idx = {c: i+1 for i, c in enumerate(all_chars)}  # 0 用作 padding

with open('char_to_idx.json', 'w', encoding='utf-8') as f:
    json.dump(char_to_idx, f, ensure_ascii=False)

# 6. 网址转序列
def url_to_seq(url):
    seq = [char_to_idx.get(c, 0) for c in url[:max_len]]
    seq += [0] * (max_len - len(seq))
    return seq

X = np.array([url_to_seq(u) for u in urls])
y = np.array(labels)

# 7. 划分训练集和验证集
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

# 8. 定义模型
model = tf.keras.Sequential([
    tf.keras.layers.Embedding(input_dim=len(char_to_idx)+1, output_dim=64, input_length=max_len),
    tf.keras.layers.Conv1D(128, 5, activation='relu'),
    tf.keras.layers.MaxPooling1D(2),
    tf.keras.layers.Conv1D(128, 3, activation='relu'),
    tf.keras.layers.GlobalMaxPooling1D(),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
model.summary()

# 9. 训练模型
model.fit(X_train, y_train, batch_size=128, epochs=30, validation_data=(X_val, y_val))

# 10. 保存模型
model.save('phishing_detector_model.keras')
print("模型训练完成并保存！")
