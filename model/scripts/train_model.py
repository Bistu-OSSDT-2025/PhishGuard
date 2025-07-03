import tensorflow as tf
import numpy as np
from sklearn.model_selection import train_test_split
import os
import json
import sys

# 添加调试信息
print("Python版本:", sys.version)
print("TensorFlow版本:", tf.__version__)
print("当前工作目录:", os.getcwd())

max_len = 200  # URL最大长度

def load_urls(file_path):
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}，跳过加载。")
        return []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip()]
            print(f"从 {file_path} 加载了 {len(urls)} 条URL")
            return urls
    except Exception as e:
        print(f"加载文件 {file_path} 时出错: {e}")
        return []

# 1. 读取旧数据和新数据（新数据文件可以先空着或者不存在）
# 获取项目根目录路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print(f"项目根目录: {project_root}")

# 使用绝对路径
# 修改文件路径以匹配实际目录结构
old_phishing = load_urls(os.path.join(project_root, 'data/data/phishing_urls.txt'))
old_normal = load_urls(os.path.join(project_root, 'data/data/normal_urls.txt'))
new_phishing = load_urls(os.path.join(project_root, 'data/data/new_phishing_urls.txt'))
new_normal = load_urls(os.path.join(project_root, 'data/data/new_normal_urls.txt'))

# 2. 合并数据，去重
all_phishing = list(set(old_phishing + new_phishing))
all_normal = list(set(old_normal + new_normal))

# 3. 保存合并后的数据覆盖旧文件
os.makedirs(os.path.join(project_root, 'data/data'), exist_ok=True)
with open(os.path.join(project_root, 'data/data/phishing_urls.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(all_phishing))
with open(os.path.join(project_root, 'data/data/normal_urls.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(all_normal))

# 4. 标签和数据合并
urls = all_phishing + all_normal
labels = [1]*len(all_phishing) + [0]*len(all_normal)
print(f"训练样本总数: {len(urls)}")

# 5. 生成字符字典并保存
all_chars = sorted(list(set(''.join(urls))))
char_to_idx = {c: i+1 for i, c in enumerate(all_chars)}  # 0 用作 padding

os.makedirs(os.path.join(project_root, 'data/processed'), exist_ok=True)
with open(os.path.join(project_root, 'data/processed/char_to_idx.json'), 'w', encoding='utf-8') as f:
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
model.fit(X_train, y_train, batch_size=128, epochs=10, validation_data=(X_val, y_val))

# 10. 保存模型
os.makedirs(os.path.join(project_root, 'models'), exist_ok=True)
model_save_path = os.path.join(project_root, 'models', 'phishing_detector_model.keras')
print(f"正在保存模型到: {model_save_path}")
model.save(model_save_path)  # 使用Keras格式保存
print(f"模型训练完成并保存到: {model_save_path}")

# 验证模型是否已保存
if os.path.exists(model_save_path):
    print(f"模型文件已创建: {model_save_path}")
    print(f"模型文件大小: {os.path.getsize(model_save_path)} 字节")
else:
    print(f"错误: 模型文件未创建: {model_save_path}")

# 保存字符映射
char_to_idx_path = os.path.join(project_root, 'data/processed', 'char_to_idx.json')
print(f"正在保存字符映射到: {char_to_idx_path}")
with open(char_to_idx_path, 'w', encoding='utf-8') as f:
    json.dump(char_to_idx, f, ensure_ascii=False, indent=2)
print(f"字符映射已保存到: {char_to_idx_path}")
