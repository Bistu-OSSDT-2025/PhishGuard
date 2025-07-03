# 钓鱼URL检测模型

## 什么是钓鱼URL？为什么需要检测？

钓鱼URL是一种网络欺诈手段，攻击者通过伪装成可信赖的网站（如银行、社交媒体或电子商务网站）来窃取用户的敏感信息。例如：
- ✅ 正常URL: `https://www.paypal.com/signin`
- ❌ 钓鱼URL: `https://paypa1-secure.com/signin` (注意：使用数字"1"代替字母"l")

本项目使用深度学习技术自动识别这些潜在的钓鱼网站链接，帮助保护用户的网络安全。

## 项目功能

- 🔍 检测单个或多个URL是否为钓鱼网站
- 🤖 使用先进的深度学习模型（CNN）进行分析
- 📊 支持批量处理大量URL
- 🌐 提供简单的API接口
- ⚡ 快速响应，实时检测
- 📈 可以训练自己的模型

## 开始使用

### 1. 准备环境

#### 安装Python
如果你还没有安装Python，请先从[Python官网](https://www.python.org/downloads/)下载并安装Python 3.7或更高版本。

在Windows系统中，打开命令提示符(cmd)并输入以下命令检查Python是否安装成功：
```bash
python --version
```
你应该看到类似这样的输出：`Python 3.9.7`

#### 下载项目
1. 下载这个项目的ZIP文件并解压，或使用git克隆：
```bash
git clone [项目地址]
cd [项目目录]
```

#### 创建必要的目录结构
确保项目中有`data`目录用于存储模型和数据文件：
```bash
mkdir -p data
```

#### 安装依赖包
在项目目录下打开命令提示符，运行：
```bash
pip install -r requirements.txt
```

如果安装过程中遇到错误，可以尝试：
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. 快速开始

#### 方法1：使用预训练模型（推荐新手使用）

如果`data`目录中已经有预训练模型(`phishing_detector_model.keras`)和字符映射文件(`char_to_idx.json`)，可以直接使用：

1. 打开命令提示符，进入项目目录
2. 运行预测脚本：
```bash
python predict_url.py
```
3. 在提示处输入要检测的URL，例如：
```
请输入要检测的URL: https://example.com
```
4. 查看检测结果：
```
检测结果：
URL: https://example.com
判定: 正常网站
置信度: 95.6%
```

#### 方法2：训练自己的模型

如果你想使用自己的数据训练模型，请按以下步骤操作：

1. 准备训练数据
```bash
# 下载钓鱼URL数据
python download_phishing_data.py

# 下载正常URL数据
python download_normal.py

# 合并数据集
python merge_txt_to_csv.py
```

2. 训练模型
```bash
python train_model.py
```

训练过程示例输出：
```
正在加载数据...
找到10000条训练数据
开始训练模型...
第1轮/共10轮
500/500 [==============================] - loss: 0.2314 - accuracy: 0.9124
...
模型训练完成！
模型已保存到: data/phishing_detector_model.keras
```

> **注意**：训练完成后，模型和字符映射文件会自动保存在`data`目录下：
> - 模型文件：`data/phishing_detector_model.keras`
> - 字符映射文件：`data/char_to_idx.json`

### 3. 使用API服务

如果你想在其他程序中使用这个检测功能，可以启动API服务：

1. 启动服务
```bash
python api.py
```

你可能会看到类似以下的输出：
```
2025-07-03 01:30:59.643193: W tensorflow/stream_executor/platform/default/dso_loader.cc:64] Could not load dynamic library 'cudart64_110.dll'; dlerror: cudart64_110.dll not found
2025-07-03 01:30:59.643413: I tensorflow/stream_executor/cuda/cudart_stub.cc:29] Ignore above cudart dlerror if you do not have a GPU set up on your machine.
 * Serving Flask app 'api'
 * Debug mode: on
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

> **注意**：关于CUDA警告可以忽略，这只是表示TensorFlow找不到GPU驱动，会自动使用CPU模式运行。

2. 测试API（使用浏览器、curl或Postman）

单个URL检测：
```bash
# 使用curl命令
curl -X POST http://localhost:5000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 返回结果示例
{
    "prediction": "normal",
    "confidence": 0.956,
    "url": "https://example.com"
}
```

批量URL检测：
```bash
# 使用curl命令
curl -X POST http://localhost:5000/api/v1/predict_batch \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com", "http://suspicious-site.com"]}'

# 返回结果示例
{
    "results": [
        {
            "prediction": "normal",
            "confidence": 0.956,
            "url": "https://example.com"
        },
        {
            "prediction": "phishing",
            "confidence": 0.892,
            "url": "http://suspicious-site.com"
        }
    ]
}
```

## 常见问题解答

### 1. 安装依赖时出错
Q: 安装TensorFlow时报错怎么办？
A: 尝试以下解决方案：
   - 确保Python版本兼容（推荐3.7-3.9）
   - 更新pip: `pip install --upgrade pip`
   - 如果仍然失败，可以尝试安装CPU版本：`pip install tensorflow-cpu`

### 2. 模型准确率问题
Q: 为什么有时候预测结果看起来不准确？
A: 模型的准确性取决于训练数据的质量和数量。你可以：
   - 使用更多的训练数据
   - 确保训练数据的质量
   - 尝试调整模型参数（在train_model.py中）

### 3. URL长度限制
Q: 能检测多长的URL？
A: 当前模型支持最大200字符的URL。如果URL更长，会自动截断到200字符。

### 4. CUDA相关警告
Q: 启动时看到"Could not load dynamic library 'cudart64_110.dll'"警告是什么意思？
A: 这只是表示TensorFlow找不到GPU驱动，会自动使用CPU模式运行。这不会影响程序功能，只是无法使用GPU加速。如果你想使用GPU加速，需要安装CUDA和cuDNN。

### 5. 模型文件不存在
Q: 运行API时提示"模型文件不存在"怎么办？
A: 这表示你需要先训练模型或确保模型文件在正确的位置。请先运行`train_model.py`来训练模型，或者确保`data`目录中有以下文件：
   - `phishing_detector_model.keras`
   - `char_to_idx.json`

## 技术细节

### 模型架构说明

这个项目使用了CNN（卷积神经网络）来分析URL。工作原理：

1. **输入处理**：
   - URL转换为字符序列
   - 每个字符映射为数字（使用`char_to_idx.json`）
   - 填充或截断到固定长度（200字符）

2. **模型结构**：
   ```
   输入 (URL字符序列)
      ↓
   字符嵌入层 (将字符转换为向量)
      ↓
   卷积层 (提取特征)
      ↓
   池化层 (提取重要信息)
      ↓
   全连接层 (最终分类)
      ↓
   输出 (钓鱼/正常 概率)
   ```

### 训练参数详解

- **批次大小(batch_size)**: 32
  - 每次处理32个URL样本
  - 较小的批次有助于模型更好地学习

- **训练轮数(epochs)**: 10
  - 整个数据集会被处理10次
  - 可以根据需要增加或减少

- **验证集比例**: 20%
  - 用于评估模型性能
  - 防止过拟合

### API端点说明

API服务提供以下端点：

1. **单个URL检测**
   - 端点：`/api/v1/predict`
   - 方法：POST
   - 请求体：`{"url": "https://example.com"}`
   - 响应：`{"prediction": "normal", "confidence": 0.956, "url": "https://example.com"}`

2. **批量URL检测**
   - 端点：`/api/v1/predict_batch`
   - 方法：POST
   - 请求体：`{"urls": ["https://example.com", "http://suspicious-site.com"]}`
   - 响应：包含每个URL的预测结果数组

3. **模型初始化**（如果模型未加载）
   - 端点：`/api/v1/init`
   - 方法：POST
   - 请求体：无需参数
   - 响应：`{"status": "success", "message": "模型已成功初始化"}`

## 项目文件说明

```
项目目录/
├── data/                           # 数据和模型文件夹
│   ├── phishing_detector_model.keras  # 训练好的模型
│   ├── char_to_idx.json           # 字符到数字的映射
│   ├── normal_urls.txt            # 正常URL数据集
│   └── phishing_urls.txt          # 钓鱼URL数据集
├── api.py                         # API服务
├── model.py                       # 模型定义
├── train_model.py                 # 训练脚本
├── predict_url.py                 # 预测脚本
├── download_phishing_data.py      # 下载钓鱼URL
├── download_normal.py             # 下载正常URL
├── merge_txt_to_csv.py            # 数据处理
└── requirements.txt               # 项目依赖
```

## 使用建议

1. **首次使用**：
   - 先用预训练模型测试
   - 熟悉基本功能后再尝试训练自己的模型

2. **数据收集**：
   - 确保有足够的训练数据（建议至少1000条）
   - 保持正常URL和钓鱼URL数量的平衡

3. **定期更新**：
   - 定期更新钓鱼URL数据库
   - 重新训练模型以适应新的钓鱼技术

4. **性能优化**：
   - 对于大量URL，使用批量预测接口
   - 考虑使用GPU加速训练过程（需安装CUDA和cuDNN）

5. **API使用**：
   - 在生产环境中，建议使用WSGI服务器（如Gunicorn或uWSGI）
   - 添加身份验证机制保护API
   - 考虑添加速率限制防止滥用

## 故障排除指南

### 模型训练问题

1. **内存不足**
   - 症状：训练过程中出现内存错误
   - 解决方案：减小批次大小（在`train_model.py`中修改`batch_size`）

2. **训练时间过长**
   - 症状：训练一轮需要很长时间
   - 解决方案：
     - 减少训练数据量
     - 使用GPU加速（需安装CUDA和cuDNN）
     - 减少训练轮数（在`train_model.py`中修改`epochs`）

### API服务问题

1. **端口被占用**
   - 症状：启动API时提示"端口5000已被使用"
   - 解决方案：修改`api.py`中的端口号：
     ```python
     if __name__ == '__main__':
         app.run(host='0.0.0.0', port=5001, debug=True)  # 修改为其他端口
     ```

2. **模型加载失败**
   - 症状：API启动但无法预测
   - 解决方案：
     - 确保`data`目录中有模型文件和字符映射文件
     - 使用`/api/v1/init`端点手动初始化模型
     - 检查文件权限

## 安全提示

- 本工具仅作为辅助判断，不应完全依赖其结果
- 对于重要网站，建议：
  - 直接在浏览器输入网址
  - 使用书签
  - 检查SSL证书
  - 留意浏览器的安全警告
- 即使模型判断为安全，也应保持警惕，特别是涉及敏感信息（如银行账户、密码）的网站
- 定期更新模型以应对新的钓鱼技术

## 开发者指南

### 扩展模型

如果你想改进模型性能，可以考虑以下方向：

1. **特征工程**：
   - 添加URL长度、域名长度等特征
   - 分析URL中的特殊字符分布
   - 考虑域名注册信息

2. **模型架构**：
   - 尝试不同的神经网络架构（如LSTM、Transformer）
   - 增加网络深度或宽度
   - 使用预训练的词嵌入

3. **数据增强**：
   - 生成合成的钓鱼URL样本
   - 使用数据增强技术扩充训练集

### 代码结构说明

- **api.py**: 实现REST API服务
- **model.py**: 定义神经网络模型结构
- **train_model.py**: 实现模型训练逻辑
- **predict_url.py**: 提供命令行预测接口
- **download_*.py**: 数据收集脚本

## 贡献指南

我们欢迎各种形式的贡献，无论是：
- 报告问题
- 提供改进建议
- 提交代码
- 完善文档

提交代码时请遵循以下步骤：
1. Fork项目
2. 创建新分支
3. 提交改动
4. 发起Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

如有问题或建议，欢迎：
- 提交 Issue
- 发送邮件至：[your-email@example.com]

## 致谢

感谢所有为这个项目做出贡献的人！