## 致谢 / Credits

本插件在开发过程中参考和借鉴了以下优秀的开源项目，在此表示感谢。

---

### [app2smile/rules](https://github.com/app2smile/rules)

本插件的核心脚本直接引用了该仓库持续维护的版本：

- **`tieba-json.js`** 
- **`tieba-proto.js`** 

该方案的核心思路是：通过 `sync` 接口的配置字段，在 App 启动阶段直接禁止第三方广告 SDK 初始化，从根源断掉广告投放链路，而非事后过滤。

---

### [luestr/ProxyResource](https://github.com/luestr/ProxyResource)（可莉的 Loon 资源库）

广告域名拦截规则的组织思路参考了该仓库的 `BlockAdvertisers` 插件

---

### 说明

本插件的 `[Script]` 部分通过 `script-path` 直接引用 app2smile 的原版脚本，不做本地 fork，以便自动跟进上游更新。插件本身只维护 `[Rule]`、`[URL Rewrite]`、`[MITM]` 等配置层内容。
