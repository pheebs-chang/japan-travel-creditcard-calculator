---
date: 2026-03-25
source: https://www.markreadfintech.com/p/antithesis-bug-105
---
# Antithesis：軟體 Bug 抓不到、重現不了？華爾街量化巨頭破例掏出 1.05 億美元買這台確定性電腦

## 提到的概念與實體
[[Patrick Collison]] [[以太坊]] [[以太坊基金會]] [[AWS]]

## 事實
- 2012 年 8 月 1 日 Knight Capital 因軟體部署疏失啟動廢棄程式碼分支，45 分鐘內交易 3.97 億股，虧損 4.4 億美元。（）
- 全球股票市場超過 70% 日交易量由演算法執行，外匯市場高達 92% 由自動化系統完成。（）
- Acuiti 與 Exegy 研究顯示，74% 量化交易公司在高波動市場曾遭遇市場數據基礎設施故障，僅 3% 受訪機構表示系統能穩定運作。（）
- Antithesis 於 2018 年在維吉尼亞州成立，歷經五年半隱形研發，2024 年產品正式推向市場。（）
- Antithesis 三位創辦人 Will Wilson、Dave Scherer、Nick Lavezzo 為 FoundationDB 聯合創始人，FoundationDB 在 2015 年被蘋果收購。（）
- The Determinator 基於 FreeBSD 的 bhyve Hypervisor 分叉改造，透過 Intel 效能計數器以已退役指令數推進虛擬時鐘，並限制每個虛擬機只在單一物理 CPU 核心上運行。（）
- Antithesis 2025 年 12 月完成 1.05 億美元 A 輪，由 Jane Street 領投，累計募資超過 1.5 億美元，種子輪由 Amplify Partners 主導 4,700 萬美元。（）
- Jane Street 將內部分散式系統 Aria 載入 Antithesis，第一次執行就揪出兩個團隊此前毫無察覺的深層 Bug。（）
- A 輪投資人還包括 Spark Capital、Tamarack Global 與 Stripe 共同創辦人 Patrick Collison。（[[Patrick Collison]]）
- 以太坊 The Merge 在 2022 年 9 月完成，承載超過 3,000 億美元資產，能源消耗降低 99.95%。（[[以太坊]]）
- 以太坊基金會用 Antithesis 載入 8 種語言的客戶端，協助發現並修復 13 個致命 Panic 與拒絕服務漏洞及 22 個營運與共識邏輯缺陷。（[[以太坊基金會]]）
- MongoDB 每 2,500 小時模擬測試逼出 1 個深層 Bug，Bug 平均修復時間從數週壓縮至 3 天以內，自 2021 年起投入增加三倍。（）

## 作者觀點
- 確定性模擬測試概念不新，真正的突破在於把它產品化，讓任何團隊提供 Docker 映像檔即可使用，民主化軟體可靠性的上限。
- AI 寫程式的時代驗證比生成更值錢，能大規模驗證程式碼品質的基礎設施戰略價值可能超越生成工具本身。
- 傳統測試工具中確定性與真實混沌互斥，這是五種主流測試方法共享的結構性缺口。
- 台灣金融機構短期不會遇到微秒級競爭條件，更實際的啟示是學習確定性模擬測試的思維方式而非直接採購。
