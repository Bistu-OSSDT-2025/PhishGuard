# 子非鱼-PhishGuard

## 项目概述

子非鱼-PhishGuard 是一个企业级钓鱼网站检测与实时防护解决方案，旨在通过多引擎检测机制和浏览器用户脚本，有效识别并防御各类钓鱼攻击。该项目结合了基于深度学习的URL分析模型、云端API检测以及AI大模型（DeepSeek）的智能分析能力，为用户提供全面的安全保障。

后端模型部分采用字符级CNN模型，通过分析URL特征来识别潜在的钓鱼网站。前端用户脚本（Tampermonkey脚本）则实现了实时防护功能，能够在用户访问网页时，利用本地模型、云端API和DeepSeek API进行多重检测，并及时发出预警。

## 主要特性

- **多引擎检测**：集成本地深度学习模型、云端API和DeepSeek AI大模型，提供多层次的检测能力。
- **实时防护**：通过浏览器用户脚本，在用户访问网页时进行实时URL检测和预警。
- **URL特征分析**：后端模型能够深入分析URL的长度、特殊字符比例、TLD类型、路径深度等特征。
- **可扩展性**：支持集成更多检测引擎和数据源。
- **易于部署**：后端模型提供API服务，方便集成到其他系统中；前端脚本易于安装和配置。
- **数据驱动**：模型训练依赖于大量的钓鱼和正常URL数据，并通过脚本支持数据更新。




## 目录结构

```
PhishGuard/
├── LICENSE
├── README.md
├── model/                   # 后端深度学习模型及相关脚本
│   ├── data/                # 数据集（原始、处理后、临时）
│   ├── docs/                # 模型相关文档
│   ├── models/              # 训练好的模型文件
│   ├── scripts/             # 数据处理、模型训练和数据获取脚本
│   ├── src/                 # 模型核心代码和API服务
│   ├── tests/               # 模型测试代码
│   └── requirements.txt     # 模型依赖
└── web/                     # 前端浏览器用户脚本
    └── 子非鱼-PhishGuard_V0.1.js # Tampermonkey用户脚本
```

### 目录说明

- **`model/`**: 包含钓鱼网站检测的深度学习模型、数据处理脚本、训练脚本以及用于提供预测服务的API。
  - `data/`: 存放用于模型训练和测试的URL数据集，包括原始数据、处理后的数据和临时数据。
  - `docs/`: 包含模型训练日志和相关说明文档。
  - `models/`: 存储训练好的深度学习模型文件，如`phishing_detector_model.keras`。
  - `scripts/`: 提供数据下载、数据生成、数据合并以及模型训练的自动化脚本。
  - `src/`: 包含模型定义、URL预测逻辑和API服务接口的源代码。
  - `tests/`: 用于验证模型功能和性能的测试代码。
  - `requirements.txt`: 列出了运行后端模型所需的Python库依赖。

- **`web/`**: 包含用于浏览器实时防护的用户脚本。
  - `子非鱼-PhishGuard_V0.1.js`: 一个Tampermonkey用户脚本，负责在浏览器端进行URL检测，并与后端API和DeepSeek API进行交互，实现实时预警功能。




## 安装指南

### 后端模型

1.  **克隆仓库**：
    ```bash
    git clone https://github.com/Bistu-OSSDT-2025/PhishGuard.git
    cd PhishGuard/model
    ```

2.  **环境要求**：
    - Python 3.9+
    - TensorFlow 2.11.0

3.  **安装依赖**：
    ```bash
    pip install -r requirements.txt
    ```
    如果在离线环境中安装，可以使用`wheels/`目录中的离线包：
    ```bash
    pip install --no-index --find-links=wheels/ -r requirements.txt
    ```

### 前端用户脚本

1.  **安装Tampermonkey**：
    在您的浏览器（Chrome, Firefox, Edge等）中安装Tampermonkey扩展。

2.  **安装用户脚本**：
    - 打开`PhishGuard/web/子非鱼-PhishGuard_V0.1.js`文件。
    - 将文件内容复制到Tampermonkey的新脚本编辑器中并保存。
    - 确保脚本已启用。




## 使用说明

### 后端模型

1.  **训练模型**：
    ```bash
    python scripts/train_model.py
    ```
    这将处理数据并训练模型，训练好的模型将保存在`model/models/`目录下。

2.  **预测单个URL**：
    ```bash
    python src/predict_url.py "https://example.com"
    ```

3.  **启动API服务**：
    ```bash
    python src/api.py
    ```
    API服务默认在本地8000端口运行，可以通过HTTP请求进行URL检测。

4.  **数据更新**：
    - 更新钓鱼网站数据：
      ```bash
      python scripts/download_phishing_data.py
      ```
    - 更新正常网站数据：
      ```bash
      python scripts/download_normal.py
      ```
    - 生成新的样本数据：
      ```bash
      python scripts/generate_new_phishing_urls.py
      python scripts/generate_new_normal_urls.py
      ```

### 前端用户脚本

安装并启用Tampermonkey脚本后，它将在您访问网页时自动运行。当检测到潜在的钓鱼网站时，脚本会发出预警。

**配置DeepSeek API Key**：

用户脚本支持DeepSeek API进行更高级的检测。您需要在Tampermonkey脚本中配置您的DeepSeek API Key。在脚本的`设置`部分找到`DEEPSEEK_API_KEY`，并替换为您的密钥。


**配置云端API Key**[暂未实现云端部署]：

如果使用云端API检测，您还需要在Tampermonkey脚本中配置您的云端检测 API Key。在脚本的`设置`部分找到`CLOUD_API_KEY`，并替换为您的密钥。




## 模型说明

后端模型使用字符级CNN（卷积神经网络）来检测钓鱼URL。该模型将URL中的每个字符转换为向量表示，然后通过多层卷积和池化操作提取高级特征。这些特征随后被送入全连接层进行分类，判断URL是否为钓鱼网站。这种方法能够有效地捕捉URL中的细微模式和异常结构，从而提高钓鱼网站的识别准确率。

## 注意事项

- 模型的准确性高度依赖于训练数据的质量和数量。建议定期更新和扩充钓鱼与正常URL数据集，以提高检测效果。
- 在生产环境中部署和使用本系统之前，务必进行充分的测试和验证，以确保其稳定性和可靠性。
- 前端用户脚本需要Tampermonkey等浏览器扩展支持，并可能需要用户手动配置API密钥以启用云端和DeepSeek检测功能。

## 贡献

欢迎对本项目进行贡献。如果您有任何改进建议、新功能需求或Bug报告，请通过GitHub Issues提交。

## 许可证

本项目采用MIT许可证。详情请参阅 `LICENSE` 文件。


