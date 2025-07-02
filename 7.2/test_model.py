import os
import sys
import json
import tensorflow as tf
import numpy as np

# 配置
MODEL_PATH = 'phishing_detector_model.keras'
CHAR_TO_IDX_PATH = 'char_to_idx.json'

def main():
    print("开始测试模型加载...")
    print(f"当前工作目录: {os.getcwd()}")
    print(f"目录内容: {os.listdir('.')}")

    # 检查文件是否存在
    if not os.path.exists(MODEL_PATH):
        print(f"错误: 模型文件 '{MODEL_PATH}' 不存在")
        return
    else:
        print(f"模型文件存在，大小: {os.path.getsize(MODEL_PATH)} 字节")

    if not os.path.exists(CHAR_TO_IDX_PATH):
        print(f"错误: 字符映射文件 '{CHAR_TO_IDX_PATH}' 不存在")
        return
    else:
        print(f"字符映射文件存在，大小: {os.path.getsize(CHAR_TO_IDX_PATH)} 字节")

    try:
        # 加载字符字典
        print("尝试加载字符字典...")
        with open(CHAR_TO_IDX_PATH, 'r', encoding='utf-8') as f:
            char_to_idx = json.load(f)
        print(f"字符字典加载成功，包含 {len(char_to_idx)} 个字符")

        # 加载模型
        print("尝试加载模型...")
        model = tf.keras.models.load_model(MODEL_PATH)
        print("模型加载成功")
        print(f"模型摘要: {model.summary()}")

        # 测试预测
        print("尝试进行测试预测...")
        test_url = "https://example.com"
        seq = [char_to_idx.get(c, 0) for c in test_url[:200]]
        seq += [0] * (200 - len(seq))
        pred = float(model.predict(np.array([seq]))[0][0])
        print(f"测试URL '{test_url}' 的预测结果: {pred}")

        print("测试完成，一切正常")

    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
