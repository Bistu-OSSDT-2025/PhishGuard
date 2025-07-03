import tensorflow as tf
import numpy as np
from sklearn.model_selection import train_test_split

# 1. 加载数据
def load_urls(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

phishing_urls = load_urls('clean_openphish_urls.txt')
normal_urls = load_urls('normal_urls.txt')

# 合并数据和标签
urls = phishing_urls + normal_urls
labels = [1]*len(phishing_urls) + [0]*len(normal_urls)

print(f"Total samples: {len(urls)}")

# 2. 创建字符字典
all_chars = sorted(list(set(''.join(urls))))
char_to_idx = {c:i+1 for i,c in enumerate(all_chars)}  # 0用于padding
max_len = 200  # URL最大长度

def url_to_seq(url):
    seq = [char_to_idx.get(c, 0) for c in url[:max_len]]
    seq += [0]*(max_len - len(seq))
    return seq

X = np.array([url_to_seq(u) for u in urls])
y = np.array(labels)

# 3. 划分训练集和验证集
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. 定义模型
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

# 5. 训练
model.fit(X_train, y_train, batch_size=128, epochs=10, validation_data=(X_val, y_val))

# 6. 保存模型
model.save('phishing_detector_model.keras')
