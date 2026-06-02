# HBX 自签名记录

更新时间：2026-05-24

## 用途

为 Echo 的 HBuilderX 5+ App 云打包生成 Android 自签名证书。

该证书用于：

- Android APK 签名
- DCloud 后台配置 Android 包名对应的签名信息
- UniPush / 个推应用校验
- 后续同包名 App 升级

## 应用信息

- DCloud AppID：`H5A517452`
- 应用名称：`Echo`
- Android 包名：`com.echo.im`
- 证书别名：`echo`
- 证书文件：`D:\DevelopAPP\certs\echo-release.keystore`
- 算法：`RSA`
- 密钥长度：`2048`
- 有效期：`36500` 天

密码由用户本地保存，不写入文档，不提交 GitHub。

## 已执行操作

1. 检查本机 `keytool`：

```powershell
Get-Command keytool
```

本机路径：

```text
D:\JAVA\bin\keytool.exe
```

2. 创建证书目录：

```powershell
New-Item -ItemType Directory -Force D:\DevelopAPP\certs
```

3. 生成 Echo Android 签名证书：

```powershell
keytool -genkeypair `
  -alias echo `
  -keyalg RSA `
  -keysize 2048 `
  -validity 36500 `
  -keystore D:\DevelopAPP\certs\echo-release.keystore `
  -storepass <本地密码> `
  -keypass <本地密码> `
  -dname "CN=Echo, OU=Echo, O=Echo, L=China, ST=China, C=CN"
```

4. 查看证书指纹：

```powershell
keytool -list -v -keystore D:\DevelopAPP\certs\echo-release.keystore
```

## DCloud 需要填写的签名信息

```text
Android 应用签名 MD5:
A4:DF:9F:7F:DE:07:9C:CE:5F:35:C7:A0:9C:BC:C6:FF

Android 应用签名 SHA1:
0D:53:65:B6:AE:9F:9A:09:16:7D:9A:41:5D:D7:BA:7F:2D:0D:AE:CF

Android 应用签名 SHA256:
5E:27:BB:49:9F:6D:40:AD:86:BD:23:5A:A8:25:9B:92:87:CA:E5:41:EC:4B:F0:32:F6:D4:93:39:E8:5A:DD:E9
```

## HBX 云打包填写

在 HBuilderX 云打包 Android 时选择“自有证书”，填写：

```text
证书文件：D:\DevelopAPP\certs\echo-release.keystore
证书别名：echo
证书密码：用户本地保存的密码
私钥密码：同证书密码
```

## 注意事项

- `D:\DevelopAPP\certs` 已加入 `.gitignore`，不要提交证书文件。
- keystore 文件和密码必须长期保存；同一个包名后续升级需要继续使用同一证书。
- DCloud 后台的包名、签名信息必须和 HBX 云打包时使用的包名、证书完全一致。
- 证书生成时 `keytool` 提示 JKS 可迁移到 PKCS12，这是格式提示；当前 `.keystore` 可用于 HBX 云打包。

