# SRD 数据包加解密规范

> **版本**：1.0  
> **日期**：2026-04-22  
> **目标**：SRD 数据包通过 U 盘传输时，防止第三方解压查看内容  
> **适用对象**：后端开发（加密端）、前端开发（解密端）

---

## 一、整体方案概述

### 1.1 加密方式

| 项目 | 说明 |
|------|------|
| 加密算法 | **AES-256-CBC** |
| 填充方式 | PKCS5Padding（等同 PKCS7） |
| 密钥 | 前后端共享预置密钥（32 字节） |
| IV（初始化向量） | 每个包随机生成 16 字节，防止相同内容产生相同密文 |
| 完整性校验 | SHA-256 哈希，防篡改 |
| 第三方依赖 | **无**。Java `javax.crypto` 和客户端 `javax.crypto.Cipher` 都是内置 API |

### 1.2 加解密流程总览

```text
【后端 - Java】                              【前端 - 客户端】

  生成 JSON + 素材                            选择 .srd 文件
       ↓                                          ↓
  打包为 ZIP                                  读取文件字节流
       ↓                                          ↓
  AES-256-CBC 加密                            检查魔数 "SRDE"
       ↓                                     ├─ 是 → AES 解密 → 校验 SHA-256
  写入 SRDE 头部 + 密文                        └─ 否 → 当作明文 ZIP（向后兼容）
       ↓                                          ↓
  输出 .srd 文件                              解压 ZIP → 导入数据库
```

### 1.3 预置密钥（前后端必须一致）

```text
MPM_OFFLINE_2026_SECURE_KEY_256B
```

- 恰好 32 字节（256 位），满足 AES-256 要求
- 客户端已硬编码在 `utils/crypto.uts` 第 7 行
- 后端 Java 工具类中使用相同字符串

> ⚠️ **安全提示**：此方案能防止普通用户通过解压工具查看内容，但无法防止专业人员反编译 APK 提取密钥。如后续有更高安全需求，可升级为"预置密钥 + 用户口令"的双重加密方案。

---

## 二、加密文件格式（.srd）

加密后的 .srd 文件由 **56 字节头部** + **加密数据** 组成：

```text
偏移 (字节)    长度     内容
────────────  ──────   ──────────────────────────────────
 0 ~  3       4 字节   魔数: 0x53 0x52 0x44 0x45 (ASCII "SRDE")
 4            1 字节   格式版本: 0x01
 5            1 字节   加密模式: 0x00 (预置密钥)
 6 ~  7       2 字节   保留字段: 0x00 0x00
 8 ~ 23      16 字节   IV (初始化向量，随机生成)
24 ~ 55      32 字节   SHA-256 (原始 ZIP 数据的哈希值)
56 ~ EOF      N 字节   AES-256-CBC 加密后的 ZIP 数据
```

**关键规则：**
- 前 4 字节是 `SRDE` → 说明这是加密包
- 前 4 字节是 `PK..`（`0x50 0x4B 0x03 0x04`） → 说明是未加密的 ZIP（向后兼容旧包）
- 其他情况 → 文件格式错误

---

## 三、后端加密实现（Java）

### 3.1 为什么 Java 天然兼容？

客户端解密使用的是 Android 的 `javax.crypto.Cipher("AES/CBC/PKCS5Padding")`，与 Java 后端是**完全相同的 API**：

| 参数 | 后端加密 | 客户端解密 |
|------|---------|-----------|
| 算法 | `Cipher.getInstance("AES/CBC/PKCS5Padding")` | `Cipher.getInstance("AES/CBC/PKCS5Padding")` |
| 密钥 | `new SecretKeySpec(keyBytes, "AES")` | `new SecretKeySpec(keyBytes, "AES")` |
| IV | `new IvParameterSpec(iv)` | `new IvParameterSpec(iv)` |
| 方向 | `Cipher.ENCRYPT_MODE` | `Cipher.DECRYPT_MODE` |

### 3.2 Java 工具类（可直接复制使用）

