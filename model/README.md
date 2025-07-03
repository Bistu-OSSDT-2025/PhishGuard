# 钓鱼网站检测系统

## 项目概述

这是一个基于深度学习的钓鱼网站检测系统，通过分析URL的特征来识别潜在的钓鱼网站。该系统使用字符级CNN模型，能够有效地检测各种类型的钓鱼URL。

## 目录结构

```
.
├── data/                  # 数据相关文件
│   ├── raw/               # 原始数据
│   ├── processed/         # 处理后的数据
│   └── data/              # 临时数据存储
├── docs/                  # 文档
├── models/                # 训练好的模型
├── scripts/               # 数据处理和训练脚本
├── src/                   # 源代码
├── tests/                 # 测试代码
├── wheels/                # 离线安装包
└── requirements.txt       # 项目依赖
```

### 目录说明

#### data/
- **raw/**: 存储原始的钓鱼URL和正常URL数据
  - `phishing_urls.txt`: 钓鱼网站URL列表
  - `normal_urls.txt`: 正常网站URL列表
  - `openphish_urls.txt`: 从OpenPhish获取的钓鱼URL
  - `clean_openphish_urls.txt`: 清洗后的OpenPhish URL
  
- **processed/**: 存储处理后的数据
  - `urls.csv`: 合并后的URL数据集，包含标签
  - `char_to_idx.json`: 字符到索引的映射字典
  - `new_phishing_urls.txt`: 新生成的钓鱼URL
  - `new_normal_urls.txt`: 新生成的正常URL

- **data/**: 临时数据存储目录
  - `normal_urls.txt`: 正常URL列表
  - `phishing_urls.txt`: 钓鱼URL列表
  - `new_normal_urls.txt`: 新生成的正常URL

#### docs/
- 项目文档和说明
- `README.md`: 项目说明文档
- `training_output.txt`: 训练日志输出

#### models/
- 存储训练好的模型文件
- `phishing_detector_model.keras`: 钓鱼网站检测模型

#### scripts/
- **数据获取脚本**:
  - `download_phishing_data.py`: 下载钓鱼网站数据
  - `download_normal.py`: 下载正常网站数据
  - `update_phishing_urls.py`: 更新钓鱼网站URL列表

- **数据生成脚本**:
  - `generate_new_phishing_urls.py`: 生成新的钓鱼URL样本
  - `generate_new_normal_urls.py`: 生成新的正常URL样本

- **数据处理脚本**:
  - `merge_txt_to_csv.py`: 将TXT文件合并为CSV格式

- **模型训练脚本**:
  - `train_model.py`: 训练钓鱼网站检测模型

#### src/
- 源代码目录
- `model.py`: 模型定义
- `predict_url.py`: URL预测功能
- `api.py`: API服务

#### tests/
- 测试代码
- `test_model.py`: 模型测试
- `new_test_model.py`: 新版模型测试

#### wheels/
- 离线安装包，用于在无网络环境下安装依赖
- 包含TensorFlow及其依赖的wheel文件

## 安装指南

### 环境要求
- Python 3.9+
- TensorFlow 2.11.0

### 安装依赖

```bash
pip install -r requirements.txt
```

如果在离线环境中安装，可以使用wheels目录中的离线包：

```bash
pip install --no-index --find-links=wheels/ -r requirements.txt
```

## 使用说明

### 训练模型

```bash
python scripts/train_model.py
```

这将处理数据并训练模型，训练好的模型将保存在`models/`目录下。

### 预测单个URL

```bash
python src/predict_url.py "https://example.com"
```

### 启动API服务

```bash
python src/api.py
```

API服务默认在本地8000端口运行，可以通过HTTP请求进行URL检测。

### 数据更新

更新钓鱼网站数据：

```bash
python scripts/download_phishing_data.py
```

更新正常网站数据：

```bash
python scripts/download_normal.py
```

生成新的样本数据：

```bash
python scripts/generate_new_phishing_urls.py
python scripts/generate_new_normal_urls.py
```

## 模型说明

该项目使用字符级CNN模型来检测钓鱼URL。模型将URL中的每个字符转换为向量，然后通过卷积神经网络进行特征提取和分类。这种方法能够有效地捕捉URL中的异常模式，从而识别潜在的钓鱼网站。

## 注意事项

- 模型的准确性取决于训练数据的质量和数量
- 定期更新钓鱼URL数据集以提高检测效果
- 在生产环境中使用前，建议进行充分的测试和验证
