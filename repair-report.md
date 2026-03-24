# 依赖混乱修复与经验总结报告

## 背景与问题描述

在项目初期使用 Modern.js 3.1.0 搭建时，默认底层依赖了 React 19（具体版本为 `^19.2.3`）。随后在引入组件库 `@ant-design/x` 时，控制台抛出了由于 peer dependencies 导致的警告，提示组件库依赖的是 React 16/17/18，未声明对 React 19 的支持。

由于误判，尝试将项目的核心依赖 `react` 和 `react-dom` 强制降级到 18.x。这导致了以下严重的连锁反应：
1. **框架底层版本冲突**：Modern.js 3.1.0 的多个核心构建工具（如 `@modern-js/app-tools`，`@modern-js/utils`）内部强制要求 `react@^19.2.4`，降级破坏了这些工具的运行基础。
2. **构建环境崩溃**：在 Windows 环境下进行频繁的大版本升降级，导致 `pnpm` 锁文件及 `node_modules/.bin` 目录中的软链接脚本损坏。运行 `pnpm run build` 时直接抛出系统级错误：`'.COM' 不是内部或外部命令，也不是可运行的程序或批处理文件`，项目彻底瘫痪。

## 修复方案：还原与清理（方案 1）

根据分析和外部 AI 的推荐，采取了**方案 1**（还原至 React 19，无视组件库的 peer 警告）。修复步骤如下：

1. **还原配置**：将 `package.json` 中的 `react` 和 `react-dom` 以及相关类型包 `@types/react`，`@types/react-dom` 恢复至初始的 19.x 版本。
2. **清理损坏环境**：执行了 `Remove-Item -Recurse -Force node_modules, pnpm-lock.yaml`（Windows PowerShell），彻底移除了旧的依赖树。
3. **重新安装**：执行 `pnpm install` 重新生成依赖，此时虽然控制台仍可能抛出 `@ant-design/x` 的 peer dependency 警告，但这仅仅是包管理器的安全提示，并不会影响运行。
4. **验证修复**：成功运行 `pnpm run lint` 和 `pnpm run build`，错误彻底消除，项目重新可被正常构建和运行。

## 经验教训与避坑指南

1. **核心框架 > 边缘组件库**：当使用诸如 Next.js、Modern.js 这样深度集成的大型框架时，框架的默认核心依赖（如 React 版本）具有最高优先级。组件库的 peer dependency 警告通常是滞后的，且 React 本身具备良好的向后兼容性，因此**不要为了消灭组件库警告而去降级整个框架的核心依赖**。
2. **正确对待 Peer Dependency 警告**：在使用 npm/pnpm/yarn 时，如果遇到组件库对 React 版本过高的报警，一般选择**忽略（Ignore）**或使用配置覆盖（例如 pnpm 的 `pnpm.peerDependencyRules.ignoreMissing`）来屏蔽警告，而不是盲目降级。
3. **应对 Windows 环境下 Node.js 脚本崩溃**：当在 Windows 下遇到 `'.COM' 不是内部命令` 或类似的 `.bin` 脚本执行异常时，这 100% 是 `node_modules` 损坏的信号。**最快最稳妥的解决办法是直接删除 `node_modules` 和锁文件，重新进行全新安装。**

## 总结

本次修复验证了在 Modern.js 3.1.0 环境下，坚持使用 React 19 是正确且稳定的选择。当前项目依赖已经恢复健康，可以继续进行后续的业务开发。