```java
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * SRD 数据包加密工具
 *
 * 使用 AES-256-CBC 加密，与客户端 crypto.uts 的解密逻辑完全对应。
 * 无需任何第三方依赖，javax.crypto 为 JDK 内置。
 */
public class SrdEncryptor {

    // ⚠️ 必须与客户端 utils/crypto.uts 中的 PRESET_KEY 完全一致
    private static final String PRESET_KEY = "MPM_OFFLINE_2026_SECURE_KEY_256B";

    // 魔数："SRDE" (SRD Encrypted)
    private static final byte[] MAGIC = {0x53, 0x52, 0x44, 0x45};
    private static final byte FORMAT_VERSION = 0x01;

    /**
     * 加密 SRD 数据包
     *
     * @param zipData 原始 ZIP 字节数据（打包好的 .srd 内容）
     * @return 加密后的字节数据，可直接写入 .srd 文件
     */
    public static byte[] encrypt(byte[] zipData) throws Exception {
        // 1. 计算原始数据的 SHA-256 校验值（用于导入时验证完整性）
        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
        byte[] hash = sha256.digest(zipData);

        // 2. 生成随机 IV（16 字节，每次加密都不同）
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);

        // 3. 构建 AES 密钥
        byte[] keyBytes = PRESET_KEY.getBytes(StandardCharsets.UTF_8);
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(iv);

        // 4. AES-256-CBC 加密
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);
        byte[] encryptedData = cipher.doFinal(zipData);

        // 5. 组装文件：56 字节头部 + 密文
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(MAGIC);                         //  4 字节：魔数 "SRDE"
        out.write(FORMAT_VERSION);                //  1 字节：格式版本 0x01
        out.write(0x00);                          //  1 字节：加密模式 0x00=预置密钥
        out.write(new byte[]{0x00, 0x00});        //  2 字节：保留
        out.write(iv);                            // 16 字节：随机 IV
        out.write(hash);                          // 32 字节：原始数据 SHA-256
        out.write(encryptedData);                 //  N 字节：加密后的 ZIP 数据

        return out.toByteArray();
    }

    /**
     * 加密 SRD 文件（文件到文件）
     *
     * @param inputPath  输入路径（未加密的 .srd / .zip）
     * @param outputPath 输出路径（加密后的 .srd）
     */
    public static void encryptFile(String inputPath, String outputPath) throws Exception {
        byte[] zipData;
        try (FileInputStream fis = new FileInputStream(inputPath)) {
            zipData = fis.readAllBytes();
        }

        System.out.println("原始文件大小: " + zipData.length + " 字节");

        byte[] encrypted = encrypt(zipData);

        try (FileOutputStream fos = new FileOutputStream(outputPath)) {
            fos.write(encrypted);
        }

        System.out.println("加密文件大小: " + encrypted.length + " 字节");
        System.out.println("✅ 加密完成: " + outputPath);
    }

    /**
     * 命令行入口（可独立运行测试）
     * 用法: java SrdEncryptor input.srd [output.srd]
     */
    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.out.println("用法: java SrdEncryptor <input.srd> [output.srd]");
            return;
        }

        String input = args[0];
        String output = args.length >= 2 ? args[1]
                : input.replace(".srd", "_encrypted.srd");

        encryptFile(input, output);
    }
}
```

### 3.3 在后端服务中集成

在生成 SRD 包的 Service 中调用即可，只需一行代码：

```java
@Service
public class SrdPackageService {

    public byte[] generateEncryptedPackage(ProcessData data) throws Exception {
        // 1. 你现有的打包逻辑：组装 JSON → 打包 ZIP
        byte[] zipData = buildZipPackage(data);

        // 2. 加密（一行代码）
        return SrdEncryptor.encrypt(zipData);
    }
}
```

### 3.4 环境要求

| 要求 | 说明 |
|------|------|
| JDK 版本 | Java 8u161+ 或 Java 11+（已默认支持 AES-256） |
| 第三方依赖 | **无**，全部使用 JDK 内置的 `javax.crypto` 和 `java.security` |
| Maven/Gradle | 无需添加任何依赖 |

