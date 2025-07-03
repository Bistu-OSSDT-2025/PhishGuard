import os
import tensorflow as tf

MODEL_PATH = 'phishing_detector_model.keras'  # 你现在的模型路径，按实际改

def check_and_load_model(model_path):
    print(f"检查模型路径：{model_path}")
    if not os.path.exists(model_path):
        print("错误：模型路径不存在！请确认模型文件或目录已经放到该位置。")
        return None

    if os.path.isfile(model_path):
        print("模型路径是一个文件。")
    elif os.path.isdir(model_path):
        print("模型路径是一个目录。")
    else:
        print("模型路径既不是文件也不是目录，格式异常。")
        return None

    try:
        print("尝试加载模型...")
        model = tf.keras.models.load_model(model_path)
        print("模型加载成功！")
        return model
    except Exception as e:
        print("加载模型时出错：")
        print(e)
        return None

if __name__ == "__main__":
    model = check_and_load_model(MODEL_PATH)
    if model is None:
        print("请确认模型文件是否正确，或重新训练生成模型。")
    else:
        print("模型准备就绪，可以继续后续工作。")
