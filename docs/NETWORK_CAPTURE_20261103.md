# Android 网络采集验证

## 真机通过

- PCAPdroid 2.0.2 独立安装，Eva 通过官方 CaptureCtrl API 请求启动。
- 用户完成首次欢迎页、引擎控制与系统 VPN 授权后，选择「仅 Eva（验证）」生成 example.org 测试流量。
- 工作区文件：network-captures/capture-1793680383297.pcap。
- 本机验证快照：artifacts/network-capture/device-self-test.pcap，7454 字节。
- 使用 Eva PacketSummary 解析：17 包，7158 字节报文，RAW IP 链路类型 101，未发现截断。
- 识别 example.org DNS 查询及 TLS SNI，双向 TCP/443 数据。
- 测试证明 Eva 接收、PCAP 保存与元数据解析可用；不证明 HTTPS 解密或商品数据提取可用。

## 已安装的解密扩展

- 来源：https://github.com/emanuele-f/PCAPdroid-mitm/releases/tag/v2.6
- 文件：PCAPdroid-mitm_v2.6_arm64-v8a.apk，28535965 字节。
- SHA256：6af79dad56faa84e1ae80278c801adb4e4cbd9cffee73b93c986e78a4ac6af22，与发布 digest 一致。
- apksigner 校验通过；证书 SHA256：ac701125e653189b2bbaa78fba60c1136b88b8780078db0dc4257f019c81c9fe。
- GPL-3.0；已查 COPYING 和 .gitmodules，依赖 chaquopy-wheels 与 mitmproxy。作为独立外部 App 安装，未将其源码并入 Eva。
- ADB 安装返回 Success。尚未配置证书，尚未验证 TLS 解密。

## 待完成

- 解密向导、证书授权及可解密测试目标验证。
- 美团实际连接的证书信任、协议及数据格式验证。
- HTTP 响应正文导入、商品字段提取、地址与商品关联、比较推荐。
- 当前 Eva 启动参数明确 tls_decryption=false，不能将已有 PCAP 元数据当作商品 JSON。
- APK 静态分析发现 CertificatePinner 类，不代表实际商品接口已启用证书绑定。

## 操作观察

- 手机不响应当前 ADB 模拟点击；系统授权和原生按钮由用户点击。
- 启动服务记录本身不能证明开始采集；以字节增加与有效 PCAP 记录为准。
- 首次欢迎页未完成期间曾出现零字节文件，完成欢迎页后停止、重新开始才获得有效数据。