> 如果使用 Java 8u151 以前的旧版本，需安装 [JCE Unlimited Strength Policy](https://www.oracle.com/java/technologies/javase-jce-all-downloads.html)。

---

## 四、客户端解密改造

### 4.1 解密流程

```text
1. 读取 .srd 文件为 ArrayBuffer
     ↓
2. 检查前 4 字节（魔数判断）
     ├── "SRDE" (0x53524445) → 加密包，进入步骤 3
     ├── "PK.." (0x504B0304) → 明文 ZIP，直接返回（向后兼容旧包）
     └── 其他 → 报错"不支持的文件格式"
     ↓
3. 从头部提取：IV（第 8~23 字节）、SHA-256（第 24~55 字节）
     ↓
4. 取第 56 字节之后的数据为密文
     ↓
5. 使用 AES-256-CBC + 预置密钥 + IV 解密
     ↓
6. 计算解密结果的 SHA-256，与头部记录的哈希对比
     ├── 一致 → 解密成功，返回 ZIP 数据
     └── 不一致 → 报错"数据已损坏或密钥不匹配"
```

### 4.2 需要改造的文件

**`utils/crypto.uts`** — 主要改动：

| 改动点 | 说明 |
|--------|------|
| 新增魔数检测函数 | 读取前 4 字节判断文件类型 |
| 修改 `decryptPackage` 入口 | 先检测类型，再决定是否解密 |
| 修改头部解析偏移 | 从旧的"前 16 字节=IV"改为"第 8~23 字节=IV，第 56 字节起=密文" |
| 新增 SHA-256 校验 | 解密后校验完整性 |

**改造后的核心逻辑（UTS 伪代码）：**

```typescript
// 魔数常量
const MAGIC_SRDE = [0x53, 0x52, 0x44, 0x45]  // "SRDE"
const MAGIC_ZIP  = [0x50, 0x4B, 0x03, 0x04]  // "PK\x03\x04"
const HEADER_SIZE = 56

/**
 * 检测文件类型
 */
function detectFileType(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data)
    if (bytes.length < 4) return 'unknown'

    if (bytes[0] == 0x53 && bytes[1] == 0x52
        && bytes[2] == 0x44 && bytes[3] == 0x45) {
        return 'encrypted'  // SRDE 加密包
    }

    if (bytes[0] == 0x50 && bytes[1] == 0x4B
        && bytes[2] == 0x03 && bytes[3] == 0x04) {
        return 'zip'  // 明文 ZIP
    }

    return 'unknown'
}

/**
 * 改造后的解密入口
 */
export function decryptPackage(fileData: ArrayBuffer): DecryptResult {
    const fileType = detectFileType(fileData)

    if (fileType == 'zip') {
        // 旧的未加密包，直接透传
        return { success: true, data: fileData, errorMessage: '' }
    }

    if (fileType == 'encrypted') {
        const bytes = new Uint8Array(fileData)

        // 从头部提取 IV 和 SHA-256
        const iv = bytes.slice(8, 24)            // 16 字节 IV
        const expectedHash = bytes.slice(24, 56)  // 32 字节 SHA-256
        const cipherData = bytes.slice(56)        // 密文

        // 执行 AES-256-CBC 解密（平台分发，逻辑不变）
        // ...

        // 校验 SHA-256
        // ...
    }

    return { success: false, data: null, errorMessage: '不支持的文件格式' }
}
```

---

## 五、向后兼容

| 场景 | 行为 | 结果 |
|------|------|------|
| 新客户端导入旧的**未加密** .srd | 检测到 ZIP 魔数 → 跳过解密 | ✅ 正常导入 |
| 新客户端导入新的**加密** .srd | 检测到 SRDE 魔数 → 解密 | ✅ 正常导入 |
| 旧客户端导入新的**加密** .srd | 旧解密逻辑失败 → 当明文 ZIP 解压 → 解压失败 | ❌ 需升级客户端 |

> 旧客户端无法导入加密包是**预期行为**，提示用户升级即可。

---

## 六、安全性说明

| 威胁场景 | 防御效果 | 备注 |
|---------|---------|------|
| 拿到 U 盘直接解压 .srd | ✅ 防御 | 加密后文件不是合法 ZIP，任何解压工具都无法打开 |
| 改文件后缀名尝试打开 | ✅ 防御 | 文件内容是密文，改后缀无意义 |
| 篡改文件内容 | ✅ 防御 | SHA-256 校验会检测到数据被篡改 |
| AES 暴力破解 | ✅ 防御 | AES-256 暴力破解在计算上不可行 |
| 反编译 APK 提取密钥 | ⚠️ 有限防御 | 预置密钥方案的固有局限，需专业能力 |

**总结**：当前方案满足"**防止普通人员通过解压查看工艺数据**"的需求，覆盖 U 盘传输场景下的主流威胁。

---

## 七、工作量估算

| 任务 | 负责人 | 预估工时 |
|------|--------|---------|
| 后端：将 `SrdEncryptor.java` 集成到制包流程 | 后端同事 | 0.5 天 |
| 前端：改造 `crypto.uts` — 魔数检测 + 新头部格式解析 | 前端 | 1 天 |
| 前端：补全 Web 端解密（SubtleCrypto API） | 前端 | 0.5 天 |
| 联调测试：后端加密 → 前端解密 → 全流程验证 | 双方 | 0.5 天 |
| **合计** | — | **约 2.5 天** |

---

## 八、联调验证清单

前后端联调时按以下步骤逐项验证：

- [ ] 后端能正确生成加密 .srd 文件（文件头 4 字节为 `53 52 44 45`）
- [ ] 加密后的 .srd 文件**无法**被 WinRAR/7-Zip 等工具解压
- [ ] 客户端（Android）能正确导入加密 .srd 文件
- [ ] 客户端（HarmonyOS）能正确导入加密 .srd 文件
- [ ] 客户端（Web）能正确导入加密 .srd 文件
- [ ] 客户端仍然能导入旧的未加密 .srd 文件（向后兼容）
- [ ] 故意篡改加密 .srd 的某个字节后，客户端报错"数据已损坏"
- [ ] 导入加密包后，工艺树、组件数据、附件资源均正常展示
