# 技術スタック

## アーキテクチャ

- Google Apps Script (V8) を実行基盤とするサーバーレス構成。
- 時間主導トリガーと手動実行関数を組み合わせ、タスクの集計と通知送信を分離します。
- データストアは Google スプレッドシート等の Workspace リソースを利用し、外部 DB を想定しません。

## コア技術

- **言語**: Google Apps Script (ES2015 相当の JavaScript)。
- **フレームワーク**: （現状なし）Apps Script 標準サービス群を直接使用します。
- **ランタイム**: Apps Script V8 実行環境。

## 主要ライブラリ / サービス

- `SpreadsheetApp` でタスク情報を CRUD。
- `GmailApp` / `ChatApp` / `CalendarApp` を用途に応じて通知チャネルとして利用。
- `PropertiesService` で環境依存の設定値を管理。

## 開発標準

### 型安全性
- TypeScript 変換はまだ導入していないため、JSDoc typedef と ESLint の `noImplicitAny` 相当ルールで補完します。
- Apps Script 特有のグローバル関数名衝突を避けるため、名前空間オブジェクトを定義して公開 API をまとめます。

### コード品質
- `eslint-config-google` をベースにした Apps Script 向けルールを推奨。
- 自動整形は `prettier` (printWidth 100, singleQuote true) を想定し、`clasp push` 直前に整形を必須化します。

### テスト
- ビジネスロジックは Pure JS モジュール化し、`npm test` で Jest もしくは GasTap を実行できる構成を準備します。
- トリガー/サービス呼び出し層はスタブ化してローカルテスト可能にします。

## 開発環境

### 必要ツール
- Node.js 20 以上
- `clasp` CLI (Google公式) v2 以上
- `npm` / `yarn` いずれか

### よく使うコマンド
```bash
# Google にログイン
clasp login

# Apps Script プロジェクトをプル
clasp pull

# ローカル変更をプッシュ
clasp push

# テスト（Jest/GasTap）
npm test
```

## 主要な技術判断

- Google Workspace 標準範囲で完結するため、サードパーティ API 連携は必要最低限に抑えます。
- リマインド精度よりも運用の一貫性を優先し、時間主導トリガーは 15 分〜1 時間単位のバッチ実行にまとめます。
- 長期的には TypeScript + bundler（esbuild 等）を導入し、Apps Script へのデプロイを自動化する計画です。

---
_コードが追加され次第、実際のライブラリとコマンドを反映してください_
