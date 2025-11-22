# Research & Design Decisions Template

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: discord-task-thread-sync
- **Discovery Scope**: New Feature
- **Key Findings**:
  - Discord フォーラムスレッドは `POST /channels/{channel.id}/threads` で作成し、同時にメッセージ本文を送信する必要がある。メッセージペイロード上限は 25MiB。citeturn0search5turn0search6
  - Apps Script の時間主導トリガーは `everyMinutes(30)` 等の固定インターバルを持ち、時間帯が多少揺らぐ前提で設計する。citeturn0search0
  - トリガー実行時間は 6 分（標準）で頭打ちのため、バッチ 1 回あたりのタスク数と Discord API 呼び出し数を抑制する必要がある。citeturn0search4

## Research Log

### Discord フォーラム API
- **Context**: プロジェクトIDごとにフォーラムスレッドを自動生成／再利用する手段を確認。
- **Sources Consulted**: Discord Developer Docs (Threads & Channel Resource)。
- **Findings**:
  - フォーラムチャンネルでは `POST /channels/{channelId}/threads` が唯一の作成手段で、最初のメッセージ本文と embed を同時に送る。
  - 既存スレッドへの投稿は `POST /channels/{threadId}/messages`。
  - 返却オブジェクトには Thread 本体と最新メッセージが含まれるため、J列へ書き込む thread.id を直接取得できる。
  - 作成には `SEND_MESSAGES` 権限が必要で `CREATE_PUBLIC_THREADS` は無視される。
- **Implications**:
  - Apps Script から Discord Bot Token を安全に保持し、HTTP リクエストを構成するラッパーが必要。
  - スレッド作成失敗時は J 列更新を避け、リトライ情報を PropertiesService へ保持する。

### Apps Script トリガー運用
- **Context**: 30 分間隔の同期ジョブを安定稼働させる条件を調査。
- **Sources Consulted**: Apps Script ClockTriggerBuilder / Installable Trigger docs、実行時間リミット解説。
- **Findings**:
  - `ScriptApp.newTrigger(...).timeBased().everyMinutes(30)` で 30 分毎トリガーを構築できるが、実行時刻は ±15 分程度ぶれる可能性。
  - installable trigger は最長 6 分実行。大量のタスク処理ではページングや部分同期が必須。
  - Add-on 文脈ではより厳しい制限（1 時間など）が存在するため、スタンドアロン Apps Script として運用する計画が妥当。
- **Implications**:
  - 1 回の同期で処理するプロジェクト件数にガードを入れ、残余を次回に回す設計が必要。
  - エラーに備え、再実行時に重複通知を避けるための idempotency キー（プロジェクトID + タイムスタンプ）を計算する。

### 進捗率計算と状態保持
- **Context**: 完了率表示を Discord スレッド名／メッセージへ反映する要件への対応策を検討。
- **Sources Consulted**: プロジェクト steering（構造/技術）と要件、Apps Script PropertiesService ベストプラクティス（社内知見）。
- **Findings**:
  - 親タスク単位で `完了件数 / 総件数` を算出し、整数パーセントで丸めて表示する。
  - 前回送信値を持たないと変化検知ができないため、`PropertiesService.getScriptProperties()` に JSON で保存する案が有効。
- **Implications**:
  - プロジェクトIDをキーにしたスナップショットを保持し、変化がある場合のみ Discord へ更新メッセージを送ることで API 呼び出し数を最適化できる。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| レイヤード + ポート/アダプタ | Orchestrator → Service → Repositories/Clients の 3 層。 | Steering の層分離方針と一致、テストしやすい。 | 初期実装でモジュール数が増える。 | Discord / Sheets をアダプタで抽象化。 |
| 単一スクリプト関数 | 1 つの `sync()` で全処理。 | 実装が早い。 | 責務が肥大化し再利用が難しい、テスト不能。 | 要件の複雑さに耐えないため不採用。 |

## Design Decisions

### Decision: Discord フォーラムのラッパーを専用コンポーネント化
- **Context**: REST API 呼び出しを各所で重複させたくない。
- **Alternatives Considered**:
  1. `UrlFetchApp.fetch` を直接各サービスで利用。
  2. `DiscordForumClient` を経由。
- **Selected Approach**: `DiscordForumClient` を実装し、Thread 作成/投稿/名前更新 API を集約。
- **Rationale**: トークン管理とリトライポリシーを一元化でき、ログの粒度を揃えられる。
- **Trade-offs**: 追加レイヤーにより初期コストが増える。
- **Follow-up**: 実装時にレート制限 (429) 対応を組み込む。

### Decision: スナップショットを PropertiesService に保存
- **Context**: 完了率や最終同期時間を保持する必要。
- **Alternatives Considered**:
  1. スプレッドシートの隠し列を利用。
  2. `PropertiesService` (script) に JSON を保存。
- **Selected Approach**: PropertiesService。シート列汚染を避け、Apps Script 内で高速に参照できる。
- **Trade-offs**: 総サイズ 500KB 制限に注意。
- **Follow-up**: 実装時に圧縮フォーマットや古いエントリの掃除を実装。

### Decision: 30 分バッチでの増分同期
- **Context**: onEdit トリガーは複雑化するため避けたいという要件。
- **Alternatives Considered**:
  1. onEdit / push ベースで都度同期。
  2. 定期トリガーで全件スキャン。
- **Selected Approach**: Installable time-driven trigger 30 分。
- **Rationale**: ガバナンスが簡単で、Apps Script のサポートする粒度内。
- **Trade-offs**: 最大 30 分の遅延が発生。J 列最新化までのラグが許容される前提。
- **Follow-up**: SLA 変更時に Pub/Sub 連携を検討。

## Risks & Mitigations
- Discord API 429（レート制限） — バックオフ＋次回トリガーで再送、PropertiesService に再送キューを保持。
- Apps Script 実行時間超過 — プロジェクトごとに件数上限を設定し、超過分は次回にキャリーオーバー。
- スレッドID 書き込み失敗 — 書き込みトランザクションのリトライと、J列と Properties の二重記録で検知。

## References
- Discord Docs: Threads / Channel Resource (2025-11-16 参照)。
- Google Apps Script Docs: ClockTriggerBuilder, Installable Triggers, Execution Time Limits (2025-11-16 参照)。
- Internal steering: `.kiro/steering/product.md`, `.kiro/steering/tech.md`, `.kiro/steering/structure.md`。
