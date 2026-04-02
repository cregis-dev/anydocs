# Classic Docs Theme 配置说明

本文说明 `classic-docs` 阅读主题的可配置项、推荐写法，以及在 Studio 中对应的设置入口。

## 适用范围

- 主题 ID：`classic-docs`
- 配置位置：`anydocs.config.json -> site.theme`
- 配置来源：
  - 直接编辑项目配置文件
  - 通过 Studio 的 Project Settings 保存

---

## 最小配置

如果你只想使用默认的黑白风格，可以只保留主题 ID：

```json
{
  "site": {
    "theme": {
      "id": "classic-docs"
    }
  }
}
```

这会启用：

- 左侧固定导航布局
- 默认黑白中性色
- 侧边栏搜索
- 底部语言选择器

---

## 完整字段

`classic-docs` 当前支持以下字段：

```json
{
  "site": {
    "theme": {
      "id": "classic-docs",
      "branding": {
        "siteTitle": "AI Knowledge Base",
        "homeLabel": "Docs Home",
        "logoSrc": "/logo/brand.svg",
        "logoAlt": "AI Knowledge Base logo"
      },
      "chrome": {
        "showSearch": true
      },
      "colors": {
        "primary": "#111111",
        "primaryForeground": "#ffffff",
        "accent": "#f3f3ef",
        "accentForeground": "#111111",
        "sidebarActive": "#111111",
        "sidebarActiveForeground": "#ffffff"
      },
      "codeTheme": "github-dark"
    }
  }
}
```

---

## 字段说明

### `branding`

#### `branding.siteTitle`

- 类型：`string`
- 作用：控制左侧顶部品牌标题，以及移动端顶部标题
- 可选：是

#### `branding.logoSrc`

- 类型：`string`
- 作用：控制左侧顶部品牌 LOGO
- 可选：是
- 推荐：使用静态 URL 或站内资源路径，例如 `/logo/brand.svg`

#### `branding.logoAlt`

- 类型：`string`
- 作用：LOGO 的替代文本
- 可选：是

#### `branding.homeLabel`

- 类型：`string`
- 作用：保留给支持首页链接的主题使用
- 可选：是
- 说明：当前 `classic-docs` 已不在侧边栏底部显示该链接，因此通常不需要填写

### `chrome`

#### `chrome.showSearch`

- 类型：`boolean`
- 默认值：`true`
- 作用：控制左侧搜索框是否显示

### `colors`

以下字段都必须使用 `#RRGGBB` 格式：

- `colors.primary`
- `colors.primaryForeground`
- `colors.accent`
- `colors.accentForeground`
- `colors.sidebarActive`
- `colors.sidebarActiveForeground`

它们分别用于：

- 主要强调色
- 主要强调色上的文字颜色
- 柔和背景强调色
- 柔和强调色上的文字颜色
- 侧边栏当前激活项背景色
- 侧边栏当前激活项文字颜色

未填写的颜色会自动回退到主题默认值。

---

## 品牌区写法

`classic-docs` 的左上品牌区支持三种方式：

### 1. 纯标题

```json
{
  "site": {
    "theme": {
      "id": "classic-docs",
      "branding": {
        "siteTitle": "AI Knowledge Base"
      }
    }
  }
}
```

适合没有独立品牌图形、只想显示站点名称的文档站。

### 2. 纯 LOGO

```json
{
  "site": {
    "theme": {
      "id": "classic-docs",
      "branding": {
        "logoSrc": "/logo/brand.svg",
        "logoAlt": "Brand logo"
      }
    }
  }
}
```

适合品牌识别主要依赖图形标志，不希望顶部再出现文字标题的场景。

### 3. LOGO + 标题

```json
{
  "site": {
    "theme": {
      "id": "classic-docs",
      "branding": {
        "siteTitle": "AI Knowledge Base",
        "logoSrc": "/logo/brand.svg",
        "logoAlt": "AI Knowledge Base logo"
      }
    }
  }
}
```

这是最推荐的方式，适合产品文档、知识库和帮助中心。

---

## Studio 中如何配置

在 Studio 中打开右侧 `PROJECT SETTINGS` 后：

- `Docs Theme` 选择 `Classic Docs`
- `Site Title` 对应 `branding.siteTitle`
- `Classic Docs Appearance -> Logo Source` 对应 `branding.logoSrc`
- `Classic Docs Appearance -> Logo Alt Text` 对应 `branding.logoAlt`
- `Classic Docs Appearance -> Show Sidebar Search` 对应 `chrome.showSearch`
- `Classic Docs Appearance` 中的颜色输入框对应 `colors.*`

说明：

- 留空表示移除该覆盖值，并回退到主题默认样式
- 颜色字段仅接受 `#RRGGBB`

---

## 布局说明

当前 `classic-docs` 的视觉行为如下：

- 左侧顶部品牌区不再显示额外边框容器
- 不再显示 `DOCUMENTATION` 这类辅助眉标题
- 左下角语言切换使用紧凑型下拉选择框
- 语言切换不会显示额外图标，只显示文字
- 底部不再显示 `Knowledge Home` / `Docs Home` 链接

---

## 校验规则

以下情况会在项目配置加载时直接报错：

- `chrome.showSearch` 不是布尔值
- 任意 `colors.*` 不是 `#RRGGBB`
- `branding.logoSrc` / `branding.logoAlt` / `branding.siteTitle` 如果类型错误会直接报错
- `branding.siteTitle` 和 `branding.logoSrc` 的空字符串会按“未设置”处理
- 当声明 `branding` 时，`branding.siteTitle` 和 `branding.logoSrc` 不能同时未设置，至少要提供一个

---

## 推荐示例

```json
{
  "version": 1,
  "projectId": "default",
  "name": "AI Docs",
  "defaultLanguage": "zh",
  "languages": ["zh", "en"],
  "site": {
    "theme": {
      "id": "classic-docs",
      "branding": {
        "siteTitle": "AI Knowledge Base",
        "logoSrc": "/logo/ai.svg",
        "logoAlt": "AI Knowledge Base logo"
      },
      "chrome": {
        "showSearch": true
      },
      "colors": {
        "primary": "#111111",
        "primaryForeground": "#ffffff",
        "accent": "#f4f1eb",
        "accentForeground": "#111111",
        "sidebarActive": "#111111",
        "sidebarActiveForeground": "#ffffff"
      },
      "codeTheme": "github-dark"
    }
  }
}
```

这套配置适合极简、稳定、偏产品文档风格的阅读站。
